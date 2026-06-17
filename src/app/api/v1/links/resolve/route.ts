import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import LinkService from '@/lib/services/link.service';
import ClickModel from '@/lib/models/Click';
import { DeviceDetector } from '@/lib/services/device-detector';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

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
    let deepLinkUrl = queryParams.deepLink || queryParams.deep_link;
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
    const effectiveDestinationUrl =
      deepLinkUrl && !link.destinationUrl
        ? deepLinkUrl
        : link.destinationUrl;

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

    const skipKeys = new Set(['deepLink', 'deep_link', ...Object.keys(paramMap)]);
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

      const updatedClick = await ClickModel.findOneAndUpdate(
        {
          linkId: link._id,
          tenantId: auth.tenantId,
          createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
        {
          $set: {
            actionTaken: 'app_opened',
            isAppInstalled: true,
            ...(resolveMetadata && { metadata: resolveMetadata }),
          },
        },
        { sort: { createdAt: -1 } }
      );

      // No recent click found — universal link or app link bypassed the redirect
      // page entirely, so the click was never recorded. Create one now.
      if (!updatedClick) {
        const userAgent = request.headers.get('user-agent') || '';
        const ip =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          '127.0.0.1';

        const detector = new DeviceDetector(userAgent);
        const deviceInfo = detector.detect();

        const newClick = new ClickModel({
          linkId: link._id,
          tenantId: link.tenantId,
          ipAddress: ip,
          userAgent,
          referer: '',
          channel: 'direct',
          device: deviceInfo,
          geo: {},
          isAppInstalled: true,
          actionTaken: 'app_opened',
          ...(resolveMetadata && { metadata: resolveMetadata }),
        });
        await newClick.save();
        await LinkService.incrementClickCount(link._id.toString());
        logger.info({ clickId: newClick._id, linkId: link._id }, 'Created app_opened click (universal link bypass)');
      }
    } catch (updateErr) {
      logger.debug({ error: String(updateErr) }, 'Click action update failed');
    }

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
