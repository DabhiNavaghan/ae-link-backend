import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import TenantModel from '@/lib/models/Tenant';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import crypto from 'crypto';

const logger = Logger.child({ route: 'tenants-regenerate-key' });

/**
 * POST /api/v1/tenants/regenerate-key
 * Regenerates the API key for the authenticated tenant.
 * The old key is immediately invalidated.
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

    const newApiKey = crypto.randomBytes(24).toString('hex');
    const newApiSecret = crypto.randomBytes(32).toString('hex');

    const tenant = await TenantModel.findByIdAndUpdate(
      auth.tenantId,
      {
        apiKey: newApiKey,
        apiSecret: newApiSecret,
      },
      { new: true }
    );

    if (!tenant) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Tenant')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    logger.info({ tenantId: auth.tenantId }, 'API key regenerated');

    const response = NextResponse.json(
      successResponse({
        apiKey: newApiKey,
        message: 'API key regenerated. The old key is now invalid.',
      }),
      { status: 200 }
    );

    return applyCors(request, response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message }, 'Regenerate key error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
