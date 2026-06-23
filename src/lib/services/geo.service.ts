import { Logger } from '@/lib/logger';

const logger = Logger.child({ module: 'geo-service' });

export interface GeoInfo {
  country?: string;
  city?: string;
  region?: string;
}

/**
 * Lookup geo info for an IP address using ipapi.co (free tier: 1000/day).
 * Returns empty object on failure — never blocks or throws.
 */
export async function lookupGeo(ip: string): Promise<GeoInfo> {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return {};
  }

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(1500), // 1.5s max — don't slow down redirects
    });

    if (!res.ok) return {};

    const data = await res.json();
    if (data.error) return {};

    return {
      country: data.country_name || undefined,
      city: data.city || undefined,
      region: data.region || undefined,
    };
  } catch (err) {
    logger.debug({ ip, error: String(err) }, 'Geo lookup failed — continuing without it');
    return {};
  }
}
