export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors, handleCorsPreFlight } from '@/lib/middleware/cors';
import { getTenantPolicy } from '@/lib/services/event.service';
import {
  getEventBreakdown,
  getCampaignBreakdown,
  getLinkBreakdown,
  getEventTimeseries,
  getFunnel,
  getIngestHealth,
} from '@/lib/services/event-analytics.service';
import { successResponse, errorResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'analytics-events' });

/** Longest reportable window. Bounds the worst-case scan a single request can trigger. */
const MAX_RANGE_DAYS = 400;

type View = 'breakdown' | 'campaigns' | 'links' | 'timeseries' | 'funnel' | 'health';
const VIEWS: View[] = ['breakdown', 'campaigns', 'links', 'timeseries', 'funnel', 'health'];

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request) ?? new NextResponse(null, { status: 204 });
}

/**
 * GET /api/v1/analytics/events
 *
 *   ?view=breakdown|campaigns|links|timeseries|funnel|health
 *   &from=2026-07-01&to=2026-07-28
 *   &name=ticket_purchase &linkId=… &campaignId=… &platform=android
 *   &conversionsOnly=true
 *
 * One endpoint, several views, because they share the same filter vocabulary —
 * a dashboard that lets you pick a campaign should be able to hold that filter
 * while switching what it is looking at.
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

  const url = new URL(request.url);
  const view = (url.searchParams.get('view') || 'breakdown') as View;

  if (!VIEWS.includes(view)) {
    return applyCors(
      request,
      NextResponse.json(
        errorResponse('INVALID_VIEW', `view must be one of: ${VIEWS.join(', ')}`),
        { status: 400 }
      )
    );
  }

  // Default to the last 30 days — the window most dashboards open on.
  const now = new Date();
  const rawTo = url.searchParams.get('to');
  const rawFrom = url.searchParams.get('from');

  const to = rawTo ? new Date(rawTo) : now;
  const from = rawFrom
    ? new Date(rawFrom)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return applyCors(
      request,
      NextResponse.json(
        Errors.VALIDATION_ERROR({ from: 'Invalid date', to: 'Invalid date' }),
        { status: 400 }
      )
    );
  }
  if (from > to) {
    return applyCors(
      request,
      NextResponse.json(
        errorResponse('INVALID_RANGE', '`from` must be before `to`'),
        { status: 400 }
      )
    );
  }

  const rangeDays = (to.getTime() - from.getTime()) / 86_400_000;
  if (rangeDays > MAX_RANGE_DAYS) {
    return applyCors(
      request,
      NextResponse.json(
        errorResponse(
          'RANGE_TOO_LARGE',
          `The window may span at most ${MAX_RANGE_DAYS} days`
        ),
        { status: 400 }
      )
    );
  }

  const filters = {
    tenantId: auth.tenantId,
    from,
    to,
    name: url.searchParams.get('name') || undefined,
    linkId: url.searchParams.get('linkId') || undefined,
    campaignId: url.searchParams.get('campaignId') || undefined,
    userId: url.searchParams.get('userId') || undefined,
    deviceId: url.searchParams.get('deviceId') || undefined,
    platform: url.searchParams.get('platform') || undefined,
    conversionsOnly: url.searchParams.get('conversionsOnly') === 'true',
  };

  try {
    let data: unknown;

    switch (view) {
      case 'campaigns':
        data = { campaigns: await getCampaignBreakdown(filters) };
        break;
      case 'links':
        data = { links: await getLinkBreakdown(filters) };
        break;
      case 'timeseries':
        data = { points: await getEventTimeseries(filters) };
        break;
      case 'funnel':
        data = {
          funnel: await getFunnel({
            tenantId: auth.tenantId,
            from,
            to,
            linkId: filters.linkId,
            campaignId: filters.campaignId,
          }),
        };
        break;
      case 'health': {
        const policy = await getTenantPolicy(auth.tenantId);
        data = {
          health: await getIngestHealth({
            tenantId: auth.tenantId,
            from,
            to,
            maxEventNames: policy.maxEventNames,
          }),
        };
        break;
      }
      case 'breakdown':
      default:
        data = { events: await getEventBreakdown(filters) };
        break;
    }

    return applyCors(
      request,
      NextResponse.json(
        successResponse({
          view,
          range: { from, to },
          ...(data as object),
        }),
        { status: 200 }
      )
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(
      { message: err.message, stack: err.stack, tenantId: auth.tenantId, view },
      'Event analytics query failed'
    );
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR(), { status: 500 })
    );
  }
}
