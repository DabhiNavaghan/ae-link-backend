export const maxDuration = 30;

// @ts-ignore
import { UAParser } from 'ua-parser-js';
import { NextRequest, NextResponse } from 'next/server';
import { applyCors } from '@/lib/middleware/cors';

interface GeoResponse {
  error?: boolean;
  reason?: string;
  country_name?: string;
  country_code?: string;
  region?: string;
  region_code?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  org?: string;
  asn?: string;
  timezone?: string;
  postal?: string;
  utc_offset?: string;
  continent_code?: string;
  in_eu?: boolean;
  currency?: string;
  currency_name?: string;
  country_calling_code?: string;
  country_area?: number;
  country_population?: number;
  country_capital?: string;
  network?: string;
  version?: string;
}

export async function GET(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  const userAgent = request.headers.get('user-agent') || '';
  const referer = request.headers.get('referer') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const host = request.headers.get('host') || '';
  const origin = request.headers.get('origin') || '';
  const cfCountry = request.headers.get('cf-ipcountry') || '';
  const cfConnectingIp = request.headers.get('cf-connecting-ip') || '';

  const parser = new UAParser(userAgent);
  const uaResult = parser.getResult();

  const isPrivateIp =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === 'localhost' ||
    /^192\.168\./.test(ip) ||
    /^10\./.test(ip) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip);

  let geo: GeoResponse | null = null;
  if (!isPrivateIp) {
    try {
      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`, {
        headers: { 'User-Agent': 'SmartLink-DeviceInspector/1.0', Accept: 'application/json' },
        cache: 'no-store',
      });
      if (geoRes.ok) {
        const raw: GeoResponse = await geoRes.json();
        if (!raw.error) {
          geo = raw;
        }
      }
    } catch {
      // Geo lookup unavailable — continue without it
    }
  }

  const response = NextResponse.json({
    server: {
      ip,
      host,
      origin,
      referer,
      acceptLanguage,
      cfCountry: cfCountry || null,
      cfConnectingIp: cfConnectingIp || null,
      isPrivateIp,
    },
    geo,
    ua: {
      raw: userAgent,
      browser: {
        name: uaResult.browser.name ?? null,
        version: uaResult.browser.version ?? null,
        major: uaResult.browser.major ?? null,
      },
      os: {
        name: uaResult.os.name ?? null,
        version: uaResult.os.version ?? null,
      },
      device: {
        type: uaResult.device.type ?? 'desktop',
        model: uaResult.device.model ?? null,
        vendor: uaResult.device.vendor ?? null,
      },
      cpu: {
        architecture: uaResult.cpu.architecture ?? null,
      },
      engine: {
        name: uaResult.engine.name ?? null,
        version: uaResult.engine.version ?? null,
      },
    },
  });

  return applyCors(request, response);
}
