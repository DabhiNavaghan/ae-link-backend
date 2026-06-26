import { Logger } from '@/lib/logger';

const logger = Logger.child({ service: 'OgFetch' });

export interface OgMeta {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

// Cache so repeated crawler hits don't re-scrape the same destination.
const cache = new Map<string, { meta: OgMeta; expires: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function readMeta(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`,
        'i'
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`,
        'i'
      ),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) return decodeEntities(m[1].trim());
    }
  }
  return undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Fetch a URL and extract its Open Graph / Twitter card metadata so the short
 * link's social preview mirrors the real destination page. Returns an empty
 * object on any failure — callers fall back to defaults.
 */
export async function fetchOgMeta(url: string): Promise<OgMeta> {
  if (!url || !/^https?:\/\//i.test(url)) return {};

  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.meta;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; AllEventsSmartLink/1.0; +https://allevents.in)',
        accept: 'text/html,application/xhtml+xml',
      },
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      logger.debug({ url, status: res.status }, 'OG fetch non-ok');
      return {};
    }

    // Only read the <head>; cap the body so huge pages don't blow memory.
    const full = await res.text();
    const headEnd = full.search(/<\/head>/i);
    const html = headEnd > 0 ? full.slice(0, headEnd) : full.slice(0, 200_000);

    const meta: OgMeta = {
      title:
        readMeta(html, ['og:title', 'twitter:title']) ||
        html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim(),
      description: readMeta(html, [
        'og:description',
        'twitter:description',
        'description',
      ]),
      image: readMeta(html, ['og:image', 'twitter:image', 'og:image:url']),
      siteName: readMeta(html, ['og:site_name']),
    };

    // Resolve protocol-relative / relative image URLs against the page origin.
    if (meta.image) {
      try {
        meta.image = new URL(meta.image, url).toString();
      } catch {
        /* leave as-is */
      }
    }

    cache.set(url, { meta, expires: Date.now() + CACHE_TTL_MS });
    return meta;
  } catch (err) {
    logger.debug({ url, error: (err as Error)?.message }, 'OG fetch failed');
    return {};
  }
}
