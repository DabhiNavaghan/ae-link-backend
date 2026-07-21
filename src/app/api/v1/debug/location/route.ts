import { NextRequest, NextResponse } from 'next/server';
import { getClientIpInfo, isPrivateIp } from '@/lib/get-client-ip';
import { parseColoCode, lookupColo } from '@/lib/cf-colo';
import { geoFromCloudflare } from '@/lib/services/geo.service';
import { applyCors } from '@/lib/middleware/cors';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ module: 'debug-location' });

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/debug/location
 *
 * Compares every location source available to us, side by side, so we can see
 * which ones actually carry data on this infra:
 *
 *   1. Cloudflare request headers  — free, zero latency, no rate limit.
 *      Only `cf-ipcountry` ships by default; the rest require the
 *      "Add visitor location headers" Managed Transform to be enabled
 *      (Cloudflare dash → Rules → Transform Rules → Managed Transforms).
 *   2. ipapi.co    — what `geo.service.ts` uses today. Free tier: 1000/day.
 *   3. ip-api.com  — second opinion, free for non-commercial, 45 req/min.
 *   4. Client hints — `accept-language` implies locale/region without any lookup.
 *
 * Pass `?ip=1.2.3.4` to look up a specific address instead of the caller's.
 * Pass `?skipLookups=1` to return headers only (no outbound calls, no quota burn).
 */

/** Every geo header Cloudflare can emit, in the order the dashboard lists them. */
const CF_GEO_HEADERS = [
  'cf-ipcountry',
  'cf-ipcity',
  'cf-ipcontinent',
  'cf-iplatitude',
  'cf-iplongitude',
  'cf-region',
  'cf-region-code',
  'cf-postal-code',
  'cf-timezone',
  'cf-metro-code',
] as const;

/**
 * Strict IPv4/IPv6 validation. This is a security control, not a nicety: the IP
 * is interpolated into an outbound URL path, so an unvalidated value like
 * `../../admin` would let a caller steer our server-side fetch (SSRF).
 */
function isValidIp(ip: string): boolean {
  const v4 =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  const v6 = /^[0-9a-f:]+$/i;
  if (v4.test(ip)) return true;
  return v6.test(ip) && ip.includes(':') && ip.length <= 45;
}

interface ProviderResult {
  ok: boolean;
  ms: number;
  /** Normalised subset so the providers can be compared at a glance. */
  normalized?: {
    country?: string | null;
    countryCode?: string | null;
    region?: string | null;
    city?: string | null;
    postal?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    timezone?: string | null;
    asn?: string | null;
    org?: string | null;
  };
  raw?: unknown;
  error?: string;
}

async function timed(
  label: string,
  fn: () => Promise<{ normalized: ProviderResult['normalized']; raw: unknown }>
): Promise<ProviderResult> {
  const started = performance.now();
  try {
    const { normalized, raw } = await fn();
    return { ok: true, ms: Math.round(performance.now() - started), normalized, raw };
  } catch (err) {
    logger.debug({ provider: label, error: String(err) }, 'Geo provider lookup failed');
    return { ok: false, ms: Math.round(performance.now() - started), error: String(err) };
  }
}

