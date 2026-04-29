export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import AppModel from '@/lib/models/App';
import { UpdateAppDto } from '@/types';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import { Types } from 'mongoose';

const logger = Logger.child({ route: 'apps-single' });

/**
 * GET /api/v1/apps/[id]
 * Get a single app by ID
 */
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
        JSON.stringify(Errors.BAD_REQUEST('Invalid app ID')),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    const app = await AppModel.findById(params.id);

    if (!app || app.tenantId.toString() !== auth.tenantId) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('App')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    const response = NextResponse.json(
      successResponse(app),
      { status: 200 }
    );
    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Get app error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}

/**
 * PUT /api/v1/apps/[id]
 * Update an app
 */
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
        JSON.stringify(Errors.BAD_REQUEST('Invalid app ID')),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    const existingApp = await AppModel.findById(params.id);
    if (!existingApp || existingApp.tenantId.toString() !== auth.tenantId) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('App')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    const body: UpdateAppDto = await request.json();

    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.android !== undefined) {
      // Merge with existing android config
      updateData.android = {
        ...existingApp.android,
        ...body.android,
      };
    }
    if (body.ios !== undefined) {
      // Merge with existing iOS config
      updateData.ios = {
        ...existingApp.ios,
        ...body.ios,
      };
    }

    const updated = await AppModel.findByIdAndUpdate(
      params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    logger.info(
      { appId: params.id, tenantId: auth.tenantId },
      'App updated'
    );

    const response = NextResponse.json(
      successResponse(updated),
      { status: 200 }
    );
    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Update app error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}

/**
 * DELETE /api/v1/apps/[id]
 * Soft-delete (deactivate) an app
 */
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
        JSON.stringify(Errors.BAD_REQUEST('Invalid app ID')),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    const app = await AppModel.findById(params.id);
    if (!app || app.tenantId.toString() !== auth.tenantId) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('App')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    // Soft delete — mark as inactive
    await AppModel.findByIdAndUpdate(params.id, {
      $set: { isActive: false },
    });

    logger.info(
      { appId: params.id, tenantId: auth.tenantId },
      'App deactivated'
    );

    const response = NextResponse.json(
      successResponse({ deleted: true }),
      { status: 200 }
    );
    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Delete app error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
