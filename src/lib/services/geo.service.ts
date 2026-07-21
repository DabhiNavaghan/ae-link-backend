import { Logger } from '@/lib/logger';
import { isPrivateIp, type IpSource } from '@/lib/get-client-ip';

const logger = Logger.child({ module: 'geo-service' });

export interface GeoInfo {
  /**
   * Full English country name, e.g. "India". Kept as the primary field because
   * analytics groups on `$geo.country` and existing rows hold names, not codes.
   */
  country?: string;
  /** ISO 3166-1 alpha-2, e.g. "IN". */
  countryCode?: string;
  region?: string;
  /** ISO 3166-2 subdivision, e.g. "GJ". */
  regionCode?: string;
  city?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  /** IANA zone, e.g. "Asia/Kolkata". */
  timezone?: string;
  /** Two-letter continent, e.g. "AS". */
  continent?: string;
  /** Which source produced this — invaluable when auditing data quality later. */
  source?: 'cloudflare' | 'ipapi' | 'none';
}

interface HeaderGetter {
  get(name: string): string | null;
}

/**
 * Resolve a header accessor from a Request, NextRequest, or the ReadonlyHeaders
 * returned by `headers()`. Mirrors the shape handling in get-client-ip so both
 * accept the same argument at every call site.
 */
function resolveHeaders(source: IpSource | undefined): HeaderGetter | null {
  if (!source) return null;
  const s = source as { get?: unknown; headers?: HeaderGetter };
  if (typeof s.get === 'function') return source as HeaderGetter;
  if (s.headers && typeof s.headers.get === 'function') return s.headers;
  return null;
}

/** Cached — constructing Intl.DisplayNames per click is needless work. */
let regionNames: Intl.DisplayNames | null = null;
function countryNameFor(code: string): string | undefined {
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    const name = regionNames.of(code);
    // `of()` echoes the input back when it doesn't recognise the code.
    return name && name !== code ? name : undefined;
  } catch {
    return undefined;
  }
}

function num(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

function str(raw: string | null): string | undefined {
  const v = raw?.trim();
  return v ? v : undefined;
}

/**
 * Read geo straight off the Cloudflare request headers.
 *
 * Free, zero latency, no rate limit, and always in sync with the edge that
 * served the request. Requires the "Add visitor location headers" Managed
 * Transform to be enabled on the zone; without it only `cf-ipcountry` arrives,
 * which still beats an outbound lookup for the country breakdown.
 *
 * Returns null when no country could be determined, so the caller can fall back.
 */
export function geoFromCloudflare(source: IpSource | undefined): GeoInfo | null {
  const h = resolveHeaders(source);
  if (!h) return null;

  const rawCountry = str(h.get('cf-ipcountry'))?.toUpperCase();
  // Cloudflare uses XX for unknown and T1 for Tor exit nodes — neither is a place.
  const countryCode =
    rawCountry && rawCountry !== 'XX' && rawCountry !== 'T1' ? rawCountry : undefined;
  if (!countryCode) return null;

  return {
    country: countryNameFor(countryCode),
    countryCode,
    region: str(h.get('cf-region')),
    regionCode: str(h.get('cf-region-code')),
    city: str(h.get('cf-ipcity')),
    postalCode: str(h.get('cf-postal-code')),
    latitude: num(h.get('cf-iplatitude')),
    longitude: num(h.get('cf-iplongitude')),
    timezone: str(h.get('cf-timezone')),
    continent: str(h.get('cf-ipcontinent')),
    source: 'cloudflare',
  };
}

/**
 * Strict IPv4/IPv6 check. Security-relevant: the IP is interpolated into an
 * outbound URL, so an unvalidated value would let a caller steer a server-side
 * fetch. `cf-connecting-ip` is trustworthy through Cloudflare, but anything
 * reaching the origin directly can set it freely.
 */
function isValidIp(ip: string): boolean {
  const v4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  if (v4.test(ip)) return true;
  return /^[0-9a-f:]+$/i.test(ip) && ip.includes(':') && ip.length <= 45;
}

/**
 * IP → geo cache. A single visitor journey hits the redirect page and then
 * resolve, which previously cost two identical lookups; the same IP also
 * recurs across a session. Bounded so a burst of unique IPs can't grow it
 * without limit.
 */
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 5000;
const cache = new Map<string, { geo: GeoInfo; expires: number }>();

function cacheGet(ip: string): GeoInfo | null {
  const hit = cache.get(ip);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(ip);
    return null;
  }
  return hit.geo;
}

function cacheSet(ip: string, geo: GeoInfo): void {
  // Map preserves insertion order, so the first key is the oldest.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(ip, { geo, expires: Date.now() + CACHE_TTL_MS });
}

/**
 * Fallback provider, used only when Cloudflare headers are unavailable —
 * direct-to-origin requests, or local development. Free tier is 1000/day, so
 * this will 429 under real traffic; that is acceptable precisely because it is
 * no longer on the primary path.
 */
async function lookupViaProvider(ip: string): Promise<GeoInfo> {
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(1500), // Don't slow down redirects.
    });
    if (!res.ok) {
      logger.debug({ ip, status: res.status }, 'Geo provider returned non-OK');
      return {};
    }

    const data = await res.json();
    if (data.error) return {};

    return {
      country: data.country_name || undefined,
      countryCode: data.country_code || undefined,
      region: data.region || undefined,
      regionCode: data.region_code || undefined,
      city: data.city || undefined,
      postalCode: data.postal || undefined,
      latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
      longitude: typeof data.longitude === 'number' ? data.longitude : undefined,
      timezone: data.timezone || undefined,
      continent: data.continent_code || undefined,
      source: 'ipapi',
    };
  } catch (err) {
    logger.debug({ ip, error: String(err) }, 'Geo lookup failed — continuing without it');
    return {};
  }
}

/**
 * Resolve geo for a click.
 *
 * Order: Cloudflare headers → cached provider result → provider. Pass the
 * request (or the `headers()` result) as `source` so the header path can be
 * used; omitting it silently degrades to the rate-limited provider, which is
 * why every call site should supply it.
 *
 * Never throws — an empty object is returned rather than blocking a redirect.
 */
export async function lookupGeo(ip: string, source?: IpSource): Promise<GeoInfo> {
  const fromHeaders = geoFromCloudflare(source);
  if (fromHeaders) return fromHeaders;

  if (!ip || !isValidIp(ip) || isPrivateIp(ip)) return {};

  const cached = cacheGet(ip);
  if (cached) return cached;

  const geo = await lookupViaProvider(ip);
  // Only cache real answers; a 429 shouldn't be remembered for an hour.
  if (geo.countryCode || geo.country) cacheSet(ip, geo);
  return geo;
}
