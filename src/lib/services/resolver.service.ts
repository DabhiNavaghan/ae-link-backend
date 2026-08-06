import { Logger } from '@/lib/logger';
import LinkModel from '@/lib/models/Link';
import { ILink, IPlatformOverrides, IStoreRedirect, StorePlatform } from '@/types';

const logger = Logger.child({ service: 'ResolverService' });

/**
 * Collapse a query key to its bare letters and digits, so the spelling a
 * caller happens to use never decides whether we understand them. Every
 * control param below is matched this way: `deepLink`, `deeplink`,
 * `deep_link`, `deep-link` and `DEEP_LINK` are all the same key.
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The dynamic destination for this click — any spelling of "deep link". */
export function isDeepLinkKey(key: string): boolean {
  return normalizeKey(key) === 'deeplink';
}

/**
 * Query params that turn app-store navigation off for a single click, without
 * editing the link. `no_app_redirect=1` disables the store; `storeRedirect=0`
 * does the same; `storeRedirect=1` forces it back on for a link that has the
 * toggle switched off.
 */
const STORE_OFF_KEY = 'noappredirect';
const STORE_FLAG_KEY = 'storeredirect';

/** True for any spelling of the store-redirect override params. */
export function isStoreRedirectKey(key: string): boolean {
  const k = normalizeKey(key);
  return k === STORE_OFF_KEY || k === STORE_FLAG_KEY;
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function isFalsy(value: string | undefined): boolean {
  if (value === undefined) return false;
  const v = value.toLowerCase();
  return v === '0' || v === 'false' || v === 'no' || v === 'off';
}

/**
 * Service for resolving links and handling platform-specific routing
 */
export class ResolverService {
  /**
   * Resolve a short code to a full link
   */
  static async resolveShortCode(shortCode: string): Promise<ILink | null> {
    try {
      const link = await LinkModel.findOne({
        shortCode,
        isActive: true,
      });

      // Check expiration
      if (link && link.expiresAt && link.expiresAt < new Date()) {
        logger.debug({ shortCode }, 'Link has expired');
        return null;
      }

      return link;
    } catch (error) {
      logger.error({ error: String(error), shortCode }, 'Resolve short code error');
      return null;
    }
  }

  /**
   * Get the destination URL for a specific platform
   */
  static getDestinationUrl(
    link: ILink,
    platform: 'android' | 'ios' | 'web'
  ): string {
    // Check platform overrides first
    const override = link.platformOverrides?.[platform];
    if (override?.url) {
      return override.url;
    }

    // Fallback to default destination
    return link.destinationUrl;
  }

  /**
   * Get the fallback URL for a platform (store URL)
   */
  static getFallbackUrl(
    link: ILink,
    platform: 'android' | 'ios'
  ): string | undefined {
    return link.platformOverrides?.[platform]?.fallback;
  }

  /**
   * Whether this click is allowed to end at the app store, for the audience
   * actually being served: `mobile` covers Android and iOS, `web` covers
   * desktop browsers.
   *
   * The link's stored toggle for that platform is the default; a query param
   * on the individual click overrides it, and applies to whichever platform is
   * asking. Links written before the toggle existed have no field at all,
   * which reads as enabled — the behaviour they already had.
   */
  static isStoreRedirectEnabled(
    link: { storeRedirect?: Partial<IStoreRedirect> },
    queryParams: Record<string, string> = {},
    platform: StorePlatform = 'mobile'
  ): boolean {
    // An explicit storeRedirect=0/1 is the strongest signal, so it is read
    // before the no_app_redirect shorthand.
    for (const [key, value] of Object.entries(queryParams)) {
      if (normalizeKey(key) !== STORE_FLAG_KEY) continue;
      if (isFalsy(value)) return false;
      if (isTruthy(value)) return true;
    }
    for (const [key, value] of Object.entries(queryParams)) {
      if (normalizeKey(key) === STORE_OFF_KEY && isTruthy(value)) return false;
    }
    return link.storeRedirect?.[platform] !== false;
  }

  /**
   * The dynamic destination carried by this click, under whichever spelling of
   * `deepLink` the caller used. First match wins when several are present.
   */
  static getDeepLinkParam(
    queryParams: Record<string, string> = {}
  ): string | undefined {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value && isDeepLinkKey(key)) return value;
    }
    return undefined;
  }

  /**
   * The URL to open in the browser when the app did not take the link and the
   * store is off limits.
   *
   * The dynamic `deepLink` of this click wins over everything: it is the whole
   * point of a dynamic link that the same short code lands on a different page
   * per click, and a static web override would silently discard it. Falls back
   * to the link's stored destination, then to the static web override.
   *
   * Returns undefined when the link has no web destination of any kind — the
   * caller must keep sending those clicks to the store rather than nowhere.
   */
  static getWebFallbackUrl(
    link: { destinationUrl?: string; platformOverrides?: IPlatformOverrides },
    dynamicDeepLinkUrl?: string
  ): string | undefined {
    const candidates = [
      dynamicDeepLinkUrl,
      link.destinationUrl,
      link.platformOverrides?.web?.url,
    ];

    for (const candidate of candidates) {
      if (candidate && /^https?:\/\//i.test(candidate)) return candidate;
    }

    return undefined;
  }

  /**
   * Build deep link with parameters
   */
  static buildDeepLink(
    baseUrl: string,
    params: Record<string, any>
  ): string {
    const url = new URL(baseUrl);

    // Add parameters as query string
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    }

    return url.toString();
  }

  /**
   * Build Android App Link Intent URL
   */
  static buildAndroidIntent(
    url: string,
    packageName: string
  ): string {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname + urlObj.search;

      return `intent://${urlObj.hostname}${path}#Intent;scheme=https;package=${packageName};end`;
    } catch {
      // Fallback if URL parsing fails
      return `intent://${url}#Intent;scheme=https;package=${packageName};end`;
    }
  }
}

export default ResolverService;
