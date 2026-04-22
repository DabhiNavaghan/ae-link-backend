import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import LinkService from '@/lib/services/link.service';
import { CreateLinkDto } from '@/types';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'links-list' });

export async function GET(request: NextRequest) {
  const cors = applyCors(request, new NextResponse());

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

  const { allowed, remaining, resetAt } = checkRateLimit(request, auth.tenantId);
  if (!allowed) {
    const errorRes = new NextResponse(
      JSON.stringify(Errors.RATE_LIMIT()),
      { status: 429 }
    );
    errorRes.headers.set('Retry-After', String(Math.ceil((resetAt - Date.now()) / 1000)));
    return applyCors(request, errorRes);
  }

  try {

    const url = new URL(request.url);
    const campaignId = url.searchParams.get('campaignId');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const { links, total } = await LinkService.listLinks(auth.tenantId, {
      campaignId: campaignId || undefined,
      limit,
      offset,
    });

    const response = NextResponse.json(
      successResponse({ links, total, limit, offset }),
      { status: 200 }
    );

    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Get links error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}

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

    const body: CreateLinkDto = await request.json();

    // Validate required fields
    if (!body.destinationUrl || !body.linkType) {
      const errorRes = new NextResponse(
        JSON.stringify(
          Errors.VALIDATION_ERROR({
            destinationUrl: 'Required',
            linkType: 'Required',
          })
        ),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    const link = await LinkService.createLink(auth.tenantId, body);

    const response = NextResponse.json(
      successResponse(link),
      { status: 201 }
    );

    return applyCors(request, response);
  } catch (error) {
    logger.error({ error: String(error) }, 'Create link error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
