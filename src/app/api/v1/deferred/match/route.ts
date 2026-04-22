import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import DeferredService from '@/lib/services/deferred.service';
import TenantModel from '@/lib/models/Tenant';
import { FingerprintData } from '@/types';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'deferred-match' });

/**
 * POST /api/v1/deferred/match
 *
 * Called by the Flutter SDK on first app launch.
 * The SDK sends the device's fingerprint, and the server tries
 * to match it against stored fingerprints from web clicks.
 *
 * Auth: X-API-Key header (same key used for all SDK calls)
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

  // Authenticate via API key — resolves tenantId automatically
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
    const { fingerprint } = body;

    if (!fingerprint) {
      const errorRes = new NextResponse(
        JSON.stringify(
          Errors.VALIDATION_ERROR({ fingerprint: 'Required' })
        ),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    // Get the app's IP from request headers
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Get user agent from the app
    const userAgent = request.headers.get('user-agent') || '';

    // Normalize incoming fingerprint — Flutter SDK sends snake_case,
    // server stores camelCase. Map fields to match stored format.
    const normalizedFingerprint: FingerprintData = {
      ipAddress: fingerprint.ip_address || fingerprint.ipAddress || ip,
      userAgent: fingerprint.user_agent || fingerprint.userAgent || userAgent,
      screen: fingerprint.screen || {
        width: fingerprint.screen_width ? Math.round(fingerprint.screen_width) : 0,
        height: fingerprint.screen_height ? Math.round(fingerprint.screen_height) : 0,
      },
      language: fingerprint.locale || fingerprint.language || '',
      timezone: fingerprint.timezone || '',
      platform: fingerprint.platform || fingerprint.os_name || '',
      vendor: fingerprint.vendor || fingerprint.device_manufacturer || '',
      deviceMemory: fingerprint.device_memory || fingerprint.deviceMemory,
      connectionType: fingerprint.connection_type || fingerprint.connectionType,
      hardwareConcurrency: fingerprint.hardware_concurrency || fingerprint.hardwareConcurrency,
      touchSupport: fingerprint.touch_support ?? fingerprint.touchSupport ?? true,
      colorDepth: fingerprint.color_depth || fingerprint.colorDepth || 24,
      pixelRatio: fingerprint.pixel_ratio || fingerprint.pixelRatio || fingerprint.screen_density || 1,
    };

    // Get tenant settings for match threshold
    const tenant = await TenantModel.findById(auth.tenantId);
    const matchThreshold = tenant?.settings?.matchThreshold || 70;

    // Find matching deferred link
    const deferredLink = await DeferredService.matchDeferredLink(
      auth.tenantId,
      normalizedFingerprint,
      matchThreshold
    );

    if (!deferredLink) {
      const response = NextResponse.json(
        successResponse({
          matched: false,
          deferredLinkId: null,
        }),
        { status: 200 }
      );
      return applyCors(request, response);
    }

    logger.info(
      {
        deferredLinkId: deferredLink._id,
        matchScore: deferredLink.matchScore,
        tenantId: auth.tenantId,
      },
      'Deferred link matched from app'
    );

    const response = NextResponse.json(
      successResponse({
        matched: true,
        deferredLinkId: deferredLink._id,
        linkId: deferredLink.linkId,
        params: deferredLink.params,
        destinationUrl: deferredLink.destinationUrl,
        matchScore: deferredLink.matchScore,
      }),
      { status: 200 }
    );

    return applyCors(request, response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message, stack: err.stack }, 'Deferred match error');
    console.error('DEFERRED MATCH ERROR:', err.message);
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
