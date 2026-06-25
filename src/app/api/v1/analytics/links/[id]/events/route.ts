import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { applyCors } from '@/lib/middleware/cors';
import ClickModel from '@/lib/models/Click';
import ConversionModel from '@/lib/models/Conversion';
import { successResponse, Errors } from '@/utils/response';
import { Types } from 'mongoose';

/**
 * GET /api/v1/analytics/links/:id/events?action=store_redirect&page=1&limit=20
 *
 * Returns paginated click/event records for a specific link,
 * filtered by actionTaken. Used by the funnel detail view.
 *
 * Query params:
 *   action  — filter by actionTaken (store_redirect, app_opened, web_fallback, app_installed)
 *             or special value "install" for ConversionModel records
 *   page    — page number (default 1)
 *   limit   — items per page (default 20, max 100)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
  } catch {
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR(), { status: 500 })
    );
  }

  const auth = await requireAuth(request);
  if (!auth) {
    return applyCors(
      request,
      NextResponse.json(Errors.UNAUTHORIZED(), { status: 401 })
    );
  }

  try {
    const linkId = params.id;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const linkObjId = new Types.ObjectId(linkId);

    // Special case: "install" fetches from ConversionModel with joined data
    if (action === 'install') {
      const [records, totalArr] = await Promise.all([
        ConversionModel.aggregate([
          { $match: { linkId: linkObjId, deferredLinkId: { $exists: true, $ne: null } } },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          // Join deferred link
          { $lookup: { from: 'deferredlinks', localField: 'deferredLinkId', foreignField: '_id', as: 'deferred' } },
          { $unwind: { path: '$deferred', preserveNullAndEmptyArrays: true } },
          // Join fingerprint
          { $lookup: { from: 'fingerprints', localField: 'deferred.fingerprintId', foreignField: '_id', as: 'fingerprint' } },
          { $unwind: { path: '$fingerprint', preserveNullAndEmptyArrays: true } },
          // Join original click
          { $lookup: { from: 'clicks', localField: 'fingerprint.clickId', foreignField: '_id', as: 'click' } },
          { $unwind: { path: '$click', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              createdAt: 1,
              conversionType: 1,
              deviceId: 1,
              metadata: 1,
              matchScore: '$deferred.matchScore',
              matchDetails: '$deferred.matchDetails',
              destinationUrl: '$deferred.destinationUrl',
              deferredParams: '$deferred.params',
              fingerprintIp: '$fingerprint.ipAddress',
              fingerprintScreen: '$fingerprint.screen',
              fingerprintPlatform: '$fingerprint.platform',
              fingerprintTimezone: '$fingerprint.timezone',
              clickDevice: '$click.device',
              clickGeo: '$click.geo',
              clickChannel: '$click.channel',
              clickIp: '$click.ipAddress',
              clickCreatedAt: '$click.createdAt',
            },
          },
        ]),
        ConversionModel.aggregate([
          { $match: { linkId: linkObjId, deferredLinkId: { $exists: true, $ne: null } } },
          { $count: 'total' },
        ]),
      ]);

      const total = totalArr[0]?.total || 0;

      return applyCors(
        request,
        NextResponse.json(
          successResponse({
            events: records,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
          })
        )
      );
    }

    // Regular clicks filtered by actionTaken
    const query: Record<string, any> = { linkId: linkObjId };
    if (action !== 'all') {
      query.actionTaken = action;
    }

    const [records, total] = await Promise.all([
      ClickModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ClickModel.countDocuments(query),
    ]);

    return applyCors(
      request,
      NextResponse.json(
        successResponse({
          events: records.map((r: any) => ({
            _id: r._id,
            createdAt: r.createdAt,
            actionTaken: r.actionTaken,
            channel: r.channel,
            device: r.device,
            geo: r.geo,
            ipAddress: r.ipAddress,
            userAgent: r.userAgent,
            isAppInstalled: r.isAppInstalled,
            metadata: r.metadata,
            referer: r.referer,
          })),
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        })
      )
    );
  } catch {
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR(), { status: 500 })
    );
  }
}
