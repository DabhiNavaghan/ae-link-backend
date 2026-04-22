import { Logger } from '@/lib/logger';
import LinkModel from '@/lib/models/Link';
import { ILink } from '@/types';

const logger = Logger.child({ service: 'ResolverService' });

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
