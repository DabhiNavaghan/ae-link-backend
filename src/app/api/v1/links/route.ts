export const maxDuration = 30;

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
    const appId = url.searchParams.get('appId') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const { links, total } = await LinkService.listLinks(auth.tenantId, {
      campaignId: campaignId || undefined,
      appId,
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

    // Auto-fill appId from per-app API key (app_xxx key auto-resolves the app)
    if (!body.appId && auth.appId) {
      body.appId = auth.appId;
    }

    // Validate required fields
    const validationErrors: Record<string, string> = {};
    if (!body.title) validationErrors.title = 'Required';
    if (!body.appId) {
      validationErrors.appId = 'Required — pass appId in body or use a per-app API key';
    } else if (!/^[a-f\d]{24}$/i.test(body.appId)) {
      validationErrors.appId = 'Invalid appId format — use the App ID from dashboard (not the API key)';
    }

    if (Object.keys(validationErrors).length > 0) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.VALIDATION_ERROR(validationErrors)),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    // Default destinationUrl to empty string (app-open-only link)
    if (!body.destinationUrl) body.destinationUrl = '';

    // Default linkType to 'custom' if not provided
    if (!body.linkType) body.linkType = 'custom';

    const link = await LinkService.createLink(auth.tenantId, body);

    // Build full short link URL from request host
    const host = request.headers.get('host') || 'smartlink.apps.allevents.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const linkUrl = `${protocol}://${host}/${link.shortCode}`;

    const response = NextResponse.json(
      successResponse({ ...link.toJSON(), url: linkUrl }),
      { status: 201 }
    );

    return applyCors(request, response);
  } catch (error: any) {
    // Return specific error message for known errors (validation, duplicates, etc.)
    const message = error?.message || 'Internal Server Error';
    const isKnownError = message.includes('short code') || message.includes('Invalid') || message.includes('already in use');

    logger.error({ error: String(error) }, 'Create link error');
    const errorRes = new NextResponse(
      JSON.stringify(isKnownError ? Errors.VALIDATION_ERROR({ error: message }) : Errors.INTERNAL_ERROR()),
      { status: isKnownError ? 400 : 500 }
    );
    return applyCors(request, errorRes);
  }
}
