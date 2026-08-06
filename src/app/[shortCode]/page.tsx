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
import { getClientIp } from '@/lib/get-client-ip';
import RedirectPage, { STORE_FALLBACK_PARAM } from '@/components/RedirectPage';
import ResolverService, { isDeepLinkKey, isStoreRedirectKey } from '@/lib/services/resolver.service';
import { safeHttpUrl } from '@/lib/utils/url';
import { fetchOgMeta } from '@/lib/services/og-fetch.service';
import AppInterstitial, { APP_INFO_PARAM } from '@/components/AppInterstitial';
import { ClickChannel, IAppInfo, StorePlatform } from '@/types';

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
 *
 * When app-store navigation is switched off for the link (or for this click
 * via `?no_app_redirect=1` / `?storeRedirect=0`), a device that does not have
 * the app installed opens that same deep link on the web instead of going to
 * the store. An installed app still intercepts the link natively first.
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

    // A browser bouncing back off our own Android intent, not a new click.
    // See STORE_FALLBACK_PARAM in RedirectPage for why this exists.
    const isStoreFallback = queryParams[STORE_FALLBACK_PARAM] === '1';

    const linkData = link.toObject ? link.toObject() : (link as any);
    const storedParams = linkData.params || {};

    // deepLink query param → becomes destinationUrl if link has none.
    // Any spelling is accepted (deepLink, deeplink, deep_link, deep-link…).
    // If the value is a relative path (starts with /), reconstruct the
    // full URL using the referer origin or the link's stored destination.
    let deepLinkUrl = ResolverService.getDeepLinkParam(queryParams);
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

    // Where a device without the app would land if the store is off. Preferring
    // this click's dynamic deepLink over any static web override is the point:
    // a dynamic link resolves somewhere different per click.
    const webFallbackUrl = ResolverService.getWebFallbackUrl(
      linkData,
      deepLinkUrl
    );

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

    // Note: the store-redirect override keys are deliberately NOT skipped —
    // they stay in `custom` so analytics can still see that a click asked to
    // bypass the store, and so the app receives them after a deferred match.
    // The deep link is skipped under any spelling: it is the destination, not
    // a tracking param, and it is already carried on its own.
    const skipKeys = new Set([
      STORE_FALLBACK_PARAM, APP_INFO_PARAM,
      ...Object.keys(paramMap),
    ]);
    const isSkippedKey = (key: string) => skipKeys.has(key) || isDeepLinkKey(key);
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
      if (!isSkippedKey(qKey) && !paramMap[qKey] && qVal) {
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
    const ip = getClientIp(headersList) || '127.0.0.1';
    logger.debug({ ip, cfIp: headersList.get('cf-connecting-ip'), fwd: headersList.get('x-forwarded-for'), realIp: headersList.get('x-real-ip') }, 'Resolved client IP');

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
    // Marketing copy for the interstitial, when this link has an app attached.
    let appName: string | undefined;
    let appInfo: IAppInfo | undefined;

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
        appName = app.name;
        appInfo = app.info;
      }
    } else if (tenant?.app) {
      storeUrls = {
        android: tenant.app.android?.storeUrl || storeUrls.android,
        ios: tenant.app.ios?.storeUrl || storeUrls.ios,
      };
    }

    // ── App-store navigation ──
    // Phones and desktop are switched independently, and a query param on this
    // click overrides whichever one applies. With the store off and nothing on
    // the web to open, the click lands on the app-info page rather than being
    // pushed to a store listing it was explicitly told not to use.
    const storePlatform: StorePlatform = isMobile ? 'mobile' : 'web';
    const storeRedirectEnabled = ResolverService.isStoreRedirectEnabled(
      linkData,
      queryParams,
      storePlatform
    );
    // Store off and nothing on the web to open → the app info page is where
    // this click ends up. *When* it gets there is decided below.
    const needsAppInfoPage = !storeRedirectEnabled && !webFallbackUrl;

    const origin = (() => {
      const host = headersList.get('host') || 'smartlink.apps.allevents.app';
      const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
      return `${isLocal ? 'http' : 'https'}://${host}`;
    })();

    // This same short link, minus the params that control *this* hop. The
    // interstitial encodes it into its QR, so scanning replays the click —
    // deep link, UTMs and all — through the normal flow on the phone. Carrying
    // the control params across would make the phone skip its own app-open
    // attempt, which is the one thing the scan is for.
    const qrQuery = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (key === STORE_FALLBACK_PARAM || key === APP_INFO_PARAM) continue;
      if (isStoreRedirectKey(key)) continue;
      qrQuery.set(key, value);
    }
    const qrString = qrQuery.toString();
    const smartLinkUrl = `${origin}/${shortCode}${qrString ? `?${qrString}` : ''}`;

    // Where an app-open attempt lands when the app declines it.
    const appInfoUrl = (() => {
      const url = new URL(`${origin}/${shortCode}`);
      for (const [key, value] of Object.entries(queryParams)) {
        if (key === STORE_FALLBACK_PARAM) continue;
        url.searchParams.set(key, value);
      }
      url.searchParams.set(APP_INFO_PARAM, '1');
      return url.toString();
    })();

    // ── When to show the app info page rather than try the app first ──
    // Trying the app costs nothing when it is not installed (the attempt just
    // falls through), but skipping it strands every user who *does* have the
    // app on a "get the app" screen. So the interstitial renders only once no
    // app-open attempt is left to make:
    //   · this load is already the fallback of one (_appinfo), or
    //   · a browser bounced off our own intent (_slfb), or
    //   · this device has no way to open the app from a web page at all.
    // Android always has the intent path; iOS only when the link carries a
    // custom scheme, since Universal Links get their chance before we load.
    const isCustomScheme = (url?: string) => Boolean(url && !url.startsWith('http'));
    const canAttemptAppOpen =
      deviceInfo.os === 'android'
        ? Boolean(androidPackage) || isCustomScheme(linkData.platformOverrides?.android?.url)
        : deviceInfo.os === 'ios'
          ? isCustomScheme(linkData.platformOverrides?.ios?.url)
          : false;

    const isAppInfoHop = queryParams[APP_INFO_PARAM] === '1';
    const showInterstitial =
      isAppInfoHop ||
      (needsAppInfoPage && (!canAttemptAppOpen || isStoreFallback));

    // When the app *can* still be tried, the redirect page runs as usual and
    // simply falls back here instead of to a store it was told not to use.
    const noAppFallbackUrl = needsAppInfoPage ? appInfoUrl : webFallbackUrl;

    if (needsAppInfoPage) {
      logger.info(
        { shortCode, platform: storePlatform, showInterstitial, canAttemptAppOpen },
        showInterstitial
          ? 'Store navigation off with no web destination — serving app info page'
          : 'Store navigation off with no web destination — trying the app first'
      );
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

    if (isStoreFallback) {
      logger.debug({ shortCode }, 'Intent store fallback — skip click recording');
    }

    // Same reasoning as the store fallback: the load that fired the app-open
    // attempt already recorded this click, and this is its second hop.
    if (isAppInfoHop) {
      logger.debug({ shortCode }, 'App info fallback hop — skip click recording');
    }

    if (!isBot && !isStoreFallback && !isAppInfoHop) try {
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

      const isDuplicate = Boolean(existingClick);

      // With the store off, a mobile click that misses the app ends on the web
      // just like a desktop one — recording it as a store redirect would count
      // an install intent that can never happen.
      const isStoreBoundClick = isMobile && storeRedirectEnabled;

      // Only the non-duplicate path consumes geo (the click document and the
      // live events). Skipping it here avoids an ipapi.co round trip — and a
      // slice of that provider's rate limit — on every suppressed hit.
      const geo = isDuplicate ? undefined : await lookupGeo(ip, headersList);

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
          actionTaken: isStoreBoundClick ? 'store_redirect' : 'web_fallback',
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
          redirectUrl: storeRedirectEnabled
            ? (effectiveDestinationUrl
              || linkData.destinationUrl
              || (deviceInfo.os === 'ios' ? storeUrls.ios : storeUrls.android))
            // With the store off this is the web destination, or the app info
            // page when the link has none.
            : noAppFallbackUrl,
          referer: referer || undefined,
          ip,
        },
      };

      // 1. Emit a click event (total clicks)
      // 2. Emit the outcome event (store_redirect on mobile, web_fallback on desktop)
      // File-based IPC — synchronous write to temp file, picked up by file watcher
      //
      // Skipped for deduplicated hits: the click was never persisted and
      // clickCount was never incremented, so emitting here would make the
      // live feed (and its counters) show several clicks + store redirects
      // for a single recorded click.
      if (!isDuplicate) {
        emitLiveEvent({ ...eventBase, type: 'click' });
        emitLiveEvent({ ...eventBase, type: isStoreBoundClick ? 'store_redirect' : 'web_fallback' });
      }

      logger.info(
        {
          linkId: link._id,
          shortCode,
          clickId,
          deviceOS: deviceInfo.os,
          deepLink: deepLinkUrl || undefined,
        },
        isDuplicate ? 'Click deduplicated' : 'Click recorded'
      );
    } catch (err) {
      logger.error({ error: err }, 'Click recording failed');
    }

    // The app is either already installed and took the link, or there is no
    // attempt left to make. Either way there is nothing to redirect to and the
    // store is off limits, so show the app instead of a dead end.
    if (showInterstitial) {
      return (
        <AppInterstitial
          appName={appName}
          info={appInfo}
          storeUrls={storeUrls}
          smartLinkUrl={smartLinkUrl}
          deviceOS={deviceInfo.os}
          linkId={link._id.toString()}
          tenantId={link.tenantId.toString()}
          clickId={clickId}
          destinationUrl={effectiveDestinationUrl}
          params={mergedParams}
          isAppOpenFallback={isAppInfoHop}
        />
      );
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
        isStoreFallback={isStoreFallback}
        storeRedirectEnabled={storeRedirectEnabled}
        webFallbackUrl={noAppFallbackUrl}
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
  // Same any-spelling deep-link lookup as the page itself, so the social card
  // and the landing page can never disagree about the destination.
  const flat: Record<string, string> = {};
  for (const [key, val] of Object.entries(searchParams)) {
    if (val) flat[key] = Array.isArray(val) ? val[0] : val;
  }
  let deepLinkUrl = ResolverService.getDeepLinkParam(flat);
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
  // A short link is a redirect endpoint, not a page. Keeping it out of search
  // results also keeps whatever a click carried in its query string — deep
  // links, user ids, coupon codes — from being indexed. Social scrapers build
  // previews regardless of this, so sharing is unaffected.
  const noIndex = { robots: { index: false, follow: false } };

  const fallback = {
    ...noIndex,
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

    // With no destination to scrape and the store switched off, this link
    // renders the app info page — so the card should describe the app rather
    // than fall back to generic copy. Only reached when there is genuinely no
    // destination, so it costs a query on app-promo links alone.
    let appCard: { title?: string; description?: string; image?: string } = {};
    if (!destinationUrl && linkData.appId && linkData.storeRedirect?.web === false) {
      try {
        const app = await AppModel.findById(linkData.appId).lean();
        if (app) {
          appCard = {
            title: app.name,
            description: app.info?.tagline || app.info?.description,
            image: safeHttpUrl(app.info?.iconUrl),
          };
        }
      } catch {
        // Card copy is not worth failing metadata over.
      }
    }

    const title =
      og.title || appCard.title || linkData.title || 'AllEvents';
    const description =
      og.description ||
      appCard.description ||
      (linkData.params?.action ? `${linkData.params.action}` : '') ||
      'Discover and book events on AllEvents';
    const image = og.image || appCard.image;
    const canonical = `${process.env.NEXT_PUBLIC_APP_URL || 'https://smartlink.apps.allevents.app'}/${params.shortCode}`;

    return {
      ...noIndex,
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
