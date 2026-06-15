import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import LinkService from '@/lib/services/link.service';
import ClickModel from '@/lib/models/Click';
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

    // deepLink query param → becomes destinationUrl if link has none
    const deepLinkUrl = queryParams.deepLink || queryParams.deep_link;
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
    try {
      const hasQueryParams = Object.keys(queryParams).length > 0;
      await ClickModel.findOneAndUpdate(
        {
          linkId: link._id,
          tenantId: auth.tenantId,
          createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
        {
          $set: {
            actionTaken: 'app_opened',
            isAppInstalled: true,
            ...(hasQueryParams && {
              metadata: {
                queryParams,
                deepLink: deepLinkUrl || undefined,
              },
            }),
          },
        },
        { sort: { createdAt: -1 } }
      );
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
