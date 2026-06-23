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
import RedirectPage from '@/components/RedirectPage';
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
    let deepLinkUrl = queryParams.deepLink || queryParams.deep_link;
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
    const effectiveDestinationUrl =
      deepLinkUrl && !linkData.destinationUrl
        ? deepLinkUrl
        : linkData.destinationUrl;

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

    const skipKeys = new Set(['deepLink', 'deep_link', ...Object.keys(paramMap)]);
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
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      '127.0.0.1';

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

    if (linkData.appId) {
      const app = await AppModel.findById(linkData.appId).lean();
      if (app) {
        storeUrls = {
          android: app.android?.storeUrl || storeUrls.android,
          ios: app.ios?.storeUrl || storeUrls.ios,
        };
      }
    } else if (tenant?.app) {
      storeUrls = {
        android: tenant.app.android?.storeUrl || storeUrls.android,
        ios: tenant.app.ios?.storeUrl || storeUrls.ios,
      };
    }

    // Record click — include query params as metadata for analytics
    let clickId: string | undefined = undefined;
    try {
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

      // Geo lookup — fire and don't block redirect if it's slow
      const geo = await lookupGeo(ip);

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
      />
    );
  } catch (error) {
    logger.error({ error, shortCode: params.shortCode }, 'Resolve page error');
    notFound();
  }
}

/**
 * Generate metadata for the link (OG tags for sharing)
 */
export async function generateMetadata({ params }: { params: Params }) {
  try {
    await connectDB();

    const link = await LinkService.getLinkByShortCode(params.shortCode);

    if (!link) {
      return {
        title: 'AllEvents',
        description: 'Opening link...',
      };
    }

    const title = `AllEvents - ${link.params?.eventId || 'Link'}`;
    const description = link.params?.action || 'Opening link';

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://smartlink.vercel.app'}/${params.shortCode}`,
      },
    };
  } catch (error) {
    logger.error({ error }, 'Generate metadata error');

    return {
      title: 'AllEvents',
      description: 'Opening link...',
    };
  }
}