async function fetchIpapi(ip: string) {
  return timed('ipapi.co', async () => {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { 'User-Agent': 'SmartLink-DebugLocation/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    if (raw.error) throw new Error(raw.reason || 'provider returned error');
    return {
      raw,
      normalized: {
        country: raw.country_name ?? null,
        countryCode: raw.country_code ?? null,
        region: raw.region ?? null,
        city: raw.city ?? null,
        postal: raw.postal ?? null,
        latitude: raw.latitude ?? null,
        longitude: raw.longitude ?? null,
        timezone: raw.timezone ?? null,
        asn: raw.asn ?? null,
        org: raw.org ?? null,
      },
    };
  });
}

async function fetchIpApiCom(ip: string) {
  return timed('ip-api.com', async () => {
    const fields = 'status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,as,isp,query';
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`,
      { signal: AbortSignal.timeout(4000), cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    if (raw.status !== 'success') throw new Error(raw.message || 'provider returned error');
    return {
      raw,
      normalized: {
        country: raw.country ?? null,
        countryCode: raw.countryCode ?? null,
        region: raw.regionName ?? null,
        city: raw.city ?? null,
        postal: raw.zip ?? null,
        latitude: raw.lat ?? null,
        longitude: raw.lon ?? null,
        timezone: raw.timezone ?? null,
        asn: raw.as ?? null,
        org: raw.isp ?? null,
      },
    };
  });
}

export async function GET(request: NextRequest) {
  const ipInfo = getClientIpInfo(request);
  const { searchParams } = new URL(request.url);

  const override = searchParams.get('ip')?.trim();
  const skipLookups = searchParams.get('skipLookups') === '1';

  if (override && !isValidIp(override)) {
    return applyCors(
      request,
      NextResponse.json({ error: 'Invalid `ip` parameter — must be a valid IPv4 or IPv6 address.' }, { status: 400 })
    );
  }

  const targetIp = override || ipInfo.ip;

  // ---- Source 1: Cloudflare headers (free, already on every request) ----
  const cloudflare: Record<string, string | null> = {};
  for (const name of CF_GEO_HEADERS) {
    cloudflare[name] = request.headers.get(name);
  }
  const cfPopulated = Object.values(cloudflare).filter(Boolean).length;

  // Edge-datacenter fallback: `cf-ray` always ships, so this yields a coarse
  // location even with the visitor-location Managed Transform switched off.
  const cfRay = request.headers.get('cf-ray');
  const coloCode = parseColoCode(cfRay);
  const colo = lookupColo(coloCode);

  // ---- Source 4: client hints, derived from headers with no lookup at all ----
  const acceptLanguage = request.headers.get('accept-language');
  const clientHints = {
    acceptLanguage,
    /** e.g. "en-IN,en;q=0.9" → ["en-IN", "en"] — the region subtag is a free signal. */
    languages: acceptLanguage
      ? acceptLanguage.split(',').map((l) => l.split(';')[0].trim()).filter(Boolean)
      : [],
    /** Chrome-only, and only over HTTPS. */
    secChUa: request.headers.get('sec-ch-ua'),
    secChUaPlatform: request.headers.get('sec-ch-ua-platform'),
    secChUaMobile: request.headers.get('sec-ch-ua-mobile'),
  };

  // ---- Sources 2 & 3: outbound IP-geolocation lookups, run concurrently ----
  let providers: Record<string, ProviderResult | { skipped: true; reason: string }> = {};

  if (!targetIp) {
    providers = {
      'ipapi.co': { skipped: true, reason: 'No client IP could be resolved' },
      'ip-api.com': { skipped: true, reason: 'No client IP could be resolved' },
    };
  } else if (ipInfo.isPrivate && !override) {
    providers = {
      'ipapi.co': { skipped: true, reason: `IP ${targetIp} is private/reserved — lookup would be meaningless` },
      'ip-api.com': { skipped: true, reason: `IP ${targetIp} is private/reserved — lookup would be meaningless` },
    };
  } else if (skipLookups) {
    providers = {
      'ipapi.co': { skipped: true, reason: 'skipLookups=1' },
      'ip-api.com': { skipped: true, reason: 'skipLookups=1' },
    };
  } else {
    const [ipapi, ipApiCom] = await Promise.all([fetchIpapi(targetIp), fetchIpApiCom(targetIp)]);
    providers = { 'ipapi.co': ipapi, 'ip-api.com': ipApiCom };
  }

  const response = NextResponse.json({
    resolvedIp: targetIp,
    // Exactly the subdocument a click would persist for this request — the
    // point of comparison for everything reported under `sources` below.
    wouldStore: geoFromCloudflare(request) ?? {
      note: 'No Cloudflare country header — would fall back to the IP provider.',
    },
    // Describes the IP actually being looked up, which is not the caller's when
    // `?ip=` is set — reporting the caller's flag there would be misleading.
    ipIsPrivate: targetIp ? isPrivateIp(targetIp) : false,
    callerIp: ipInfo.ip,
    ipOverridden: Boolean(override),

    sources: {
      // Preferred: costs nothing, adds no latency, never rate-limited.
      cloudflareHeaders: {
        populated: cfPopulated,
        of: CF_GEO_HEADERS.length,
        note:
          cfPopulated === 0
            ? 'No cf-* headers present at all — this request did not come through Cloudflare. Expected on localhost; if you see this in production it means the request reached the origin directly, bypassing the proxy.'
            : cfPopulated === 1
              ? 'Only cf-ipcountry is set. Enable "Add visitor location headers" (Cloudflare → Rules → Transform Rules → Managed Transforms) to get city, region, lat/long, timezone and postal code for free.'
              : 'Visitor location headers are enabled — prefer these over outbound lookups.',
        values: cloudflare,
      },
      cloudflareEdge: {
        cfRay,
        coloCode,
        location: colo,
        accuracy: 'approximate',
        note: colo
          ? `Nearest Cloudflare edge is ${colo.city}. This is where the request was served, NOT where the visitor is — treat as a coarse metro hint only, and prefer cf-ipcity or an IP lookup when either is available.`
          : coloCode
            ? `Edge datacenter ${coloCode} is not in our lookup table; add it to src/lib/cf-colo.ts if it shows up often.`
            : 'No cf-ray header — this request did not come through Cloudflare.',
      },
      ipLookup: providers,
      clientHints,
    },
  });

  return applyCors(request, response);
}
