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
import ClickModel from '@/lib/models/Click';
import FingerprintModel from '@/lib/models/Fingerprint';
import LinkModel from '@/lib/models/Link';
import MatchAttemptModel, { IEvaluatedCandidate } from '@/lib/models/MatchAttempt';
import type { ScoredCandidate } from '@/lib/services/fingerprint.service';
import { lookupGeo } from '@/lib/services/geo.service';
import { FingerprintData } from '@/types';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import { liveEvents } from '@/lib/services/live-events';
import { getClientIp } from '@/lib/get-client-ip';

const logger = Logger.child({ route: 'deferred-match' });

/** How many scored candidates to persist per attempt. */
const MAX_PERSISTED_CANDIDATES = 10;

/**
 * Persist the full decision so the admin match-analysis view can explain any
 * install. Never throws — attribution debugging must not break attribution.
 */
async function recordMatchAttempt(input: {
  tenantId: string;
  deviceId?: string;
  platform?: string;
  outcome: 'matched' | 'organic' | 'disabled';
  reason: string;
  threshold: number;
  candidates: ScoredCandidate[];
  selectedIndex: number;
  appFingerprint: Record<string, any>;
  matchedLinkId?: any;
  matchedDeferredLinkId?: any;
  matchedFingerprintId?: any;
  matchedClickId?: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  startedAt: number;
}): Promise<void> {
  try {
    const best = input.candidates[0];

    const persisted: IEvaluatedCandidate[] = input.candidates
      .slice(0, MAX_PERSISTED_CANDIDATES)
      .map((c, i) => ({
        fingerprintId: c.fingerprint._id as any,
        linkId: c.fingerprint.linkId as any,
        clickId: c.fingerprint.clickId as any,
        score: c.score,
        possible: c.possible,
        confidence: c.confidence,
        signals: c.details.signals || [],
        rejectedReason: c.details.rejectedReason,
        selected: i === input.selectedIndex,
        clickedAt: c.fingerprint.createdAt,
      }));

    await MatchAttemptModel.create({
      tenantId: input.tenantId,
      deviceId: input.deviceId,
      platform: input.platform,
      outcome: input.outcome,
      reason: input.reason,
      threshold: input.threshold,
      bestConfidence: best?.confidence || 0,
      bestScore: best?.score || 0,
      bestPossible: best?.possible || 0,
      candidateCount: input.candidates.length,
      appFingerprint: input.appFingerprint,
      candidates: persisted,
      matchedLinkId: input.matchedLinkId,
      matchedDeferredLinkId: input.matchedDeferredLinkId,
      matchedFingerprintId: input.matchedFingerprintId,
      matchedClickId: input.matchedClickId,
      ipAddress: input.ipAddress,
      country: input.country,
      city: input.city,
      durationMs: Date.now() - input.startedAt,
    });
  } catch (err) {
    logger.warn({ error: String(err) }, 'Failed to record match attempt');
  }
}

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

  const startedAt = Date.now();

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
    const ip = getClientIp(request) || '127.0.0.1';

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
      // Physical pixels are the DPR-invariant screen signal — the SDK sends
      // them explicitly, and until now the server dropped them on the floor.
      physicalScreen:
        fingerprint.physical_width && fingerprint.physical_height
          ? {
              width: Math.round(fingerprint.physical_width),
              height: Math.round(fingerprint.physical_height),
            }
          : undefined,
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

    const deviceId = fingerprint.device_id || fingerprint.deviceId;

    // Snapshot of what the app sent, stored on the attempt record so the
    // admin view can diff it against the click side later.
    const appFingerprintSnapshot = {
      ipAddress: normalizedFingerprint.ipAddress,
      screen: normalizedFingerprint.screen,
      physicalScreen: normalizedFingerprint.physicalScreen,
      language: normalizedFingerprint.language,
      timezone: normalizedFingerprint.timezone,
      timezoneOffset: normalizedFingerprint.timezoneOffset,
      platform: normalizedFingerprint.platform,
      pixelRatio: normalizedFingerprint.pixelRatio,
      vendor: normalizedFingerprint.vendor,
      connectionType: normalizedFingerprint.connectionType,
      deviceModel: fingerprint.device_model || fingerprint.deviceModel,
      osVersion: fingerprint.os_version || fingerprint.osVersion,
      appVersion: fingerprint.app_version || fingerprint.appVersion,
      userAgent: normalizedFingerprint.userAgent,
    };

    // Get tenant settings for match threshold and deferred link toggle
    const tenant = await TenantModel.findById(auth.tenantId);

    // Check if deferred deep linking is enabled (default: true)
    const deferredEnabled = tenant?.settings?.enableDeferredDeepLink !== false;
    if (!deferredEnabled) {
      logger.info({ tenantId: auth.tenantId }, 'Deferred deep linking disabled for tenant');

      await recordMatchAttempt({
        tenantId: auth.tenantId,
        deviceId,
        platform: normalizedFingerprint.platform,
        outcome: 'disabled',
        reason: 'deferred_disabled',
        threshold: tenant?.settings?.matchThreshold || 68,
        candidates: [],
        selectedIndex: -1,
        appFingerprint: appFingerprintSnapshot,
        ipAddress: ip,
        startedAt,
      });

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

    const matchThreshold = tenant?.settings?.matchThreshold || 68;

    // Find matching deferred link
    const {
      deferredLink,
      candidates,
      selectedIndex,
      reason,
    } = await DeferredService.matchDeferredLink(
      auth.tenantId,
      normalizedFingerprint,
      matchThreshold
    );

    // Update install record with match result
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
      const best = candidates[0];

      logger.info(
        {
          tenantId: auth.tenantId,
          reason,
          candidateCount: candidates.length,
          bestConfidence: best?.confidence || 0,
          matchThreshold,
          appFingerprint: {
            ip: normalizedFingerprint.ipAddress,
            screen: normalizedFingerprint.screen,
            physicalScreen: normalizedFingerprint.physicalScreen,
            language: normalizedFingerprint.language,
            timezone: normalizedFingerprint.timezone,
            timezoneOffset: normalizedFingerprint.timezoneOffset,
          },
        },
        '❌ No deferred link matched — returning debug comparison'
      );

      await recordMatchAttempt({
        tenantId: auth.tenantId,
        deviceId,
        platform: normalizedFingerprint.platform,
        outcome: 'organic',
        reason,
        threshold: matchThreshold,
        candidates,
        selectedIndex: -1,
        appFingerprint: appFingerprintSnapshot,
        ipAddress: ip,
        startedAt,
      });

      // Emit organic outcome so the Install Log can mark this install
      // (matched by deviceId to the earlier `install` event) as organic.
      liveEvents.emit({
        type: 'deferred_match',
        tenantId: auth.tenantId,
        device: { os: normalizedFingerprint.platform || undefined },
        metadata: {
          matchResult: 'organic',
          matchScore: 0,
          channel: 'app_install',
          deviceId: deviceId || undefined,
          ip,
        },
      });

      const response = NextResponse.json(
        successResponse({
          matched: false,
          deferredLinkId: null,
          // Debug info: what the app sent, plus why the closest click lost —
          // the same breakdown the admin match-analysis page renders.
          debug: {
            appFingerprint: appFingerprintSnapshot,
            matchThreshold,
            reason,
            candidateCount: candidates.length,
            bestConfidence: best?.confidence || 0,
            bestSignals: best?.details.signals || [],
            message:
              'No matching fingerprint found. See /admin/match-analysis for the full breakdown.',
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

    // Mark the original click as 'app_installed' (new install via deferred match).
    // Chain: deferredLink.fingerprintId → fingerprint.clickId → click
    let fpClickId: string | undefined;
    try {
      const fp = await FingerprintModel.findById(deferredLink.fingerprintId).select('clickId').lean();
      if (fp?.clickId) {
        fpClickId = fp.clickId.toString();
        await ClickModel.updateOne(
          { _id: fp.clickId },
          { $set: { actionTaken: 'app_installed', isAppInstalled: true } }
        );
        logger.info({ clickId: fp.clickId }, 'Original click marked as app_installed');
      }
    } catch (clickErr) {
      // Non-blocking
      logger.debug({ error: String(clickErr) }, 'Failed to update click to app_installed');
    }

    // Look up link for title/shortCode + geo for live event
    let installLinkTitle: string | undefined;
    let installShortCode: string | undefined;
    try {
      const installLink = await LinkModel.findById(deferredLink.linkId).select('title shortCode').lean();
      if (installLink) {
        installLinkTitle = (installLink as any).title || (installLink as any).shortCode;
        installShortCode = (installLink as any).shortCode;
      }
    } catch {}
    const matchGeo = await lookupGeo(ip, request);

    await recordMatchAttempt({
      tenantId: auth.tenantId,
      deviceId,
      platform: normalizedFingerprint.platform,
      outcome: 'matched',
      reason,
      threshold: matchThreshold,
      candidates,
      selectedIndex,
      appFingerprint: appFingerprintSnapshot,
      matchedLinkId: deferredLink.linkId,
      matchedDeferredLinkId: deferredLink._id,
      matchedFingerprintId: deferredLink.fingerprintId,
      matchedClickId: fpClickId,
      ipAddress: ip,
      country: matchGeo?.country || undefined,
      city: matchGeo?.city || undefined,
      startedAt,
    });

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

      liveEvents.emit({
        type: 'deferred_match',
        linkId: deferredLink.linkId?.toString(),
        linkTitle: installLinkTitle,
        shortCode: installShortCode,
        tenantId: auth.tenantId,
        device: {
          os: normalizedFingerprint.platform || undefined,
          browser: undefined,
          type: undefined,
        },
        geo: {
          country: matchGeo?.country || undefined,
          city: matchGeo?.city || undefined,
        },
        metadata: {
          clickId: fpClickId,
          channel: 'app_install',
          matchResult: 'matched',
          destinationUrl: deferredLink.destinationUrl,
          redirectUrl: deferredLink.destinationUrl,
          matchScore: deferredLink.matchScore,
          deviceId: deviceId || undefined,
          ip,
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
