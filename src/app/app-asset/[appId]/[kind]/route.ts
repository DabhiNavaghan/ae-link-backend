import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import AppModel from '@/lib/models/App';
import { safeHttpUrl } from '@/lib/utils/url';
import { AppAssetKind } from '@/types';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'app-asset' });

/** Give up rather than hold a page request open on a slow third party. */
const FETCH_TIMEOUT_MS = 5000;
/** A brand shot can reasonably be larger than an icon, but not unbounded. */
const MAX_BYTES: Record<AppAssetKind, number> = {
  icon: 2 * 1024 * 1024,
  screenshot: 8 * 1024 * 1024,
};
const CACHE_SECONDS = 60 * 60 * 24 * 7;

const FIELD_BY_KIND: Record<AppAssetKind, 'iconUrl' | 'screenshotUrl'> = {
  icon: 'iconUrl',
  screenshot: 'screenshotUrl',
};

function isAssetKind(value: string): value is AppAssetKind {
  return value === 'icon' || value === 'screenshot';
}

/**
 * GET /app-asset/:appId/:kind  — kind is `icon` or `screenshot`
 *
 * Serves an app's configured imagery from our own origin.
 *
 * These are stored as URLs on someone else's CDN, and letting the browser
 * fetch them directly made them fail intermittently — a rate limit, a content
 * blocker or a slow third party each turned into a blank hole on the page.
 * Proxying puts the fetch on our side, where it is cached and where a failure
 * is a clean 404 the client can fall back from.
 *
 * Note the URL is looked up from the app record rather than taken from the
 * query string: this endpoint is public, and a proxy that fetches whatever URL
 * a caller names is an SSRF hole. Here the only reachable URLs are ones an
 * operator already saved, and those are validated as http(s) on write.
 *
 * Deliberately lives outside /api so it is not caught by the no-store
 * Cache-Control that next.config.js applies to /api/:path*.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { appId: string; kind: string } }
) {
  const { appId, kind } = params;

  if (!Types.ObjectId.isValid(appId) || !isAssetKind(kind)) {
    return new NextResponse(null, { status: 404 });
  }

  const field = FIELD_BY_KIND[kind];

  try {
    await connectDB();
    const app = await AppModel.findById(appId).select(`info.${field}`).lean();
    const assetUrl = safeHttpUrl(app?.info?.[field]);

    if (!assetUrl) {
      return new NextResponse(null, { status: 404 });
    }

    const upstream = await fetch(assetUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // The image is public art; sending our referrer leaks which links exist.
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'image/*' },
      next: { revalidate: CACHE_SECONDS },
    });

    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !contentType.startsWith('image/')) {
      logger.debug(
        { appId, kind, status: upstream.status, contentType },
        'Asset upstream did not return an image'
      );
      return new NextResponse(null, { status: 404 });
    }

    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_BYTES[kind]) {
      logger.debug({ appId, kind, bytes: body.byteLength }, 'Asset too large');
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.byteLength),
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`,
        // Never reflect an upstream redirect target or anything scriptable.
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    logger.debug({ appId, kind, error: String(error) }, 'Asset proxy failed');
    // A 404 lets the client fall back; an error page would be a broken image.
    return new NextResponse(null, { status: 404 });
  }
}
