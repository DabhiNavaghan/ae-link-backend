export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import CampaignService from '@/lib/services/campaign.service';
import { UpdateCampaignDto } from '@/types';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import { Types } from 'mongoose';

const logger = Logger.child({ route: 'campaigns-single' });

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

    const campaign = await CampaignService.getCampaign(params.id);

    if (!campaign || campaign.tenantId.toString() !== auth.tenantId) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Campaign')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    const response = NextResponse.json(
      successResponse(campaign),
      { status: 200 }
    );
    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Get campaign error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}

export async function PUT(
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

    const campaign = await CampaignService.getCampaign(params.id);
    if (!campaign || campaign.tenantId.toString() !== auth.tenantId) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Campaign')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    const body: UpdateCampaignDto = await request.json();
    const updated = await CampaignService.updateCampaign(params.id, body);

    if (!updated) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Campaign')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    const response = NextResponse.json(
      successResponse(updated),
      { status: 200 }
    );
    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Update campaign error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}

export async function DELETE(
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

    const campaign = await CampaignService.getCampaign(params.id);
    if (!campaign || campaign.tenantId.toString() !== auth.tenantId) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Campaign')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    await CampaignService.deleteCampaign(params.id);

    const response = NextResponse.json(
      successResponse({ deleted: true }),
      { status: 200 }
    );
    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Delete campaign error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
