import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import AnalyticsService from '@/lib/services/analytics.service';
import CampaignService from '@/lib/services/campaign.service';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import { Types } from 'mongoose';

const logger = Logger.child({ route: 'analytics-campaigns' });

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
  } catch (error) {
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR('Database connection failed')),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }

  const auth = await requireAuth(request);

  if (!auth) {
    const errorRes = new NextResponse(
      JSON.stringify(Errors.UNAUTHORIZED()),
      { status: 401 }
    );
    return applyCors(request, errorRes);
  }

  const { allowed } = checkRateLimit(request, auth.tenantId);
  if (!allowed) {
    const errorRes = new NextResponse(
      JSON.stringify(Errors.RATE_LIMIT()),
      { status: 429 }
    );
    return applyCors(request, errorRes);
  }

  try {

    if (!Types.ObjectId.isValid(params.id)) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.BAD_REQUEST('Invalid campaign ID')),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    // Verify tenant ownership
    const campaign = await CampaignService.getCampaign(params.id);
    if (!campaign || campaign.tenantId.toString() !== auth.tenantId) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Campaign')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    const analytics = await AnalyticsService.getCampaignAnalytics(params.id);

    if (!analytics) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Campaign')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    const response = NextResponse.json(
      successResponse(analytics),
      { status: 200 }
    );

    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Get campaign analytics error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
