export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors, handleCorsPreFlight } from '@/lib/middleware/cors';
import { eraseIdentity } from '@/lib/services/identity.service';
import IdentityModel from '@/lib/models/Identity';
import EventModel from '@/lib/models/Event';
import LinkModel from '@/lib/models/Link';
import CampaignModel from '@/lib/models/Campaign';
import { successResponse, errorResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'identity-detail' });

/** How many recent events the detail view returns inline. */
const TIMELINE_LIMIT = 100;

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreFlight(request) ?? new NextResponse(null, { status: 204 });
}

/**
 * GET /api/v1/identity/:userId
 *
 * The user detail view: acquisition link and campaign, every device they've
 * used, and a recent event timeline. This is also the screen that makes a
 * data-subject access request answerable in minutes rather than as a project.
 *
 * Requires a TENANT key, like DELETE below. This response carries the most
 * personal data the platform holds — traits, an email hash, and a full activity
 * timeline — and an app key ships inside a distributable binary, so accepting
 * one here would let anyone who decompiled the app read any user by iterating ids.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await connectDB();
  } catch {
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR('Database connection failed'), {
        status: 500,
      })
    );
  }

  const auth = await requireAuth(request);
  if (!auth) {
    return applyCors(
      request,
      NextResponse.json(Errors.UNAUTHORIZED(), { status: 401 })
    );
  }

  if (auth.appId) {
    return applyCors(
      request,
      NextResponse.json(
        errorResponse(
          'FORBIDDEN',
          'Reading user detail requires a tenant API key. App keys are distributed inside your app binary and cannot authorise access to personal data.'
        ),
        { status: 403 }
      )
    );
  }

  const { allowed } = checkRateLimit(request, auth.tenantId);
  if (!allowed) {
    return applyCors(
      request,
      NextResponse.json(Errors.RATE_LIMIT(), { status: 429 })
    );
  }

  const userId = decodeURIComponent(params.userId || '');
  if (!userId) {
    return applyCors(
      request,
      NextResponse.json(Errors.VALIDATION_ERROR({ userId: 'Required' }), {
        status: 400,
      })
    );
  }

  try {
    // Always scoped by tenantId — a valid key for tenant A must not be able to
    // read tenant B's user by guessing an id.
    const identity = await IdentityModel.findOne({
      tenantId: auth.tenantId,
      userId,
    }).lean();

    if (!identity) {
      return applyCors(
        request,
        NextResponse.json(Errors.NOT_FOUND('User'), { status: 404 })
      );
    }

    const [timeline, acquisitionLink, acquisitionCampaign] = await Promise.all([
      EventModel.find({ tenantId: auth.tenantId, userId })
        .sort({ occurredAt: -1 })
        .limit(TIMELINE_LIMIT)
        .select(
          'name occurredAt value currency platform sessionId deviceId properties attribution'
        )
        .lean(),
      identity.acquisition?.linkId
        ? LinkModel.findById(identity.acquisition.linkId)
            .select('title shortCode destinationUrl')
            .lean()
        : null,
      identity.acquisition?.campaignId
        ? CampaignModel.findById(identity.acquisition.campaignId)
            .select('name slug status')
            .lean()
        : null,
    ]);

    return applyCors(
      request,
      NextResponse.json(
        successResponse({
          userId: identity.userId,
          firstSeenAt: identity.firstSeenAt,
          identifiedAt: identity.identifiedAt,
          lastSeenAt: identity.lastSeenAt,
          eventCount: identity.eventCount,
          totalValue: identity.totalValue,
          lastEventAt: identity.lastEventAt,
          traits: identity.traits || {},
          // The hash is returned so support can confirm an address matches
          // without the platform ever having to store or display it.
          emailHash: identity.emailHash || null,
          devices: identity.devices || [],
          acquisition: identity.acquisition
            ? {
                ...identity.acquisition,
                link: acquisitionLink
                  ? {
                      id: String((acquisitionLink as any)._id),
                      title: (acquisitionLink as any).title,
                      shortCode: (acquisitionLink as any).shortCode,
                    }
                  : null,
                campaign: acquisitionCampaign
                  ? {
                      id: String((acquisitionCampaign as any)._id),
                      name: (acquisitionCampaign as any).name,
                      slug: (acquisitionCampaign as any).slug,
                    }
                  : null,
              }
            : null,
          timeline,
          timelineTruncated: timeline.length === TIMELINE_LIMIT,
        }),
        { status: 200 }
      )
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message, tenantId: auth.tenantId }, 'Identity fetch failed');
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR(), { status: 500 })
    );
  }
}

/**
 * DELETE /api/v1/identity/:userId
 *
 * Erasure as a single supported operation, not a bespoke script.
 *
 * The identity row is deleted and the person's events are anonymised in place,
 * so aggregate counts stay intact and historical reports don't silently change
 * after a request is honoured.
 *
 * Requires a TENANT key. An app key ships inside a distributable binary, so
 * accepting one here would let anyone who decompiled the app erase users.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await connectDB();
  } catch {
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR('Database connection failed'), {
        status: 500,
      })
    );
  }

  const auth = await requireAuth(request);
  if (!auth) {
    return applyCors(
      request,
      NextResponse.json(Errors.UNAUTHORIZED(), { status: 401 })
    );
  }

  if (auth.appId) {
    return applyCors(
      request,
      NextResponse.json(
        errorResponse(
          'FORBIDDEN',
          'Erasure requires a tenant API key. App keys are distributed inside your app binary and cannot authorise deletion.'
        ),
        { status: 403 }
      )
    );
  }

  const userId = decodeURIComponent(params.userId || '');
  if (!userId) {
    return applyCors(
      request,
      NextResponse.json(Errors.VALIDATION_ERROR({ userId: 'Required' }), {
        status: 400,
      })
    );
  }

  try {
    const result = await eraseIdentity(auth.tenantId, userId);

    logger.warn(
      { tenantId: auth.tenantId, ...result },
      'Identity erasure executed'
    );

    return applyCors(
      request,
      NextResponse.json(successResponse(result), { status: 200 })
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message, tenantId: auth.tenantId }, 'Erasure failed');
    return applyCors(
      request,
      NextResponse.json(Errors.INTERNAL_ERROR(), { status: 500 })
    );
  }
}
