export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { authenticateIngest } from '@/lib/middleware/ingest-auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors, handleCorsPreFlight } from '@/lib/middleware/cors';
import { ingestEvents } from '@/lib/services/event.service';
import { lookupGeo } from '@/lib/services/geo.service';
import { getClientIp } from '@/lib/get-client-ip';
import { successResponse, errorResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import { LIMITS } from '@/lib/utils/event-validation';
import { TrackEventInput } from '@/types/events';

const logger = Logger.child({ route: 'events-ingest' });

/** Hard ceiling on the request body, checked before parsing. */
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB — 50 events × 8KB properties, with headroom

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request) ?? new NextResponse(null, { status: 204 });
}

/**
 * POST /api/v1/events
 *
 * Batched event ingest. Works for both the Flutter SDK (app_… key) and
 * server-to-server callers (tenant key, or app key + HMAC signature).
 *
 *   {
 *     "events": [{
 *       "name": "ticket_purchase",
 *       "deviceId": "a3f…",
 *       "occurredAt": "2026-07-28T09:14:02Z",
 *       "value": 1250, "currency": "INR",
 *       "properties": { "eventId": "evt_991", "qty": 2 },
 *       "idempotencyKey": "c1f2…"
 *     }]
 *   }
 *
 * Answers 207 Multi-Status with one result per event, in request order. One
 * malformed event never rejects the batch — the SDK drops what was accepted or
 * permanently rejected and retries only transient failures.
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
  } catch {
    return applyCors(
      request,
      NextResponse.json(
        Errors.INTERNAL_ERROR('Database connection failed'),
        { status: 500 }
      )
    );
  }

  // ── Body size, before parsing ──
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return applyCors(
      request,
      NextResponse.json(
        errorResponse('PAYLOAD_TOO_LARGE', 'Request body exceeds 1 MB'),
        { status: 413 }
      )
    );
  }

  // Read raw text: the HMAC signature is computed over the exact bytes sent,
  // so re-serializing parsed JSON would never verify.
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

  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return applyCors(
      request,
      NextResponse.json(
        errorResponse('PAYLOAD_TOO_LARGE', 'Request body exceeds 1 MB'),
        { status: 413 }
      )
    );
  }

  // ── Auth (also determines trust level) ──
  const auth = await authenticateIngest(request, rawBody);
  if (!auth.ok) {
    const status = auth.failure.code === 'INVALID_SIGNATURE' ? 403 : 401;
    return applyCors(
      request,
      NextResponse.json(
        errorResponse(auth.failure.code, auth.failure.message),
        { status }
      )
    );
  }

  const { allowed, remaining, resetAt } = checkRateLimit(
    request,
    auth.context.tenantId
  );
  if (!allowed) {
    const res = NextResponse.json(Errors.RATE_LIMIT(), { status: 429 });
    res.headers.set('Retry-After', String(Math.ceil((resetAt - Date.now()) / 1000)));
    return applyCors(request, res);
  }

  // ── Parse ──
  let body: unknown;
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

  const events = (body as { events?: unknown })?.events;

  if (!Array.isArray(events)) {
    return applyCors(
      request,
      NextResponse.json(
        Errors.VALIDATION_ERROR({ events: 'Required — must be an array' }),
        { status: 400 }
      )
    );
  }

  if (events.length === 0) {
    return applyCors(
      request,
      NextResponse.json(
        successResponse({ results: [], accepted: 0, rejected: 0, duplicates: 0 }),
        { status: 200 }
      )
    );
  }

  if (events.length > LIMITS.BATCH_MAX) {
    return applyCors(
      request,
      NextResponse.json(
        errorResponse(
          'BATCH_TOO_LARGE',
          `A batch may contain at most ${LIMITS.BATCH_MAX} events; received ${events.length}`
        ),
        { status: 400 }
      )
    );
  }

  try {
    // Coarse geo only. We deliberately never store the IP on an event row —
    // country and city answer every reporting question we have without keeping
    // a per-event personal identifier around for the retention window.
    const ip = getClientIp(request);
    let country: string | undefined;
    let city: string | undefined;
    try {
      const geo = ip ? await lookupGeo(ip, request) : null;
      country = geo?.country || undefined;
      city = geo?.city || undefined;
    } catch {
      // Geo is decoration — never let it fail an ingest.
    }

    const summary = await ingestEvents(events as TrackEventInput[], {
      tenantId: auth.context.tenantId,
      appId: auth.context.appId,
      trust: auth.context.trust,
      country,
      city,
    });

    logger.info(
      {
        tenantId: auth.context.tenantId,
        trust: auth.context.trust,
        received: events.length,
        accepted: summary.accepted,
        rejected: summary.rejected,
        duplicates: summary.duplicates,
      },
      'Event batch ingested'
    );

    // 207 when the batch was mixed, 200 when everything landed. Both carry the
    // same body — the per-event results are the contract, the status is a hint.
    const status = summary.rejected > 0 ? 207 : 200;

    const res = NextResponse.json(successResponse(summary), { status });
    res.headers.set('X-RateLimit-Remaining', String(remaining));
    return applyCors(request, res);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(
      { message: err.message, stack: err.stack, tenantId: auth.context.tenantId },
      'Event ingest failed'
    );
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR(), { status: 500 })
    );
  }
}
