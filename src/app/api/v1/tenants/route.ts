import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import { requireAuth } from '@/lib/middleware/auth';
import TenantModel from '@/lib/models/Tenant';
import { RegisterTenantDto } from '@/types';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'tenants' });

export async function POST(request: NextRequest) {
  const { allowed } = checkRateLimit(request);
  if (!allowed) {
    const errorRes = new NextResponse(
      JSON.stringify(Errors.RATE_LIMIT()),
      { status: 429 }
    );
    return applyCors(request, errorRes);
  }

  try {
    await connectDB();

    const body: RegisterTenantDto = await request.json();

    if (!body.name || !body.domain || !body.app) {
      const errorRes = new NextResponse(
        JSON.stringify(
          Errors.VALIDATION_ERROR({
            name: 'Required',
            domain: 'Required',
            app: 'Required',
          })
        ),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    // Check if domain already exists
    const existing = await TenantModel.findOne({ domain: body.domain });
    if (existing) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.CONFLICT('Domain already registered')),
        { status: 409 }
      );
      return applyCors(request, errorRes);
    }

    const tenant = new TenantModel({
      name: body.name,
      domain: body.domain,
      app: body.app,
      settings: body.settings || {},
      isActive: true,
    });

    await tenant.save();

    logger.info(
      {
        tenantId: tenant._id,
        domain: tenant.domain,
      },
      'Tenant registered'
    );

    const response = NextResponse.json(
      successResponse({
        tenantId: tenant._id,
        name: tenant.name,
        domain: tenant.domain,
        apiKey: tenant.apiKey,
      }),
      { status: 201 }
    );

    return applyCors(request, response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    // Log with object first so the logger includes error details
    logger.error({ message: err.message, stack: err.stack }, 'Register tenant error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR(err.message)),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}

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
    const tenant = await TenantModel.findById(auth.tenantId).select(
      '-apiSecret'
    );

    if (!tenant) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Tenant')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    const response = NextResponse.json(
      successResponse(tenant),
      { status: 200 }
    );

    return applyCors(request, response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message, stack: err.stack }, 'Get tenant error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR(err.message)),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}

export async function PUT(request: NextRequest) {
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

    const updateData: Record<string, any> = {};

    // Only allow updating specific fields
    if (body.name) updateData.name = body.name;
    if (body.settings) updateData.settings = body.settings;
    if (body.app) updateData.app = body.app;

    const tenant = await TenantModel.findByIdAndUpdate(
      auth.tenantId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-apiSecret');

    if (!tenant) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Tenant')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    logger.info({ tenantId: auth.tenantId }, 'Tenant updated');

    const response = NextResponse.json(
      successResponse(tenant),
      { status: 200 }
    );

    return applyCors(request, response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message, stack: err.stack }, 'Update tenant error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR(err.message)),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
