export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { applyCors } from '@/lib/middleware/cors';
import TeamMemberModel from '@/lib/models/TeamMember';
import TenantModel from '@/lib/models/Tenant';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'team/accept' });

/**
 * POST /api/v1/team/accept — Accept a team invite (public, token-based)
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { token, name, clerkUserId } = body as {
      token: string;
      name?: string;
      clerkUserId?: string;
    };

    if (!token) {
      return applyCors(request, new NextResponse(
        JSON.stringify(Errors.VALIDATION_ERROR({ token: 'Required' })),
        { status: 400 }
      ));
    }

    const member = await TeamMemberModel.findOne({ inviteToken: token });

    if (!member) {
      return applyCors(request, new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Invite not found or already used')),
        { status: 404 }
      ));
    }

    if (member.status === 'accepted') {
      return applyCors(request, new NextResponse(
        JSON.stringify(Errors.CONFLICT('Invite already accepted')),
        { status: 409 }
      ));
    }

    if (member.status === 'revoked') {
      return applyCors(request, new NextResponse(
        JSON.stringify({ success: false, error: { code: 'INVITE_REVOKED', message: 'This invite has been revoked' } }),
        { status: 410 }
      ));
    }

    if (member.expiresAt < new Date()) {
      member.status = 'expired';
      await member.save();
      return applyCors(request, new NextResponse(
        JSON.stringify({ success: false, error: { code: 'INVITE_EXPIRED', message: 'This invite has expired' } }),
        { status: 410 }
      ));
    }

    // Accept the invite
    member.status = 'accepted';
    member.acceptedAt = new Date();
    if (name) member.name = name;
    if (clerkUserId) member.clerkUserId = clerkUserId;
    await member.save();

    // Get tenant info for the response
    const tenant = await TenantModel.findById(member.tenantId).select('name domain apiKey');

    logger.info({ memberId: member._id, email: member.email, tenantId: member.tenantId }, 'Team invite accepted');

    return applyCors(request, NextResponse.json(successResponse({
      member: {
        id: member._id,
        email: member.email,
        role: member.role,
        name: member.name,
      },
      tenant: tenant ? {
        id: tenant._id,
        name: tenant.name,
        domain: tenant.domain,
        apiKey: tenant.apiKey,
      } : null,
    })));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message, stack: err.stack }, 'Accept invite error');
    return applyCors(request, new NextResponse(JSON.stringify(Errors.INTERNAL_ERROR(err.message)), { status: 500 }));
  }
}

/**
 * GET /api/v1/team/accept?token=xxx — Validate an invite token (public)
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return applyCors(request, new NextResponse(
        JSON.stringify(Errors.VALIDATION_ERROR({ token: 'Required' })),
        { status: 400 }
      ));
    }

    const member = await TeamMemberModel.findOne({ inviteToken: token }).lean();

    if (!member) {
      return applyCors(request, new NextResponse(
        JSON.stringify(Errors.NOT_FOUND('Invite not found')),
        { status: 404 }
      ));
    }

    const tenant = await TenantModel.findById(member.tenantId).select('name').lean();

    const isExpired = member.expiresAt < new Date();
    const isValid = member.status === 'pending' && !isExpired;

    return applyCors(request, NextResponse.json(successResponse({
      valid: isValid,
      status: isExpired ? 'expired' : member.status,
      email: member.email,
      role: member.role,
      tenantName: (tenant as any)?.name || 'Unknown',
      invitedBy: member.invitedBy,
      expiresAt: member.expiresAt,
    })));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message }, 'Validate invite error');
    return applyCors(request, new NextResponse(JSON.stringify(Errors.INTERNAL_ERROR(err.message)), { status: 500 }));
  }
}
