import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import LinkService from '@/lib/services/link.service';
import ClickModel from '@/lib/models/Click';
import TenantModel from '@/lib/models/Tenant';
import AppModel from '@/lib/models/App';
import { DeviceDetector } from '@/lib/services/device-detector';
import { lookupGeo } from '@/lib/services/geo.service';
import { Logger } from '@/lib/logger';
import { emitLiveEvent } from '@/lib/services/emit-live-event';
import RedirectPage from '@/components/RedirectPage';
import { fetchOgMeta } from '@/lib/services/og-fetch.service';
import { ClickChannel } from '@/types';

/**
 * Auto-detect channel from referer URL and UTM params
 */
function detectChannel(referer: string, utmSource?: string, utmMedium?: string): ClickChannel {
  const ref = (referer || '').toLowerCase();
  const src = (utmSource || '').toLowerCase();
  const med = (utmMedium || '').toLowerCase();

  // UTM source takes priority
  if (src.includes('whatsapp') || med === 'whatsapp') return 'whatsapp';
  if (src.includes('email') || med === 'email') return 'email';
  if (src === 'qr' || med === 'qr') return 'qr';
  if (src.includes('instagram') || src === 'ig') return 'instagram';
  if (src.includes('sms') || med === 'sms') return 'sms';
  if (src.includes('push') || med === 'push') return 'push';
  if (src.includes('facebook') || src === 'fb') return 'facebook';
  if (src.includes('twitter') || src === 'x.com') return 'twitter';
  if (src.includes('tiktok')) return 'tiktok';
  if (src.includes('youtube') || src === 'yt') return 'youtube';

  // Fallback to referer detection
  if (ref.includes('whatsapp') || ref.includes('wa.me')) return 'whatsapp';
  if (ref.includes('mail.google') || ref.includes('outlook') || ref.includes('yahoo.com/mail')) return 'email';
  if (ref.includes('instagram.com') || ref.includes('l.instagram')) return 'instagram';
  if (ref.includes('facebook.com') || ref.includes('fb.com') || ref.includes('l.facebook')) return 'facebook';
  if (ref.includes('twitter.com') || ref.includes('t.co') || ref.includes('x.com')) return 'twitter';
  if (ref.includes('tiktok.com')) return 'tiktok';
  if (ref.includes('youtube.com') || ref.includes('youtu.be')) return 'youtube';

  // If there's a referer but we couldn't match it, it's web
  if (ref && ref.length > 0) return 'web';

  return 'direct';
}

const logger = Logger.child({ page: 'redirect' });

interface Params {
  shortCode: string;
}

// Paths that must never be treated as short codes.
// Browsers request these automatically on every page load.
const SYSTEM_PATHS = new Set([
  'favicon.ico',
  'favicon.png',
  'robots.txt',
  'sitemap.xml',
  'manifest.json',
  'sw.js',
  'service-worker.js',
  'apple-touch-icon.png',
  'apple-touch-icon-precomposed.png',
]);

const STATIC_EXTENSIONS = /\.(ico|png|jpg|jpeg|gif|svg|webp|avif|css|js|woff|woff2|ttf|eot|map|txt|xml|json)$/i;

/**
 * Resolve short link and perform server-side click recording.
 *
 * Supports dynamic query-param deep links:
 *   /mgo109n?deepLink=https://allevents.in/event/xyz&ref=eventlist&action=view_event
 *
 * The `deepLink` query param becomes the destinationUrl when the link
 * itself has no destination stored. All other query params are merged
 * into the link's params and stored in the click record for analytics.
 */
