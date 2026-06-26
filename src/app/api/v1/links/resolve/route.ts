import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import LinkService from '@/lib/services/link.service';
import ClickModel from '@/lib/models/Click';
import { DeviceDetector } from '@/lib/services/device-detector';
import { lookupGeo } from '@/lib/services/geo.service';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import { liveEvents } from '@/lib/services/live-events';

const logger = Logger.child({ route: 'links-resolve' });

/**
 * GET /api/v1/links/resolve?shortCode=xGJEQJR
 *
 * Called by the Flutter SDK when the app is already installed and
 * the user clicks a SmartLink URL. The SDK extracts the short code
 * from the URL and calls this endpoint to get the full link data
 * (destination URL, params, event ID, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
  } catch (error) {
    return applyCors(
      request,
      new NextResponse(JSON.stringify(Errors.INTERNAL_ERROR()), { status: 500 })
    );
  }

  const auth = await requireAuth(request);
  if (!auth) {
    return applyCors(
      request,
      new NextResponse(JSON.stringify(Errors.UNAUTHORIZED()), { status: 401 })
    );
  }

  const { allowed } = checkRateLimit(request, auth.tenantId);
  if (!allowed) {
    return applyCors(
      request,
      new NextResponse(JSON.stringify(Errors.RATE_LIMIT()), { status: 429 })
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const shortCode = searchParams.get('shortCode');

    if (!shortCode) {
      return applyCors(
        request,
        new NextResponse(
          JSON.stringify(Errors.VALIDATION_ERROR({ shortCode: 'Required' })),
          { status: 400 }
        )
      );
    }

    const link = await LinkService.getLinkByShortCode(shortCode);

    if (!link) {
      return applyCors(
        request,
        new NextResponse(
          JSON.stringify(Errors.NOT_FOUND('Link')),
          { status: 404 }
        )
      );
    }

    // ── Merge URL query params with stored link data ──
    // The SDK forwards all query params from the original URL so we can
    // track them and return merged data.
    const queryParams: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      if (key !== 'shortCode') queryParams[key] = val;
    });

    const storedParams = (link as any).params || {};

    // deepLink query param → becomes destinationUrl if link has none.
    // If the value is a relative path, reconstruct the full URL.
    let deepLinkUrl = queryParams.deepLink || queryParams.deep_link || queryParams.deeplink;
    if (deepLinkUrl && !deepLinkUrl.startsWith('http')) {
      // Try to get origin from referer header
      const refererHeader = request.headers.get('referer') || '';
      let baseOrigin = '';
      try { if (refererHeader) baseOrigin = new URL(refererHeader).origin; } catch {}
      // Fallback: extract origin from the link's stored destinationUrl
      if (!baseOrigin && link.destinationUrl) {
        try { baseOrigin = new URL(link.destinationUrl).origin; } catch {}
      }
      if (baseOrigin) {
        deepLinkUrl = deepLinkUrl.startsWith('/')
          ? `${baseOrigin}${deepLinkUrl}`
          : `${baseOrigin}/${deepLinkUrl}`;
      }
    }
    // deepLink param ALWAYS overrides stored destination when present —
    // this is the core dynamic deep-linking feature.
    const effectiveDestinationUrl = deepLinkUrl || link.destinationUrl;

    // Merge stored params with query params (query overrides stored)
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

    for (const [qKey, qVal] of Object.entries(queryParams)) {
      const mappedKey = paramMap[qKey];
      if (mappedKey && qVal) mergedParams[mappedKey] = qVal;
    }

    // Unknown query params → custom
    const customFromUrl: Record<string, string> = {};
    for (const [qKey, qVal] of Object.entries(queryParams)) {
      if (!skipKeys.has(qKey) && !paramMap[qKey] && qVal) customFromUrl[qKey] = qVal;
    }
    if (Object.keys(customFromUrl).length > 0) {
      mergedParams.custom = { ...(storedParams.custom || {}), ...customFromUrl };
    }

    // Get full campaign data if link has a campaign
    let campaign: any = null;
    if (link.campaignId) {
      try {
        const CampaignModel = (await import('@/lib/models/Campaign')).default;
        campaign = await CampaignModel.findById(link.campaignId).lean();
      } catch (_) {}
    }

    // Extract request info for live event + potential new click
    const userAgent = request.headers.get('user-agent') || '';
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-client-ip') ||
      '127.0.0.1';
    const detector = new DeviceDetector(userAgent);
    const deviceInfo = detector.detect();
    const isSDK = /dart|flutter/i.test(userAgent);
    if (isSDK) deviceInfo.browser = 'app-sdk';
    const resolveGeo = await lookupGeo(ip);

    // Mark the most recent click for this link as app_opened + store metadata.
    // If no recent click exists (e.g. universal link bypassed the redirect page),
    // create a new app_opened click so analytics count it.
    try {
      const hasQueryParams = Object.keys(queryParams).length > 0;

      // Build flat metadata matching redirect page format
      let resolveMetadata: Record<string, any> | undefined = undefined;
      if (hasQueryParams) {
        resolveMetadata = {};
        if (deepLinkUrl) resolveMetadata.deepLink = deepLinkUrl;
        if (mergedParams.ref) resolveMetadata.ref = mergedParams.ref;
        if (mergedParams.utmSource) resolveMetadata.utmSource = mergedParams.utmSource;
        if (mergedParams.utmMedium) resolveMetadata.utmMedium = mergedParams.utmMedium;
        if (mergedParams.utmCampaign) resolveMetadata.utmCampaign = mergedParams.utmCampaign;
        if (mergedParams.utmTerm) resolveMetadata.utmTerm = mergedParams.utmTerm;
        if (mergedParams.utmContent) resolveMetadata.utmContent = mergedParams.utmContent;
        if (mergedParams.action) resolveMetadata.action = mergedParams.action;
        if (mergedParams.eventId) resolveMetadata.eventId = mergedParams.eventId;
        if (mergedParams.custom && Object.keys(mergedParams.custom).length > 0) {
          resolveMetadata.custom = mergedParams.custom;
        }
        resolveMetadata.rawQuery = queryParams;
      }

      // Use an aggregation-pipeline update so we can conditionally preserve
      // the original actionTaken.  If the click was a genuine store_redirect
      // (user went to the store, installed, then opened the app), we keep
      // actionTaken as 'store_redirect' and only flip isAppInstalled.  This
      // prevents the store-redirect count from shrinking after installs.
      // If actionTaken is anything else (e.g. the redirect page already
      // patched it to 'app_opened' because the app was already installed),
      // we leave it as-is.
      const updatedClick = await ClickModel.findOneAndUpdate(
        {
          linkId: link._id,
          tenantId: auth.tenantId,
          createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
        [
          {
            $set: {
              isAppInstalled: true,
              // Keep store_redirect (genuine store visit); otherwise set app_opened
              actionTaken: {
                $cond: [
                  { $eq: ['$actionTaken', 'store_redirect'] },
                  'store_redirect',
                  'app_opened',
                ],
              },
              ...(resolveMetadata ? { metadata: resolveMetadata } : {}),
            },
          },
        ],
        { sort: { createdAt: -1 } }
      );

      // No recent click found — universal link or app link bypassed the redirect
      // page entirely, so the click was never recorded. Create one now.
      if (!updatedClick) {
        const newClick = new ClickModel({
          linkId: link._id,
          tenantId: link.tenantId,
          ipAddress: ip,
          userAgent,
          referer: '',
          channel: isSDK ? 'app_link' : 'direct',
          device: deviceInfo,
          geo: resolveGeo,
          isAppInstalled: true,
          actionTaken: 'app_opened',
          ...(resolveMetadata && { metadata: resolveMetadata }),
        });
        await newClick.save();
        await LinkService.incrementClickCount(link._id.toString());
        logger.info({ clickId: newClick._id, linkId: link._id, isSDK }, 'Created app_opened click (universal link bypass)');
      }
    } catch (updateErr) {
      logger.debug({ error: String(updateErr) }, 'Click action update failed');
    }

    // Emit live event — this IS an app open (SDK resolved the link inside the app)
    liveEvents.emit({
      type: 'app_opened',
      linkId: link._id.toString(),
      linkTitle: (link as any).title || link.shortCode,
      shortCode: link.shortCode,
      tenantId: auth.tenantId,
      device: {
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        type: deviceInfo.type,
      },
      geo: {
        country: resolveGeo?.country || undefined,
        city: resolveGeo?.city || undefined,
      },
      metadata: {
        channel: isSDK ? 'app_link' : 'direct',
        deepLink: deepLinkUrl || undefined,
        destinationUrl: effectiveDestinationUrl,
        redirectUrl: effectiveDestinationUrl,
        referer: request.headers.get('referer') || undefined,
        ip,
        campaignName: campaign?.name,
      },
    });

    const response = NextResponse.json(
      successResponse({
        linkId: link._id,
        shortCode: link.shortCode,
        destinationUrl: effectiveDestinationUrl,
        linkType: link.linkType,
        campaignId: link.campaignId || null,
        campaignName: campaign?.name || null,
        campaign: campaign ? {
          name: campaign.name,
          slug: campaign.slug,
          description: campaign.description || null,
          status: campaign.status || null,
          startDate: campaign.startDate || null,
          endDate: campaign.endDate || null,
          metadata: campaign.metadata || {},
        } : null,
        params: {
          eventId: mergedParams.eventId || null,
          action: mergedParams.action || null,
          ref: mergedParams.ref || null,
          utmSource: mergedParams.utmSource || null,
          utmMedium: mergedParams.utmMedium || null,
          utmCampaign: mergedParams.utmCampaign || null,
          utmTerm: mergedParams.utmTerm || null,
          utmContent: mergedParams.utmContent || null,
          userEmail: mergedParams.userEmail || null,
          userId: mergedParams.userId || null,
          couponCode: mergedParams.couponCode || null,
          referralCode: mergedParams.referralCode || null,
          custom: mergedParams.custom || null,
        },
        platformOverrides: link.platformOverrides || {},
      }),
      { status: 200 }
    );

    return applyCors(request, response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message }, 'Link resolve error');
    return applyCors(
      request,
      new NextResponse(JSON.stringify(Errors.INTERNAL_ERROR()), { status: 500 })
    );
  }
}
