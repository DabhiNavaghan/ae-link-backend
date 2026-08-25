export const maxDuration = 30;

import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import InstallModel from '@/lib/models/Install';
import TenantModel from '@/lib/models/Tenant';
import AppModel from '@/lib/models/App';
import LinkModel from '@/lib/models/Link';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import { getClientIp } from '@/lib/get-client-ip';
import { getLinkDomainsForSdk } from '@/lib/utils/domain-map.server';
import { hostMatchesLinkDomains } from '@/lib/utils/link-domain-match';
import { liveEvents } from '@/lib/services/live-events';
import { lookupGeo } from '@/lib/services/geo.service';

const logger = Logger.child({ route: 'sdk-init' });

/**
 * POST /api/v1/sdk/init
 *
 * Called by the Flutter SDK on every app launch. This:
 * 1. Validates the API key
 * 2. Optionally validates app package/bundle ID
 * 3. Records the install/launch (first install, reinstall, or return user)
 * 4. Returns tenant config needed by the SDK
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

  // Validate API key
  const auth = await requireAuth(request);
  if (!auth) {
    const errorRes = new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'API key is invalid or inactive. Check your dashboard Settings.',
        },
      }),
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
    const {
      deviceId,
      platform,
      packageName,
      appVersion,
      appBuildNumber,
      osVersion,
      deviceModel,
      deviceManufacturer,
      locale,
      timezone,
      isFirstLaunch,
      isExistingUser,
      // Source tracking — sent by SDK when app is opened via a deep link
      launchSource,
      launchMedium,
      launchCampaign,
      launchLinkId,
      launchUrl,
    } = body;

    if (!deviceId || !platform) {
      const errorRes = new NextResponse(
        JSON.stringify(
          Errors.VALIDATION_ERROR({
            deviceId: !deviceId ? 'Required' : undefined,
            platform: !platform ? 'Required' : undefined,
          })
        ),
        { status: 400 }
      );
      return applyCors(request, errorRes);
    }

    const ip = getClientIp(request) || '127.0.0.1';

    // ── Resolve appId ──
    // If using an app-level key, auth.appId is already set.
    // Otherwise, try to match by packageName.
    let resolvedAppId: string | undefined = auth.appId;
    let appValid = true;
    let appWarning: string | null = null;

    if (!resolvedAppId && packageName) {
      // Tenant-level key — match package/bundleId to find the app
      const apps = await AppModel.find({
        tenantId: auth.tenantId,
        isActive: true,
      }).lean();

      if (apps.length > 0) {
        const matchingApp = apps.find((app) => {
          if (platform === 'android' && app.android?.package) {
            return app.android.package === packageName;
          }
          if (platform === 'ios' && app.ios?.bundleId) {
            return app.ios.bundleId === packageName;
          }
          return false;
        });

        if (matchingApp) {
          resolvedAppId = (matchingApp._id as any).toString();
        } else {
          appValid = false;
          appWarning = `Package "${packageName}" does not match any registered app. ` +
            `Register it in the dashboard under Apps.`;
          logger.warn(
            { tenantId: auth.tenantId, packageName, platform },
            'SDK init: package name mismatch'
          );
        }
      }
    }

    // ── Track install / launch ──
    const existingInstall = await InstallModel.findOne({
      tenantId: auth.tenantId,
      deviceId,
    });

    let installType: 'first_install' | 'reinstall' | 'open';

    // ── Link domains for this app ──
    // Derived from the app's own package / bundle id, so an integrator never
    // passes a domain list in code. Scoped to the authenticated app: an SDK
    // client never learns another tenant's hosts. Falls back to the tenant's
    // set when the package name matched no registered app, so an install
    // still learns its domains instead of treating every short link as
    // external. Also used to classify launchUrl below.
    const linkDomains = await getLinkDomainsForSdk({
      tenantId: auth.tenantId,
      appId: resolvedAppId,
      packageName,
    });

    // Source info sent by SDK (from deep link URL if app was opened via a link).
    //
    // On the very first launch the SDK has no cached domain list yet, so it
    // cannot tell whether launchUrl is one of ours and sends no launch* fields.
    // Derive them here instead — the server always knows the domains, so
    // first-install attribution does not depend on the SDK having been told.
    const launchAttribution = deriveLaunchAttribution(launchUrl, linkDomains);

    const sourceFields = {
      lastSource: launchSource || launchAttribution.source,
      lastMedium: launchMedium || launchAttribution.medium,
      lastCampaign: launchCampaign || launchAttribution.campaign,
      lastLinkId: launchLinkId || launchAttribution.linkId,
      lastLaunchUrl: launchUrl || null,
    };

    if (!existingInstall) {
      if (isExistingUser) {
        // Host app explicitly told us this is an existing user
        installType = 'open';
      } else if (isFirstLaunch) {
        // SDK says first launch + no DB record = genuine new install
        installType = 'first_install';
      } else {
        // SDK says NOT first launch but no DB record = existing user
        // (app was installed before we started tracking)
        installType = 'open';
      }

      await InstallModel.create({
        tenantId: auth.tenantId,
        appId: resolvedAppId || undefined,
        deviceId,
        platform,
        packageName,
        appVersion,
        appBuildNumber,
        osVersion,
        deviceModel,
        deviceManufacturer,
        locale,
        timezone,
        installType,
        matchResult: 'skipped', // Will be updated by deferred match flow
        ipAddress: ip,
        launchCount: 1,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        ...sourceFields,
      });

      logger.info(
        { tenantId: auth.tenantId, deviceId, platform, installType, source: launchSource },
        'New install recorded'
      );
    } else if (isFirstLaunch) {
      // We've seen this device before but SDK says first launch — reinstall
      installType = 'reinstall';

      existingInstall.installType = 'reinstall';
      if (resolvedAppId) existingInstall.appId = new (mongoose.Types.ObjectId as any)(resolvedAppId);
      existingInstall.appVersion = appVersion || existingInstall.appVersion;
      existingInstall.appBuildNumber = appBuildNumber || existingInstall.appBuildNumber;
      existingInstall.osVersion = osVersion || existingInstall.osVersion;
      existingInstall.launchCount += 1;
      existingInstall.lastSeenAt = new Date();
      existingInstall.ipAddress = ip;
      existingInstall.matchResult = 'skipped'; // Reset for new deferred match
      // Update source tracking
      Object.assign(existingInstall, sourceFields);
      await existingInstall.save();

      logger.info(
        { tenantId: auth.tenantId, deviceId, platform, installType, source: launchSource },
        'Reinstall detected'
      );
    } else {
      // Known device, not first launch — app open
      installType = 'open';

      existingInstall.installType = 'open';
      if (resolvedAppId) existingInstall.appId = new (mongoose.Types.ObjectId as any)(resolvedAppId);
      existingInstall.launchCount += 1;
      existingInstall.lastSeenAt = new Date();
      existingInstall.appVersion = appVersion || existingInstall.appVersion;
      existingInstall.ipAddress = ip;
      // Update source tracking on every open
      Object.assign(existingInstall, sourceFields);
      await existingInstall.save();

      logger.debug(
        { tenantId: auth.tenantId, deviceId, launchCount: existingInstall.launchCount, source: launchSource },
        'App open'
      );
    }

    // ── Emit live install event (genuine installs only, not app opens) ──
    // Match result isn't known yet — the SDK calls /deferred/match right after,
    // which emits a follow-up event the Install Log merges in by deviceId.
    if (installType === 'first_install' || installType === 'reinstall') {
      try {
        const geo = await lookupGeo(ip, request);

        let linkTitle: string | undefined;
        let shortCode: string | undefined;
        if (launchLinkId) {
          try {
            const link = await LinkModel.findById(launchLinkId).select('title shortCode').lean();
            if (link) {
              linkTitle = (link as any).title || (link as any).shortCode;
              shortCode = (link as any).shortCode;
            }
          } catch {}
        }

        liveEvents.emit({
          type: 'install',
          linkId: launchLinkId || undefined,
          linkTitle,
          shortCode,
          tenantId: auth.tenantId,
          device: {
            os: platform || undefined,
            type: deviceModel || undefined,
          },
          geo: {
            country: geo?.country || undefined,
            city: geo?.city || undefined,
          },
          metadata: {
            installType,
            matchResult: 'pending',
            deviceId,
            ip,
            source: launchSource || undefined,
            medium: launchMedium || undefined,
            campaign: launchCampaign || undefined,
            packageName: packageName || undefined,
            appVersion: appVersion || undefined,
            osVersion: osVersion || undefined,
            deviceModel: deviceModel || undefined,
            deviceManufacturer: deviceManufacturer || undefined,
            locale: locale || undefined,
          },
        });
      } catch (emitErr) {
        // Non-blocking — live feed must never break the install flow
        logger.debug({ error: String(emitErr) }, 'Failed to emit live install event');
      }
    }

    // ── Get tenant settings ──
    const tenant = await TenantModel.findById(auth.tenantId).lean();

    const response = NextResponse.json(
      successResponse({
        valid: true,
        appValid,
        appWarning,
        appId: resolvedAppId || null,
        installType,
        deviceId,
        config: {
          matchThreshold: tenant?.settings?.matchThreshold || 75,
          fingerprintTtlHours: tenant?.settings?.fingerprintTtlHours || 6,
          // Hosts the SDK should treat as first-party SmartLinks. Scoped to
          // this app so the list is not baked into the shipped binary.
          linkDomains,
        },
      }),
      { status: 200 }
    );

    return applyCors(request, response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message, stack: err.stack }, 'SDK init error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR()),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}

/**
 * Pull attribution out of a launch URL, but only when its host is one of this
 * app's own link domains. An external URL that happens to carry `utm_source`
 * must never be credited as a SmartLink launch.
 */
function deriveLaunchAttribution(
  launchUrl: unknown,
  linkDomains: string[]
): { source: string | null; medium: string | null; campaign: string | null; linkId: string | null } {
  const empty = { source: null, medium: null, campaign: null, linkId: null };
  if (typeof launchUrl !== 'string' || !launchUrl) return empty;

  let url: URL;
  try {
    url = new URL(launchUrl);
  } catch {
    return empty;
  }

  if (!hostMatchesLinkDomains(url.hostname, linkDomains)) return empty;

  const q = url.searchParams;
  const segments = url.pathname.split('/').filter(Boolean);
  const shortCode =
    segments.length === 1 && /^[a-zA-Z0-9]{4,15}$/.test(segments[0])
      ? segments[0]
      : null;

  return {
    source: q.get('utm_source') || q.get('utmSource'),
    medium: q.get('utm_medium') || q.get('utmMedium'),
    campaign: q.get('utm_campaign') || q.get('utmCampaign'),
    linkId: shortCode,
  };
}
