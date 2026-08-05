export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { authenticateIngest } from '@/lib/middleware/ingest-auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors, handleCorsPreFlight } from '@/lib/middleware/cors';
import { identify } from '@/lib/services/identity.service';
import { getTenantPolicy } from '@/lib/services/event.service';
import { liveEvents } from '@/lib/services/live-events';
import { successResponse, errorResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import { LIMITS, safeString } from '@/lib/utils/event-validation';
import { EventPlatform } from '@/types/events';

const logger = Logger.child({ route: 'identify' });

const VALID_PLATFORMS = ['android', 'ios', 'web', 'server', 'other'];

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request) ?? new NextResponse(null, { status: 204 });
}

/**
 * POST /api/v1/identify
 *
 *   { "userId": "u_88213", "deviceId": "a3f…",
 *     "traits": { "plan": "pro", "city": "Ahmedabad" },
 *     "email": "…" }
 *
 * Attaches a device to a person. Returns the identity's acquisition source —
 * which link and campaign brought this user in — and how many previously
 * anonymous events were backfilled onto them.
 *
 * Identity resolution is server-side by design. The SDK sends a userId; it does
 * not get to decide who someone is, and it never sends a userId on a plain
 * event — that is read from the device's server-held state.
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

  const userId = safeString(body?.userId, LIMITS.USER_ID_MAX_LENGTH);
  const deviceId = safeString(body?.deviceId, LIMITS.DEVICE_ID_MAX_LENGTH);

  if (!userId || !deviceId) {
    return applyCors(
      request,
      NextResponse.json(
        Errors.VALIDATION_ERROR({
          userId: !userId ? 'Required' : undefined,
          deviceId: !deviceId ? 'Required' : undefined,
        }),
        { status: 400 }
      )
    );
  }

  const rawPlatform = safeString(body?.platform, 16)?.toLowerCase();
  const platform = VALID_PLATFORMS.includes(rawPlatform || '')
    ? (rawPlatform as EventPlatform)
    : undefined;

  try {
    const policy = await getTenantPolicy(auth.context.tenantId);

    const result = await identify({
      tenantId: auth.context.tenantId,
      appId: auth.context.appId,
      userId,
      deviceId,
      traits: body?.traits,
      email: body?.email,
      platform,
      allowedTraitKeys: policy.allowedTraitKeys,
      storePlaintextEmail: policy.storePlaintextEmail,
      attributionWindowDays: policy.attributionWindowDays,
    });

    // Surface sign-ins in Live Tracking — this is the step that turns a device
    // funnel into a user funnel, and it is worth seeing happen.
    try {
      liveEvents.emit({
        type: 'identify',
        tenantId: auth.context.tenantId,
        linkId: result.acquisition?.linkId
          ? String(result.acquisition.linkId)
          : undefined,
        shortCode: result.acquisition?.shortCode,
        device: { os: platform },
        metadata: {
          userId,
          deviceId,
          epoch: result.epoch,
          isNewIdentity: result.isNewIdentity,
          backfilledEvents: result.backfilledEvents,
          acquisitionModel: result.acquisition?.model,
          campaign: result.acquisition?.campaign,
          source: result.acquisition?.source,
        },
      });
    } catch {
      // Live feed is decoration.
    }

    return applyCors(
      request,
      NextResponse.json(
        successResponse({
          userId: result.userId,
          epoch: result.epoch,
          isNewIdentity: result.isNewIdentity,
          backfilledEvents: result.backfilledEvents,
          acquisition: result.acquisition
            ? {
                linkId: result.acquisition.linkId
                  ? String(result.acquisition.linkId)
                  : null,
                campaignId: result.acquisition.campaignId
                  ? String(result.acquisition.campaignId)
                  : null,
                campaign: result.acquisition.campaign || null,
                source: result.acquisition.source || null,
                medium: result.acquisition.medium || null,
                shortCode: result.acquisition.shortCode || null,
                model: result.acquisition.model,
              }
            : null,
          warnings: result.warnings,
        }),
        { status: 200 }
      )
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(
      { message: err.message, stack: err.stack, tenantId: auth.context.tenantId },
      'Identify failed'
    );
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR(), { status: 500 })
    );
  }
}
