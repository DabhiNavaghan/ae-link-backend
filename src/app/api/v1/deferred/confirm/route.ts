export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import DeferredService from '@/lib/services/deferred.service';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import { Types } from 'mongoose';

const logger = Logger.child({ route: 'deferred-confirm' });

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
    const body = await request.json();
    // Accept both camelCase and snake_case from Flutter SDK
    const deferredLinkId = body.deferredLinkId || body.deferred_link_id;
    const deviceId = body.deviceId || body.device_id;

    if (!deferredLinkId || !deviceId) {
      const errorRes = new NextResponse(
        JSON.stringify(
          Errors.VALIDATION_ERROR({
            deferredLinkId: 'Required',
            deviceId: 'Required',
          })
        ),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    if (!Types.ObjectId.isValid(deferredLinkId)) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.BAD_REQUEST('Invalid deferred link ID')),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    const deferredLink = await DeferredService.confirmDeferredLink(
      deferredLinkId,
      deviceId
    );

    if (!deferredLink) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Deferred link')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    const response = NextResponse.json(
      successResponse({
        confirmed: true,
        deferredLinkId: deferredLink._id,
        deviceId: deferredLink.deviceId,
      }),
      { status: 200 }
    );

    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Deferred confirm error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
