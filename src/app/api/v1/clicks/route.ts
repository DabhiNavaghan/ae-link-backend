import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { applyCors } from '@/lib/middleware/cors';
import ClickModel from '@/lib/models/Click';
import LinkModel from '@/lib/models/Link';
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

    // Emit live event — enrich with link title/shortCode
    const click = await ClickModel.findById(clickId).lean();
    let clickLinkTitle: string | undefined;
    let clickShortCode: string | undefined;
    if (click?.linkId) {
      try {
        const clickLink = await LinkModel.findById(click.linkId).select('title shortCode').lean();
        if (clickLink) {
          clickLinkTitle = (clickLink as any).title || (clickLink as any).shortCode;
          clickShortCode = (clickLink as any).shortCode;
        }
      } catch {}
    }
    const clickDoc = click as any;
    liveEvents.emit({
      type: 'app_opened',
      linkId: clickDoc?.linkId?.toString(),
      linkTitle: clickLinkTitle,
      shortCode: clickShortCode,
      tenantId: clickDoc?.tenantId?.toString(),
      device: {
        os: clickDoc?.device?.os,
        browser: clickDoc?.device?.browser,
        type: clickDoc?.device?.type,
      },
      geo: {
        country: clickDoc?.geo?.country || undefined,
        city: clickDoc?.geo?.city || undefined,
      },
      metadata: {
        clickId,
        channel: clickDoc?.channel || undefined,
        deepLink: clickDoc?.metadata?.deepLink || undefined,
        destinationUrl: clickDoc?.metadata?.destinationUrl || undefined,
        redirectUrl: clickDoc?.metadata?.destinationUrl || undefined,
        referer: clickDoc?.referer || undefined,
        ip: clickDoc?.ipAddress || undefined,
      },
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