export default async function ResolvePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  try {
    const { shortCode } = params;

    // Immediately reject known system/static asset paths — do not query DB.
    if (SYSTEM_PATHS.has(shortCode) || STATIC_EXTENSIONS.test(shortCode)) {
      notFound();
    }

    await connectDB();

    // Resolve link by short code
    const link = await LinkService.getLinkByShortCode(shortCode);

    if (!link) {
      logger.warn({ shortCode }, 'Link not found');
      notFound();
    }

    // ── Merge URL query params with stored link data ──
    // Flatten searchParams (Next.js may give string[] for repeated keys)
    const queryParams: Record<string, string> = {};
    for (const [key, val] of Object.entries(searchParams)) {
      if (val) queryParams[key] = Array.isArray(val) ? val[0] : val;
    }

    const linkData = link.toObject ? link.toObject() : (link as any);
    const storedParams = linkData.params || {};

    // deepLink query param → becomes destinationUrl if link has none.
    // If the value is a relative path (starts with /), reconstruct the
    // full URL using the referer origin or the link's stored destination.
    let deepLinkUrl = queryParams.deepLink || queryParams.deep_link || queryParams.deeplink;
    if (deepLinkUrl && !deepLinkUrl.startsWith('http')) {
      // Try to get the origin from the referer header
      const earlyReferer = headers().get('referer') || '';
      let baseOrigin = '';
      try {
        if (earlyReferer) baseOrigin = new URL(earlyReferer).origin;
      } catch {}
      // Fallback: extract origin from the link's stored destinationUrl
      if (!baseOrigin && linkData.destinationUrl) {
        try { baseOrigin = new URL(linkData.destinationUrl).origin; } catch {}
      }
      if (baseOrigin) {
        deepLinkUrl = deepLinkUrl.startsWith('/')
          ? `${baseOrigin}${deepLinkUrl}`
          : `${baseOrigin}/${deepLinkUrl}`;
      }
    }
    // deepLink param ALWAYS overrides stored destination when present —
    // this is the core dynamic deep-linking feature.
    const effectiveDestinationUrl = deepLinkUrl || linkData.destinationUrl;

    // Merge stored params with query params (query overrides stored)
    // Map both snake_case and camelCase to our camelCase keys
    const paramMap: Record<string, string> = {
      utm_source: 'utmSource', utmSource: 'utmSource',
      utm_medium: 'utmMedium', utmMedium: 'utmMedium',
      utm_campaign: 'utmCampaign', utmCampaign: 'utmCampaign',
      utm_term: 'utmTerm', utmTerm: 'utmTerm',
      utm_content: 'utmContent', utmContent: 'utmContent',
      event_id: 'eventId', eventId: 'eventId',
      action: 'action',
      user_email: 'userEmail', userEmail: 'userEmail',
      user_id: 'userId', userId: 'userId',
      coupon_code: 'couponCode', couponCode: 'couponCode',
      referral_code: 'referralCode', referralCode: 'referralCode',
      ref: 'ref',
    };

    const skipKeys = new Set(['deepLink', 'deep_link', 'deeplink', ...Object.keys(paramMap)]);
    const mergedParams: Record<string, any> = { ...storedParams };

    // Apply known param overrides from query
    for (const [qKey, qVal] of Object.entries(queryParams)) {
      const mappedKey = paramMap[qKey];
      if (mappedKey && qVal) {
        mergedParams[mappedKey] = qVal;
      }
    }

    // Any remaining query params → store under custom
    const customFromUrl: Record<string, string> = {};
    for (const [qKey, qVal] of Object.entries(queryParams)) {
      if (!skipKeys.has(qKey) && !paramMap[qKey] && qVal) {
        customFromUrl[qKey] = qVal;
      }
    }
    if (Object.keys(customFromUrl).length > 0) {
      mergedParams.custom = { ...(storedParams.custom || {}), ...customFromUrl };
    }

    // Get real request headers
    const headersList = headers();
    const userAgent = headersList.get('user-agent') || '';
    const referer = headersList.get('referer') || '';
    // Try all common reverse-proxy IP headers (OVH FaaS, Nginx, Cloudflare, etc.)
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      headersList.get('cf-connecting-ip') ||
      headersList.get('x-client-ip') ||
      '127.0.0.1';
    logger.debug({ ip, fwd: headersList.get('x-forwarded-for'), realIp: headersList.get('x-real-ip') }, 'Resolved client IP');

    // Detect device
    const detector = new DeviceDetector(userAgent);
    const deviceInfo = detector.detect();
    const isMobile = detector.isMobile();

    // Get store URLs — prefer App model if link has appId, fallback to tenant config
    const tenant = await TenantModel.findById(link.tenantId).lean();
    let storeUrls = {
      android: 'https://play.google.com/store/apps/details?id=com.amitech.allevents',
      ios: 'https://apps.apple.com/app/id488116646',
    };
    // Android package name — needed for intent:// URLs
    let androidPackage: string | undefined = 'com.amitech.allevents'; // default

    if (linkData.appId) {
      const app = await AppModel.findById(linkData.appId).lean();
      if (app) {
        storeUrls = {
          android: app.android?.storeUrl || storeUrls.android,
          ios: app.ios?.storeUrl || storeUrls.ios,
        };
        if (app.android?.package) {
          androidPackage = app.android.package;
        }
      }
    } else if (tenant?.app) {
      storeUrls = {
        android: tenant.app.android?.storeUrl || storeUrls.android,
        ios: tenant.app.ios?.storeUrl || storeUrls.ios,
      };
    }

    // Record click — include query params as metadata for analytics
    let clickId: string | undefined = undefined;

    // Skip recording for bots and link-preview crawlers (e.g. WhatsApp,
    // Telegram, Facebook preview agents). These hit the URL when a user
    // *pastes* a link, before any human click has occurred, and would
    // pollute analytics with fake WEB_FALLBACK entries.
    const isBot = detector.isBot();

    if (isBot) {
      logger.debug({ shortCode, userAgent }, 'Bot/crawler — skip click recording');
    }

    if (!isBot) try {
      const channel = detectChannel(
        referer,
        mergedParams.utmSource,
        mergedParams.utmMedium
      );

      // Build flat metadata for analytics aggregation.
      // Each tracking param is stored at the top level so MongoDB
      // can aggregate on metadata.ref, metadata.utmSource etc. directly.
      const hasQueryParams = Object.keys(queryParams).length > 0;
      let clickMetadata: Record<string, any> | undefined = undefined;

      if (hasQueryParams) {
        clickMetadata = {};
        // Deep link destination URL
        if (deepLinkUrl) clickMetadata.deepLink = deepLinkUrl;
        // Known tracking params — flat at top level
        if (mergedParams.ref) clickMetadata.ref = mergedParams.ref;
        if (mergedParams.utmSource) clickMetadata.utmSource = mergedParams.utmSource;
        if (mergedParams.utmMedium) clickMetadata.utmMedium = mergedParams.utmMedium;
        if (mergedParams.utmCampaign) clickMetadata.utmCampaign = mergedParams.utmCampaign;
        if (mergedParams.utmTerm) clickMetadata.utmTerm = mergedParams.utmTerm;
        if (mergedParams.utmContent) clickMetadata.utmContent = mergedParams.utmContent;
        if (mergedParams.action) clickMetadata.action = mergedParams.action;
        if (mergedParams.eventId) clickMetadata.eventId = mergedParams.eventId;
        // Custom params (unknown keys like no_app_redirect etc.)
        if (mergedParams.custom && Object.keys(mergedParams.custom).length > 0) {
          clickMetadata.custom = mergedParams.custom;
        }
        // Raw query string for debugging
        clickMetadata.rawQuery = queryParams;
      }

      // Deduplicate: skip if an identical click was recorded in the
      // last 30 seconds (Next.js SSR can invoke the page component
      // more than once for the same request).
      const dedupeWindow = new Date(Date.now() - 30_000);
      const existingClick = await ClickModel.findOne({
        linkId: link._id,
        ipAddress: ip,
        createdAt: { $gte: dedupeWindow },
      }).select('_id').lean();

      // Lookup geo BEFORE dedup check so it's available for live events
      const geo = await lookupGeo(ip);

      if (existingClick) {
        clickId = existingClick._id.toString();
        logger.debug({ clickId, shortCode }, 'Duplicate click suppressed');
      } else {
        const click = new ClickModel({
          linkId: link._id,
          tenantId: link.tenantId,
          ipAddress: ip,
          userAgent: userAgent,
          referer: referer,
          channel,
          device: deviceInfo,
          geo,
          isAppInstalled: false,
          actionTaken: isMobile ? 'store_redirect' : 'web_fallback',
          ...(clickMetadata && { metadata: clickMetadata }),
        });

        await click.save();
        clickId = click._id.toString();

        await LinkService.incrementClickCount(link._id.toString());
      }

      // Emit live events for real-time dashboard (file-based IPC → watcher fans out to SSE)
      const eventBase = {
        linkId: link._id.toString(),
        linkTitle: linkData.title || shortCode,
        shortCode,
        tenantId: link.tenantId.toString(),
        device: {
          os: deviceInfo.os,
          browser: deviceInfo.browser,
          type: deviceInfo.type,
        },
        geo: {
          country: geo?.country || undefined,
          city: geo?.city || undefined,
        },
        metadata: {
          clickId,
          channel,
          deepLink: deepLinkUrl || undefined,
          destinationUrl: effectiveDestinationUrl || linkData.destinationUrl || undefined,
          redirectUrl: effectiveDestinationUrl
            || linkData.destinationUrl
            || (deviceInfo.os === 'ios' ? storeUrls.ios : storeUrls.android),
          referer: referer || undefined,
          ip,
        },
      };

      // 1. Always emit a click event (total clicks)
      // 2. Emit the outcome event (store_redirect on mobile, web_fallback on desktop)
      // File-based IPC — synchronous write to temp file, picked up by file watcher
      emitLiveEvent({ ...eventBase, type: 'click' });
      emitLiveEvent({ ...eventBase, type: isMobile ? 'store_redirect' : 'web_fallback' });

      logger.info(
        {
          linkId: link._id,
          shortCode,
          clickId,
          deviceOS: deviceInfo.os,
          deepLink: deepLinkUrl || undefined,
        },
        'Click recorded'
      );
    } catch (err) {
      logger.error({ error: err }, 'Click recording failed');
    }

    return (
      <RedirectPage
        shortCode={shortCode}
        linkId={link._id.toString()}
        link={{
          destinationUrl: effectiveDestinationUrl,
          params: mergedParams,
          platformOverrides: linkData.platformOverrides,
        }}
        deviceOS={deviceInfo.os}
        tenantId={link.tenantId.toString()}
        clickId={clickId}
        storeUrls={storeUrls}
        androidPackage={androidPackage}
      />
    );
  } catch (error) {
    logger.error({ error, shortCode: params.shortCode }, 'Resolve page error');
    notFound();
  }
}

