export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import AppModel from '@/lib/models/App';
import { CreateAppDto } from '@/types';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'apps-list' });

/**
 * GET /api/v1/apps
 * List all apps for the authenticated tenant
 */
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
    const activeOnly = url.searchParams.get('active') !== 'false';

    const filter: Record<string, any> = { tenantId: auth.tenantId };
    if (activeOnly) {
      filter.isActive = true;
    }

    const apps = await AppModel.find(filter).sort({ createdAt: -1 });

    const response = NextResponse.json(
      successResponse({ apps, total: apps.length }),
      { status: 200 }
    );
    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'List apps error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}

/**
 * POST /api/v1/apps
 * Create a new app for the authenticated tenant
 */
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
    const body: CreateAppDto = await request.json();

    if (!body.name) {
      const errorRes = new NextResponse(
        JSON.stringify(
          Errors.VALIDATION_ERROR({ name: 'App name is required' })
        ),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    const slugBase = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    const slugSuffix = Math.random().toString(36).slice(2, 8);
    const slug = `${slugBase}-${slugSuffix}`;

    const app = new AppModel({
      tenantId: auth.tenantId,
      name: body.name,
      slug,
      android: body.android || {},
      ios: body.ios || {},
    });

    await app.save();

    logger.info(
      { appId: app._id, tenantId: auth.tenantId },
      'App created'
    );

    const response = NextResponse.json(
      successResponse(app),
      { status: 201 }
    );
    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Create app error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
