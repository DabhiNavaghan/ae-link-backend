export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import AnalyticsService from '@/lib/services/analytics.service';
import AppModel from '@/lib/models/App';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'analytics-apps' });

/**
 * GET /api/v1/analytics/apps/:id?days=30
 *
 * Store page traffic for one app — visits to /apps/:slug/store, which belong
 * to the app rather than to any link and so appear in no click figure.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
  } catch {
    return applyCors(
      request,
      new NextResponse(JSON.stringify(Errors.INTERNAL_ERROR('Database connection failed')), { status: 500 })
    );
  }

  const auth = await requireAuth(request);
  if (!auth) {
    return applyCors(
      request,
      new NextResponse(JSON.stringify(Errors.UNAUTHORIZED()), { status: 401 })
    );
  }

  const { allowed } = checkRateLimit(request, auth.tenantId);
  if (!allowed) {
    return applyCors(
      request,
      new NextResponse(JSON.stringify(Errors.RATE_LIMIT()), { status: 429 })
    );
  }

  try {
    const { id } = params;
    if (!Types.ObjectId.isValid(id)) {
      return applyCors(
        request,
        new NextResponse(JSON.stringify(Errors.NOT_FOUND('App')), { status: 404 })
      );
    }

    // Scope to the caller's tenant — an app id alone must not expose another
    // tenant's traffic.
    const app = await AppModel.findOne({ _id: id, tenantId: auth.tenantId })
      .select('_id')
      .lean();

    if (!app) {
      return applyCors(
        request,
        new NextResponse(JSON.stringify(Errors.NOT_FOUND('App')), { status: 404 })
      );
    }

    const daysParam = parseInt(
      new URL(request.url).searchParams.get('days') || '30',
      10
    );
    const days = Number.isFinite(daysParam)
      ? Math.min(Math.max(daysParam, 1), 365)
      : 30;

    const analytics = await AnalyticsService.getAppVisitAnalytics(id, days);

    return applyCors(
      request,
      NextResponse.json(successResponse({ ...analytics, days }), { status: 200 })
    );
  } catch (error) {
    logger.error({ error: String(error) }, 'App analytics error');
    return applyCors(
      request,
      new NextResponse(JSON.stringify(Errors.INTERNAL_ERROR()), { status: 500 })
    );
  }
}
