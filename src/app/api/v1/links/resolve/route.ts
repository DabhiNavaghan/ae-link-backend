import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import LinkService from '@/lib/services/link.service';
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

    // Get full campaign data if link has a campaign
    let campaign: any = null;
    if (link.campaignId) {
      try {
        const CampaignModel = (await import('@/lib/models/Campaign')).default;
        campaign = await CampaignModel.findById(link.campaignId).lean();
      } catch (_) {}
    }

    const params = (link as any).params || {};

    const response = NextResponse.json(
      successResponse({
        linkId: link._id,
        shortCode: link.shortCode,
        destinationUrl: link.destinationUrl,
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
          eventId: params.eventId || null,
          action: params.action || null,
          utmSource: params.utmSource || null,
          utmMedium: params.utmMedium || null,
          utmCampaign: params.utmCampaign || null,
          utmTerm: params.utmTerm || null,
          utmContent: params.utmContent || null,
          userEmail: params.userEmail || null,
          userId: params.userId || null,
          couponCode: params.couponCode || null,
          referralCode: params.referralCode || null,
          custom: params.custom || null,
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
