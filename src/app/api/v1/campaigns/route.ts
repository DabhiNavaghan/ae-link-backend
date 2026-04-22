import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import CampaignService from '@/lib/services/campaign.service';
import { CreateCampaignDto } from '@/types';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'campaigns-list' });

export async function GET(request: NextRequest) {
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

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as any;
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const { campaigns, total } = await CampaignService.listCampaigns(
      auth.tenantId,
      {
        status,
        limit,
        offset,
      }
    );

    const response = NextResponse.json(
      successResponse({ campaigns, total, limit, offset }),
      { status: 200 }
    );

    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Get campaigns error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}

export async function POST(request: NextRequest) {
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

    const body: CreateCampaignDto = await request.json();

    if (!body.name || !body.slug) {
      const errorRes = new NextResponse(
        JSON.stringify(
          Errors.VALIDATION_ERROR({
            name: 'Required',
            slug: 'Required',
          })
        ),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    const campaign = await CampaignService.createCampaign(auth.tenantId, body);

    const response = NextResponse.json(
      successResponse(campaign),
      { status: 201 }
    );

    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Create campaign error');

    if ((error as any).code === 11000) {
      const errorRes = new NextResponse(
        JSON.stringify(
          Errors.CONFLICT('Campaign slug already exists')
        ),
        { status: 409 }
      );
      return applyCors(request, errorRes);
    }

    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
