export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import DeferredService from '@/lib/services/deferred.service';
import TenantModel from '@/lib/models/Tenant';
import InstallModel from '@/lib/models/Install';
import ConversionModel from '@/lib/models/Conversion';
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

    // Log raw incoming fingerprint from Flutter SDK for debugging
    logger.info(
      { rawFingerprint: fingerprint, serverIp: ip },
      '📱 RAW fingerprint received from Flutter SDK'
    );

    // Normalize incoming fingerprint — Flutter SDK sends snake_case,
    // server stores camelCase. Map fields to match stored format.
    const normalizedFingerprint: FingerprintData & { timezoneOffset?: string } = {
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
      // Pass through timezone offset for cross-format matching
      timezoneOffset: fingerprint.timezone_offset || fingerprint.timezoneOffset,
    };

    // Log the normalized fingerprint that will be used for matching
    logger.info(
      {
        normalized: {
          ipAddress: normalizedFingerprint.ipAddress,
          screen: normalizedFingerprint.screen,
          language: normalizedFingerprint.language,
          timezone: normalizedFingerprint.timezone,
          timezoneOffset: normalizedFingerprint.timezoneOffset,
          platform: normalizedFingerprint.platform,
          pixelRatio: normalizedFingerprint.pixelRatio,
        },
      },
      '📱 NORMALIZED fingerprint for matching'
    );

    // Get tenant settings for match threshold and deferred link toggle
    const tenant = await TenantModel.findById(auth.tenantId);

    // Check if deferred deep linking is enabled (default: true)
    const deferredEnabled = tenant?.settings?.enableDeferredDeepLink !== false;
    if (!deferredEnabled) {
      logger.info({ tenantId: auth.tenantId }, 'Deferred deep linking disabled for tenant');
      const response = NextResponse.json(
        successResponse({
          matched: false,
          deferredLinkId: null,
          debug: { message: 'Deferred deep linking is disabled in settings.' },
        }),
        { status: 200 }
      );
      return applyCors(request, response);
    }

    const matchThreshold = tenant?.settings?.matchThreshold || 60;

    // Find matching deferred link
    const deferredLink = await DeferredService.matchDeferredLink(
      auth.tenantId,
      normalizedFingerprint,
      matchThreshold
    );

    // Update install record with match result
    const deviceId = fingerprint.device_id || fingerprint.deviceId;
    if (deviceId) {
      try {
        await InstallModel.updateOne(
          { tenantId: auth.tenantId, deviceId },
          {
            matchResult: deferredLink ? 'matched' : 'organic',
            matchScore: deferredLink?.matchScore || 0,
            deferredLinkId: deferredLink?._id,
          }
        );
      } catch (e) {
        // Non-blocking — install tracking should not break matching
        logger.debug({ deviceId }, 'Failed to update install record');
      }
    }

    if (!deferredLink) {
      logger.info(
        {
          tenantId: auth.tenantId,
          appFingerprint: {
            ip: normalizedFingerprint.ipAddress,
            screen: normalizedFingerprint.screen,
            language: normalizedFingerprint.language,
            timezone: normalizedFingerprint.timezone,
            timezoneOffset: normalizedFingerprint.timezoneOffset,
          },
        },
        '❌ No deferred link matched — returning debug comparison'
      );

      const response = NextResponse.json(
        successResponse({
          matched: false,
          deferredLinkId: null,
          // Debug info: what the app sent so you can compare with browser
          debug: {
            appFingerprint: {
              ipAddress: normalizedFingerprint.ipAddress,
              screen: normalizedFingerprint.screen,
              language: normalizedFingerprint.language,
              timezone: normalizedFingerprint.timezone,
              timezoneOffset: normalizedFingerprint.timezoneOffset,
              platform: normalizedFingerprint.platform,
              pixelRatio: normalizedFingerprint.pixelRatio,
            },
            matchThreshold,
            message: 'No matching fingerprint found. Check server logs for candidate comparisons.',
          },
        }),
        { status: 200 }
      );
      return applyCors(request, response);
    }

    logger.info(
      {
        deferredLinkId: deferredLink._id,
        matchScore: deferredLink.matchScore,
        matchDetails: deferredLink.matchDetails,
        tenantId: auth.tenantId,
      },
      '✅ Deferred link matched from app'
    );

    // Create a Conversion record for analytics tracking
    try {
      await ConversionModel.create({
        linkId: deferredLink.linkId,
        tenantId: auth.tenantId,
        deferredLinkId: deferredLink._id,
        conversionType: 'app_open',
        deviceId: deviceId || undefined,
        metadata: {
          matchScore: deferredLink.matchScore,
          matchDetails: deferredLink.matchDetails,
          source: 'deferred_match',
        },
      });
      logger.info(
        { linkId: deferredLink.linkId, deferredLinkId: deferredLink._id },
        'Conversion recorded for deferred match'
      );
    } catch (convErr) {
      // Non-blocking — don't fail the match if conversion tracking fails
      logger.warn({ error: String(convErr) }, 'Failed to create conversion record');
    }

    const response = NextResponse.json(
      successResponse({
        matched: true,
        deferredLinkId: deferredLink._id,
        linkId: deferredLink.linkId,
        params: deferredLink.params,
        destinationUrl: deferredLink.destinationUrl,
        matchScore: deferredLink.matchScore,
        matchDetails: deferredLink.matchDetails,
      }),
      { status: 200 }
    );

    return applyCors(request, response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message, stack: err.stack }, 'Deferred match error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
