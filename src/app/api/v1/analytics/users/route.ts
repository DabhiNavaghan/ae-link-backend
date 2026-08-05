export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors, handleCorsPreFlight } from '@/lib/middleware/cors';
import { getUsers } from '@/lib/services/event-analytics.service';
import { successResponse, errorResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'analytics-users' });

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request) ?? new NextResponse(null, { status: 204 });
}

/**
 * GET /api/v1/analytics/users
 *
 *   ?campaignId=…  — everyone this campaign acquired
 *   ?linkId=…      — everyone this link acquired
 *   &sort=recent|value|events &page=1&limit=25
 *
 * Users as a reportable unit. This is the question device-level data could
 * never answer: not "how many installs did this campaign produce" but "which
 * people did it bring in, and what have they been worth since".
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

  // Tenant key only. This list enumerates real end users by id along with their
  // lifetime value; an app key lives inside a distributable binary and must not
  // be able to dump it. Aggregate views (/analytics/events) stay open to app
  // keys because they expose no individual.
  if (auth.appId) {
    return applyCors(
      request,
      NextResponse.json(
        errorResponse(
          'FORBIDDEN',
          'Listing users requires a tenant API key. App keys are distributed inside your app binary.'
        ),
        { status: 403 }
      )
    );
  }

  const { allowed } = checkRateLimit(request, auth.tenantId);
  if (!allowed) {
    return applyCors(
      request,
      NextResponse.json(Errors.RATE_LIMIT(), { status: 429 })
    );
  }

  const url = new URL(request.url);

  const rawFrom = url.searchParams.get('from');
  const rawTo = url.searchParams.get('to');
  const from = rawFrom ? new Date(rawFrom) : undefined;
  const to = rawTo ? new Date(rawTo) : undefined;

  if (
    (from && Number.isNaN(from.getTime())) ||
    (to && Number.isNaN(to.getTime()))
  ) {
    return applyCors(
      request,
      NextResponse.json(
        Errors.VALIDATION_ERROR({ from: 'Invalid date', to: 'Invalid date' }),
        { status: 400 }
      )
    );
  }

  const sortParam = url.searchParams.get('sort');
  const sort: 'recent' | 'value' | 'events' =
    sortParam === 'value' || sortParam === 'events' ? sortParam : 'recent';

  try {
    const result = await getUsers({
      tenantId: auth.tenantId,
      from,
      to,
      linkId: url.searchParams.get('linkId') || undefined,
      campaignId: url.searchParams.get('campaignId') || undefined,
      page: Number(url.searchParams.get('page')) || 1,
      limit: Number(url.searchParams.get('limit')) || 25,
      sort,
    });

    return applyCors(
      request,
      NextResponse.json(successResponse(result), { status: 200 })
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(
      { message: err.message, tenantId: auth.tenantId },
      'User list query failed'
    );
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR(), { status: 500 })
    );
  }
}
