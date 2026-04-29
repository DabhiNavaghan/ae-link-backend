export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import InstallModel from '@/lib/models/Install';
import TenantModel from '@/lib/models/Tenant';
import AppModel from '@/lib/models/App';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

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

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // ── Validate package/bundle ID against App config ──
    let appValid = true;
    let appWarning: string | null = null;

    if (packageName) {
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

        if (!matchingApp) {
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

    let installType: 'first_install' | 'reinstall' | 'return_user';

    if (!existingInstall) {
      if (isExistingUser) {
        // Host app explicitly told us this is an existing user
        installType = 'return_user';
      } else if (isFirstLaunch) {
        // SDK says first launch + no DB record = genuine new install
        installType = 'first_install';
      } else {
        // SDK says NOT first launch but no DB record = existing user
        // (app was installed before we started tracking)
        installType = 'return_user';
      }

      await InstallModel.create({
        tenantId: auth.tenantId,
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
      });

      logger.info(
        { tenantId: auth.tenantId, deviceId, platform, installType },
        'New install recorded'
      );
    } else if (isFirstLaunch) {
      // We've seen this device before but SDK says first launch — reinstall
      installType = 'reinstall';

      existingInstall.installType = 'reinstall';
      existingInstall.appVersion = appVersion || existingInstall.appVersion;
      existingInstall.appBuildNumber = appBuildNumber || existingInstall.appBuildNumber;
      existingInstall.osVersion = osVersion || existingInstall.osVersion;
      existingInstall.launchCount += 1;
      existingInstall.lastSeenAt = new Date();
      existingInstall.ipAddress = ip;
      existingInstall.matchResult = 'skipped'; // Reset for new deferred match
      await existingInstall.save();

      logger.info(
        { tenantId: auth.tenantId, deviceId, platform, installType },
        'Reinstall detected'
      );
    } else {
      // Known device, not first launch — returning user
      installType = 'return_user';

      existingInstall.launchCount += 1;
      existingInstall.lastSeenAt = new Date();
      existingInstall.appVersion = appVersion || existingInstall.appVersion;
      existingInstall.ipAddress = ip;
      await existingInstall.save();

      logger.debug(
        { tenantId: auth.tenantId, deviceId, launchCount: existingInstall.launchCount },
        'Return user launch'
      );
    }

    // ── Get tenant settings ──
    const tenant = await TenantModel.findById(auth.tenantId).lean();

    const response = NextResponse.json(
      successResponse({
        valid: true,
        appValid,
        appWarning,
        installType,
        deviceId,
        config: {
          matchThreshold: tenant?.settings?.matchThreshold || 60,
          fingerprintTtlHours: tenant?.settings?.fingerprintTtlHours || 6,
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
