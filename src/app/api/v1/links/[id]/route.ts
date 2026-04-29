export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import LinkService from '@/lib/services/link.service';
import { UpdateLinkDto } from '@/types';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import { Types } from 'mongoose';

const logger = Logger.child({ route: 'links-single' });

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
        JSON.stringify(Errors.BAD_REQUEST('Invalid link ID')),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    const link = await LinkService.getLink(params.id);

    if (!link) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Link')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    // Verify tenant ownership
    if (link.tenantId.toString() !== auth.tenantId) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.FORBIDDEN()),
        { status: 403 }
      );
      return applyCors(request, errorRes);
    }

    const response = NextResponse.json(successResponse(link), { status: 200 });
    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Get link error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}

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
        JSON.stringify(Errors.BAD_REQUEST('Invalid link ID')),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    // Verify ownership
    const link = await LinkService.getLink(params.id);
    if (!link || link.tenantId.toString() !== auth.tenantId) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Link')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    const body: UpdateLinkDto = await request.json();
    const updated = await LinkService.updateLink(params.id, body);

    if (!updated) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Link')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    const response = NextResponse.json(successResponse(updated), { status: 200 });
    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Update link error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}

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
        JSON.stringify(Errors.BAD_REQUEST('Invalid link ID')),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    // Verify ownership
    const link = await LinkService.getLink(params.id);
    if (!link || link.tenantId.toString() !== auth.tenantId) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Link')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    await LinkService.deleteLink(params.id);

    const response = NextResponse.json(
      successResponse({ deleted: true }),
      { status: 200 }
    );
    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Delete link error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
