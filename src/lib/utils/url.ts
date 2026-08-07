/**
 * URL scheme guards.
 *
 * Anything that reaches an `href`, `src` or a redirect must be proven to be
 * http(s) first. `javascript:` and `data:` URLs in an anchor execute in the
 * page's origin, and several of these values are operator-supplied (app info,
 * store URLs) yet render on public, unauthenticated pages.
 */

/**
 * The URL when it is safe to navigate to or embed, otherwise undefined.
 *
 * Parsing rather than prefix-matching on purpose: `java\tscript:` and
 * ` javascript:` both survive a naive `startsWith('http')` check in some
 * browsers, and both fail here.
 */
export function safeHttpUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = String(url).trim();
  if (!trimmed) return undefined;
  try {
    const protocol = new URL(trimmed).protocol.toLowerCase();
    if (protocol === 'http:' || protocol === 'https:') return trimmed;
  } catch {
    // Relative or unparseable — not something we can vouch for.
  }
  return undefined;
}

/** True when the value is an http(s) URL. */
export function isSafeHttpUrl(url?: string | null): boolean {
  return safeHttpUrl(url) !== undefined;
}

/**
 * Keep an operator-supplied URL only if it is http(s), otherwise drop it to an
 * empty string. Used on write so an unusable value is never stored, while a
 * blank field keeps its "not configured" meaning.
 */
export function sanitizeStoredUrl(url?: string | null): string {
  return safeHttpUrl(url) ?? '';
}

/**
 * App-info fields with their URLs held to http(s), so a `javascript:` value
 * can never reach the href on the public interstitial. Applied on write, and
 * the interstitial guards again at render for rows saved before this existed.
 */
export function sanitizeAppInfoUrls<
  T extends { iconUrl?: string; screenshotUrl?: string; marketingUrl?: string }
>(info: T): T {
  return {
    ...info,
    ...(info.iconUrl !== undefined && { iconUrl: sanitizeStoredUrl(info.iconUrl) }),
    ...(info.screenshotUrl !== undefined && {
      screenshotUrl: sanitizeStoredUrl(info.screenshotUrl),
    }),
    ...(info.marketingUrl !== undefined && { marketingUrl: sanitizeStoredUrl(info.marketingUrl) }),
  };
}

/**
 * Schemes a store link is allowed to use. `market://` and `itms-apps://` open
 * the native store app directly and are a legitimate thing to configure, so
 * store URLs cannot be held to the plain http(s) rule — but they still must
 * not be a free-for-all, since they end up in an href on a public page.
 */
const STORE_PROTOCOLS = new Set(['http:', 'https:', 'market:', 'itms-apps:', 'itms:']);

/** A store URL when its scheme is one a store link may legitimately use. */
export function safeStoreUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = String(url).trim();
  if (!trimmed) return undefined;
  try {
    if (STORE_PROTOCOLS.has(new URL(trimmed).protocol.toLowerCase())) return trimmed;
  } catch {
    // Unparseable — not something we can vouch for.
  }
  return undefined;
}
