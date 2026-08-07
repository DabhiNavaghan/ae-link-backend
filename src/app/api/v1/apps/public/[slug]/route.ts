export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { applyCors } from '@/lib/middleware/cors';
import AppModel from '@/lib/models/App';
import { Types } from 'mongoose';

/**
 * GET /api/v1/apps/public/[slug]
 * Public endpoint — returns store URLs for a given app slug or ID.
 * No auth required (store URLs are public data).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    await connectDB();
  } catch {
    return applyCors(request, new NextResponse(JSON.stringify({ error: 'DB error' }), { status: 500 }));
  }

  try {
    const { slug } = params;

    // Accept either a human-readable slug or a MongoDB ObjectId
    // Use $ne: false so apps where isActive was never explicitly set are still found
    const activeFilter = { isActive: { $ne: false } };
    const query = Types.ObjectId.isValid(slug)
      ? { $or: [{ slug }, { _id: new Types.ObjectId(slug) }], ...activeFilter }
      : { slug, ...activeFilter };

    const app = await AppModel.findOne(query).select('name slug android ios info').lean();

    if (!app) {
      return applyCors(
        request,
        new NextResponse(JSON.stringify({ error: 'Not found' }), { status: 404 })
      );
    }

    const info = (app as any).info || {};
    const response = NextResponse.json({
      id: String((app as any)._id),
      name: app.name,
      slug: (app as any).slug,
      androidStoreUrl: (app as any).android?.storeUrl || null,
      iosStoreUrl: (app as any).ios?.storeUrl || null,
      // Marketing copy for the store page. The imagery is referenced by app id
      // through the asset proxy rather than by its raw CDN URL, so the page
      // never depends on a third party loading — see /app-asset/[appId]/[kind].
      tagline: info.tagline || null,
      description: info.description || null,
      marketingUrl: info.marketingUrl || null,
      hasIcon: Boolean(info.iconUrl),
      hasScreenshot: Boolean(info.screenshotUrl),
    });
    return applyCors(request, response);
  } catch {
    return applyCors(request, new NextResponse(JSON.stringify({ error: 'Server error' }), { status: 500 }));
  }
}
