export const maxDuration = 15;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { authenticateIngest } from '@/lib/middleware/ingest-auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors, handleCorsPreFlight } from '@/lib/middleware/cors';
import { logout } from '@/lib/services/identity.service';
import { successResponse, errorResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import { LIMITS, safeString } from '@/lib/utils/event-validation';

const logger = Logger.child({ route: 'identify-logout' });

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request) ?? new NextResponse(null, { status: 204 });
}

/**
 * POST /api/v1/identify/logout
 *
 *   { "deviceId": "a3f…" }
 *
 * Ends the session on a device: bumps the identity epoch, clears the userId.
 *
 * It deliberately does NOT touch deviceId. Rotating the device id on logout
 * would sever install attribution and make the next launch look like a fresh
 * install, re-counting it — corrupting numbers the platform currently gets
 * right. The epoch is what draws the line: the next person to sign in on this
 * device backfills only from their own epoch forward, so the previous user
 * keeps their history and the new one does not inherit it.
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
  } catch {
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR('Database connection failed'), {
        status: 500,
      })
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return applyCors(
      request,
      NextResponse.json(Errors.BAD_REQUEST('Could not read request body'), {
        status: 400,
      })
    );
  }

  const auth = await authenticateIngest(request, rawBody);
  if (!auth.ok) {
    const status = auth.failure.code === 'INVALID_SIGNATURE' ? 403 : 401;
    return applyCors(
      request,
      NextResponse.json(errorResponse(auth.failure.code, auth.failure.message), {
        status,
      })
    );
  }

  const { allowed } = checkRateLimit(request, auth.context.tenantId);
  if (!allowed) {
    return applyCors(
      request,
      NextResponse.json(Errors.RATE_LIMIT(), { status: 429 })
    );
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return applyCors(
      request,
      NextResponse.json(Errors.BAD_REQUEST('Body must be valid JSON'), {
        status: 400,
      })
    );
  }

  const deviceId = safeString(body?.deviceId, LIMITS.DEVICE_ID_MAX_LENGTH);
  if (!deviceId) {
    return applyCors(
      request,
      NextResponse.json(
        Errors.VALIDATION_ERROR({ deviceId: 'Required' }),
        { status: 400 }
      )
    );
  }

  try {
    const result = await logout(auth.context.tenantId, deviceId);
    return applyCors(
      request,
      NextResponse.json(
        successResponse({ deviceId: result.deviceId, epoch: result.epoch }),
        { status: 200 }
      )
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(
      { message: err.message, tenantId: auth.context.tenantId },
      'Logout failed'
    );
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR(), { status: 500 })
    );
  }
}