/**
 * Resolve the effective destination URL for a link given its stored data and
 * the request's query params. Mirrors the deep-link logic in ResolvePage so
 * the social preview points at the same page the user will actually land on.
 */
function resolveDestinationUrl(
  linkData: any,
  searchParams: Record<string, string | string[] | undefined>
): string | undefined {
  const get = (k: string) => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };
  let deepLinkUrl = get('deepLink') || get('deep_link') || get('deeplink');
  if (deepLinkUrl && !deepLinkUrl.startsWith('http') && linkData?.destinationUrl) {
    try {
      const origin = new URL(linkData.destinationUrl).origin;
      deepLinkUrl = deepLinkUrl.startsWith('/')
        ? `${origin}${deepLinkUrl}`
        : `${origin}/${deepLinkUrl}`;
    } catch {}
  }
  // Priority: deepLink/destination → web fallback URL → nothing.
  return (
    deepLinkUrl ||
    linkData?.destinationUrl ||
    linkData?.platformOverrides?.web?.url ||
    undefined
  );
}

/**
 * Generate OG tags for sharing by mirroring the real destination page's
 * Open Graph metadata (title, description, image) instead of a generic card.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const fallback = {
    title: 'AllEvents',
    description: 'Opening link...',
  };

  try {
    await connectDB();

    const link = await LinkService.getLinkByShortCode(params.shortCode);
    if (!link) return fallback;

    const linkData = link.toObject ? link.toObject() : (link as any);
    const destinationUrl = resolveDestinationUrl(linkData, searchParams);

    // Only crawlers render the social card and need the scrape; skip the
    // network fetch for human clicks so the redirect's TTFB stays fast.
    const userAgent = headers().get('user-agent') || '';
    const isCrawler = new DeviceDetector(userAgent).isBot();

    const og =
      isCrawler && destinationUrl ? await fetchOgMeta(destinationUrl) : {};

    const title =
      og.title || linkData.title || 'AllEvents';
    const description =
      og.description ||
      (linkData.params?.action ? `${linkData.params.action}` : '') ||
      'Discover and book events on AllEvents';
    const image = og.image;
    const canonical = `${process.env.NEXT_PUBLIC_APP_URL || 'https://smartlink.apps.allevents.app'}/${params.shortCode}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        url: canonical,
        siteName: og.siteName || 'AllEvents',
        ...(image && { images: [{ url: image }] }),
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title,
        description,
        ...(image && { images: [image] }),
      },
    };
  } catch (error) {
    logger.error({ error }, 'Generate metadata error');
    return fallback;
  }
}
