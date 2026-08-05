export const maxDuration = 20;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors, handleCorsPreFlight } from '@/lib/middleware/cors';
import EventDefinitionModel from '@/lib/models/EventDefinition';
import { invalidateVocabulary } from '@/lib/services/event-definition.service';
import { successResponse, errorResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import {
  LIMITS,
  isValidEventName,
  safeString,
} from '@/lib/utils/event-validation';

const logger = Logger.child({ route: 'event-definitions' });

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request) ?? new NextResponse(null, { status: 204 });
}

/**
 * GET /api/v1/events/definitions
 *
 * This tenant's event vocabulary — every name the platform has seen, with its
 * label, category, conversion flag and usage count.
 */
export async function GET(request: NextRequest) {
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

  const auth = await requireAuth(request);
  if (!auth) {
    return applyCors(
      request,
      NextResponse.json(Errors.UNAUTHORIZED(), { status: 401 })
    );
  }

  const { allowed } = checkRateLimit(request, auth.tenantId);
  if (!allowed) {
    return applyCors(
      request,
      NextResponse.json(Errors.RATE_LIMIT(), { status: 429 })
    );
  }

  try {
    const definitions = await EventDefinitionModel.find({
      tenantId: auth.tenantId,
    })
      .sort({ eventCount: -1, name: 1 })
      .lean();

    return applyCors(
      request,
      NextResponse.json(
        successResponse({
          definitions,
          count: definitions.length,
          limit: LIMITS.EVENT_NAME_CARDINALITY_MAX,
        }),
        { status: 200 }
      )
    );
  } catch (error) {
    logger.error({ error: String(error), tenantId: auth.tenantId }, 'Definition list failed');
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR(), { status: 500 })
    );
  }
}

/**
 * PATCH /api/v1/events/definitions
 *
 *   { "name": "ticket_purchase", "label": "Ticket Purchase",
 *     "category": "revenue", "isConversion": true, "expectsValue": true }
 *
 * Curate one definition. Flipping `isConversion` reclassifies history rather
 * than creating a second counter — conversions are a label over events, so
 * every report that asks for conversions picks up the change immediately.
 *
 * The event `name` itself is not editable: it is the join key on millions of
 * rows. Renaming would either orphan history or need a collection rewrite.
 */
export async function PATCH(request: NextRequest) {
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

  const auth = await requireAuth(request);
  if (!auth) {
    return applyCors(
      request,
      NextResponse.json(Errors.UNAUTHORIZED(), { status: 401 })
    );
  }

  const { allowed } = checkRateLimit(request, auth.tenantId);
  if (!allowed) {
    return applyCors(
      request,
      NextResponse.json(Errors.RATE_LIMIT(), { status: 429 })
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return applyCors(
      request,
      NextResponse.json(Errors.BAD_REQUEST('Body must be valid JSON'), {
        status: 400,
      })
    );
  }

  const name = safeString(body?.name, 64);
  if (!name || !isValidEventName(name)) {
    return applyCors(
      request,
      NextResponse.json(
        Errors.VALIDATION_ERROR({ name: 'Required — a valid event name' }),
        { status: 400 }
      )
    );
  }

  // Explicit allowlist rather than spreading the body: a Mixed-adjacent
  // document should never take arbitrary keys from a request.
  const update: Record<string, unknown> = {};
  const label = safeString(body?.label, 120);
  const description = safeString(body?.description, 500);
  const category = safeString(body?.category, 64);

  if (label) update.label = label;
  if (description) update.description = description;
  if (category) update.category = category;
  if (typeof body?.isConversion === 'boolean') update.isConversion = body.isConversion;
  if (typeof body?.expectsValue === 'boolean') update.expectsValue = body.expectsValue;
  if (body?.status === 'active' || body?.status === 'hidden') {
    update.status = body.status;
  }
  const currency = safeString(body?.defaultCurrency, 3);
  if (currency && /^[A-Za-z]{3}$/.test(currency)) {
    update.defaultCurrency = currency.toUpperCase();
  }

  if (Object.keys(update).length === 0) {
    return applyCors(
      request,
      NextResponse.json(
        errorResponse('NO_CHANGES', 'No editable fields were provided'),
        { status: 400 }
      )
    );
  }

  try {
    const definition = await EventDefinitionModel.findOneAndUpdate(
      { tenantId: auth.tenantId, name },
      { $set: update },
      { new: true }
    ).lean();

    if (!definition) {
      return applyCors(
        request,
        NextResponse.json(Errors.NOT_FOUND('Event definition'), { status: 404 })
      );
    }

    invalidateVocabulary(auth.tenantId);

    logger.info(
      { tenantId: auth.tenantId, name, fields: Object.keys(update) },
      'Event definition updated'
    );

    return applyCors(
      request,
      NextResponse.json(successResponse({ definition }), { status: 200 })
    );
  } catch (error) {
    logger.error(
      { error: String(error), tenantId: auth.tenantId },
      'Definition update failed'
    );
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR(), { status: 500 })
    );
  }
}
