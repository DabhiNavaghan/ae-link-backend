export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { applyCors } from '@/lib/middleware/cors';
import AppModel from '@/lib/models/App';
import AppVisitModel from '@/lib/models/AppVisit';
import { DeviceDetector } from '@/lib/services/device-detector';
import { lookupGeo } from '@/lib/services/geo.service';
import { getClientIp } from '@/lib/get-client-ip';
import { StoreSentTo } from '@/types';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'app-store-visit' });

/** Repeat loads from the same device inside this window count once. */
const DEDUPE_WINDOW_MS = 30_000;

function asSentTo(value: unknown): StoreSentTo {
  return value === 'ios' || value === 'android' ? value : 'none';
}

/** Trim caller-supplied strings so a hostile page cannot store an essay. */
function str(value: unknown, max = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/**
 * POST /api/v1/apps/public/:slug/visit
 *
 * Records a visit to an app's public store page. Public and unauthenticated,
 * because the page it serves is.
 *
 * The client reports only what the server cannot see for itself — the UTMs
 * from the page URL and which store it ended up handing off to, which is
 * decided after OS detection in the browser. Everything identifying (IP,
 * user agent, referer, geo, device) is read server-side from the request, so
 * a caller cannot dress a visit up as something it was not.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    await connectDB();
  } catch {
    return applyCors(request, new NextResponse(null, { status: 204 }));
  }

  try {
    const { slug } = params;
    const activeFilter = { isActive: { $ne: false } };
    const query = Types.ObjectId.isValid(slug)
      ? { $or: [{ slug }, { _id: new Types.ObjectId(slug) }], ...activeFilter }
      : { slug, ...activeFilter };

    const app = await AppModel.findOne(query).select('_id tenantId').lean();
    if (!app) {
      return applyCors(request, new NextResponse(null, { status: 204 }));
    }

    const userAgent = request.headers.get('user-agent') || '';
    const detector = new DeviceDetector(userAgent);

    // Crawlers hit this page when the link is pasted somewhere, long before a
    // human sees it. Counting them would make the store page look busier than
    // it is — the same reason click recording skips them.
    if (detector.isBot()) {
      return applyCors(request, new NextResponse(null, { status: 204 }));
    }

    const ip = getClientIp(request) || '127.0.0.1';
    const appId = (app as any)._id;

    // A reload, a back-navigation or a double-fired effect is the same visit.
    const recent = await AppVisitModel.findOne({
      appId,
      ipAddress: ip,
      createdAt: { $gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
    })
      .select('_id')
      .lean();

    if (recent) {
      return applyCors(request, new NextResponse(null, { status: 204 }));
    }

    const body = await request.json().catch(() => ({}));
    const geo = await lookupGeo(ip, request);

    const utm = {
      source: str(body?.utmSource),
      medium: str(body?.utmMedium),
      campaign: str(body?.utmCampaign),
      term: str(body?.utmTerm),
      content: str(body?.utmContent),
    };
    const hasUtm = Object.values(utm).some(Boolean);

    await AppVisitModel.create({
      appId,
      tenantId: (app as any).tenantId,
      ipAddress: ip,
      userAgent,
      referer: request.headers.get('referer') || undefined,
      device: detector.detect(),
      geo,
      sentTo: asSentTo(body?.sentTo),
      ...(hasUtm && { utm }),
    });

    return applyCors(request, new NextResponse(null, { status: 204 }));
  } catch (error) {
    // Analytics must never be the reason a visitor fails to reach the store.
    logger.debug({ error: String(error) }, 'Store page visit not recorded');
    return applyCors(request, new NextResponse(null, { status: 204 }));
  }
}
