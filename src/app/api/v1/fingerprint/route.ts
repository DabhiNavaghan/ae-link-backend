export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import FingerprintService from '@/lib/services/fingerprint.service';
import DeferredService from '@/lib/services/deferred.service';
import LinkModel from '@/lib/models/Link';
import TenantModel from '@/lib/models/Tenant';
import { FingerprintData } from '@/types';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'fingerprint' });

/**
 * POST /api/v1/fingerprint
 *
 * Called by the redirect page when a mobile user clicks a link
 * and the app is not installed. This:
 * 1. Stores the device fingerprint (from browser JS)
 * 2. Creates a DeferredLink record linking fingerprint → link data
 *
 * Later, when the Flutter app opens for the first time, it collects
 * its own fingerprint and calls /api/v1/deferred/match to find
 * the matching DeferredLink.
 */
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

    const body = await request.json();
    const { linkId, tenantId, clickId, fingerprint } = body;

    if (!linkId || !tenantId || !fingerprint) {
      const errorRes = new NextResponse(
        JSON.stringify(
          Errors.VALIDATION_ERROR({
            linkId: !linkId ? 'Required' : undefined,
            tenantId: !tenantId ? 'Required' : undefined,
            fingerprint: !fingerprint ? 'Required' : undefined,
          })
        ),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    // Get the visitor's real IP from request headers
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Get the visitor's user agent
    const userAgent = request.headers.get('user-agent') || '';

    // Enrich fingerprint with server-side data (IP + UA)
    const enrichedFingerprint: FingerprintData = {
      ...fingerprint,
      ipAddress: ip,
      userAgent: userAgent,
    };

    // Get tenant settings
    const tenant = await TenantModel.findById(tenantId);
    if (!tenant || !tenant.isActive) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Tenant')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    const ttlHours = tenant.settings?.fingerprintTtlHours || 72;

    // 1. Store fingerprint (with full raw data for debugging)
    const storedFingerprint = await FingerprintService.storeFingerprint(
      linkId,
      tenantId,
      clickId,
      enrichedFingerprint,
      ttlHours,
      { ...fingerprint, ipAddress: ip, userAgent: userAgent },
      'browser'
    );

    // 2. Look up the link to get its params and destination URL
    const link = await LinkModel.findById(linkId).lean();

    if (link) {
      // 3. Create a DeferredLink record — this is what the Flutter SDK will match against
      await DeferredService.createDeferredLink(
        storedFingerprint._id.toString(),
        linkId,
        tenantId,
        link.params || {},
        link.destinationUrl,
        ttlHours
      );

      logger.info(
        {
          fingerprintId: storedFingerprint._id,
          linkId,
          tenantId,
        },
        'Fingerprint + DeferredLink created'
      );
    } else {
      logger.warn({ linkId }, 'Link not found when creating DeferredLink');
    }

    const response = NextResponse.json(
      successResponse({
        fingerprintId: storedFingerprint._id,
        status: storedFingerprint.status,
        // Return full stored data for debugging — shows exactly what's in the DB
        debug: {
          ipAddress: storedFingerprint.ipAddress,
          screen: storedFingerprint.screen,
          language: storedFingerprint.language,
          timezone: storedFingerprint.timezone,
          timezoneOffset: storedFingerprint.timezoneOffset,
          platform: storedFingerprint.platform,
          vendor: storedFingerprint.vendor,
          pixelRatio: storedFingerprint.pixelRatio,
          colorDepth: storedFingerprint.colorDepth,
          deviceMemory: storedFingerprint.deviceMemory,
          connectionType: storedFingerprint.connectionType,
          hardwareConcurrency: storedFingerprint.hardwareConcurrency,
          touchSupport: storedFingerprint.touchSupport,
          userAgent: userAgent,
          fingerprintHash: storedFingerprint.fingerprintHash,
          source: 'browser',
          createdAt: storedFingerprint.createdAt,
          expiresAt: storedFingerprint.expiresAt,
        },
      }),
      { status: 201 }
    );

    return applyCors(request, response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message, stack: err.stack }, 'Store fingerprint error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
