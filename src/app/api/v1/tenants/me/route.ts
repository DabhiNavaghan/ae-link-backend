export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import { applyCors } from '@/lib/middleware/cors';
import TenantModel from '@/lib/models/Tenant';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'tenants/me' });

/**
 * GET /api/v1/tenants/me
 * Look up tenant by Clerk session userId — no API key needed.
 * Used to auto-recover API key on new devices after sign-in.
 *
 * Strategy:
 * 1. Try exact match by clerkUserId (fast path for linked accounts)
 * 2. Fallback: get user email from Clerk, extract domain, match tenant by domain
 *    — auto-links clerkUserId for future lookups
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();

    if (!userId) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.UNAUTHORIZED()),
        { status: 401 }
      );
      return applyCors(request, errorRes);
    }

    await connectDB();

    // 1. Fast path: direct clerkUserId match
    let tenant: any = await TenantModel.findOne({
      clerkUserId: userId,
      isActive: true,
    }).select('-apiSecret');

    // 2. Fallback: match by email domain → tenant domain
    //    Handles existing tenants created before clerkUserId was added
    if (!tenant) {
      try {
        const user = await clerkClient().users.getUser(userId);
        const primaryEmail =
          user.emailAddresses?.find(
            (e: any) => e.id === user.primaryEmailAddressId
          )?.emailAddress || user.emailAddresses?.[0]?.emailAddress;

        if (primaryEmail) {
          const emailDomain = primaryEmail.split('@')[1]?.toLowerCase();
          if (emailDomain) {
            tenant = await TenantModel.findOne({
              domain: emailDomain,
              isActive: true,
            }).select('-apiSecret');

            // Auto-link clerkUserId so future lookups are instant
            if (tenant) {
              tenant.clerkUserId = userId;
              await tenant.save();
              logger.info(
                { userId, tenantId: tenant._id, domain: emailDomain },
                'Auto-linked Clerk user to existing tenant via email domain'
              );
            }
          }
        }
      } catch (clerkErr) {
        logger.warn({ userId, error: String(clerkErr) }, 'Failed to fetch Clerk user for domain fallback');
      }
    }

    if (!tenant) {
      const errorRes = new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Tenant')),
        { status: 404 }
      );
      return applyCors(request, errorRes);
    }

    logger.info({ userId, tenantId: tenant._id }, 'Tenant recovered via Clerk session');

    const response = NextResponse.json(
      successResponse({
        tenantId: tenant._id,
        name: tenant.name,
        domain: tenant.domain,
        apiKey: tenant.apiKey,
      }),
      { status: 200 }
    );

    return applyCors(request, response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message, stack: err.stack }, 'Tenant me lookup error');
    const errorRes = new NextResponse(
      JSON.stringify(Errors.INTERNAL_ERROR(err.message)),
      { status: 500 }
    );
    return applyCors(request, errorRes);
  }
}
