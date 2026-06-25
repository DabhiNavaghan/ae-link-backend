import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { applyCors } from '@/lib/middleware/cors';
import ClickModel from '@/lib/models/Click';
import { Logger } from '@/lib/logger';
import { liveEvents } from '@/lib/services/live-events';

const logger = Logger.child({ route: 'clicks' });

/**
 * Shared handler for updating a click to app_opened.
 * Used by both POST (sendBeacon) and PATCH (fetch) handlers.
 */
async function handleAppOpenedUpdate(request: NextRequest) {
  try {
    await connectDB();
  } catch {
    return applyCors(
      request,
      NextResponse.json({ success: false, error: 'DB error' }, { status: 500 })
    );
  }

  try {
    const body = await request.json();
    const { clickId, action } = body;

    if (!clickId || action !== 'app_opened') {
      return applyCors(
        request,
        NextResponse.json({ success: false, error: 'Invalid params' }, { status: 400 })
      );
    }

    await ClickModel.updateOne(
      { _id: clickId },
      { $set: { actionTaken: 'app_opened', isAppInstalled: true } }
    );

    // Emit live event
    const click = await ClickModel.findById(clickId).lean();
    liveEvents.emit({
      type: 'app_opened',
      linkId: click?.linkId?.toString(),
      tenantId: click?.tenantId?.toString(),
      device: {
        os: (click as any)?.device?.os,
        browser: (click as any)?.device?.browser,
        type: (click as any)?.device?.type,
      },
      metadata: { clickId },
    });

    logger.info({ clickId }, 'Click action updated to app_opened');

    return applyCors(
      request,
      NextResponse.json({ success: true })
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message }, 'Click update error');
    return applyCors(
      request,
      NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
    );
  }
}

/**
 * POST /api/v1/clicks
 *
 * Same as PATCH but accepts POST for navigator.sendBeacon compatibility.
 * sendBeacon always sends POST; on mobile the browser kills the page on
 * app switch, so sendBeacon is the only reliable way to fire this call.
 */
export async function POST(request: NextRequest) {
  return handleAppOpenedUpdate(request);
}

/**
 * PATCH /api/v1/clicks
 *
 * Called by the redirect page when the deep link succeeds (app opens).
 * Updates the click's actionTaken from 'store_redirect' to 'app_opened'.
 *
 * Body: { clickId: string, action: 'app_opened' }
 *
 * No auth required — this is called from the public redirect page.
 * Only allows updating to 'app_opened' to prevent abuse.
 */
export async function PATCH(request: NextRequest) {
  return handleAppOpenedUpdate(request);
}
