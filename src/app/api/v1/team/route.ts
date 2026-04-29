export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { applyCors } from '@/lib/middleware/cors';
import { requireAuth } from '@/lib/middleware/auth';
import TeamMemberModel from '@/lib/models/TeamMember';
import TenantModel from '@/lib/models/Tenant';
import resend from '@/lib/email/resend';
import { buildInviteEmailHtml, buildInviteEmailText } from '@/lib/email/invite-template';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import { TeamRole } from '@/types';

const logger = Logger.child({ route: 'team' });

/**
 * GET /api/v1/team — List team members for the tenant
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
  } catch {
    return applyCors(request, new NextResponse(JSON.stringify(Errors.INTERNAL_ERROR('DB connection failed')), { status: 500 }));
  }

  const auth = await requireAuth(request);
  if (!auth) {
    return applyCors(request, new NextResponse(JSON.stringify(Errors.UNAUTHORIZED()), { status: 401 }));
  }

  try {
    const members = await TeamMemberModel.find({ tenantId: auth.tenantId })
      .sort({ createdAt: -1 })
      .lean();

    return applyCors(request, NextResponse.json(successResponse({ members })));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message }, 'List team members error');
    return applyCors(request, new NextResponse(JSON.stringify(Errors.INTERNAL_ERROR(err.message)), { status: 500 }));
  }
}

/**
 * POST /api/v1/team — Invite a new team member
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
  } catch {
    return applyCors(request, new NextResponse(JSON.stringify(Errors.INTERNAL_ERROR('DB connection failed')), { status: 500 }));
  }

  const auth = await requireAuth(request);
  if (!auth) {
    return applyCors(request, new NextResponse(JSON.stringify(Errors.UNAUTHORIZED()), { status: 401 }));
  }

  const { allowed } = checkRateLimit(request, auth.tenantId);
  if (!allowed) {
    return applyCors(request, new NextResponse(JSON.stringify(Errors.RATE_LIMIT()), { status: 429 }));
  }

  try {
    const body = await request.json();
    const { email, role, inviterName } = body as {
      email: string;
      role: TeamRole;
      inviterName?: string;
    };

    if (!email || !role) {
      return applyCors(request, new NextResponse(
        JSON.stringify(Errors.VALIDATION_ERROR({ email: 'Required', role: 'Required' })),
        { status: 400 }
      ));
    }

    const validRoles: TeamRole[] = ['administrator', 'admin', 'editor', 'analyst'];
    if (!validRoles.includes(role)) {
      return applyCors(request, new NextResponse(
        JSON.stringify(Errors.VALIDATION_ERROR({ role: 'Invalid role' })),
        { status: 400 }
      ));
    }

    // Check if already invited or member
    const existing = await TeamMemberModel.findOne({
      tenantId: auth.tenantId,
      email: email.toLowerCase(),
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return applyCors(request, new NextResponse(
          JSON.stringify(Errors.CONFLICT('User is already a team member')),
          { status: 409 }
        ));
      }
      if (existing.status === 'pending') {
        // Resend invite — update token and expiry
        existing.inviteToken = require('crypto').randomBytes(32).toString('hex');
        existing.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        existing.role = role;
        await existing.save();

        // Send email again
        await sendInviteEmail({
          email: email.toLowerCase(),
          role,
          inviterName: inviterName || 'A team member',
          tenantName: (await TenantModel.findById(auth.tenantId))?.name || 'SmartLink',
          inviteToken: existing.inviteToken,
          request,
        });

        logger.info({ tenantId: auth.tenantId, email }, 'Invite resent');
        return applyCors(request, NextResponse.json(successResponse({ member: existing, resent: true })));
      }
      // expired/revoked — remove and re-create
      await TeamMemberModel.deleteOne({ _id: existing._id });
    }

    // Get tenant info for email
    const tenant = await TenantModel.findById(auth.tenantId);

    const member = new TeamMemberModel({
      tenantId: auth.tenantId,
      email: email.toLowerCase(),
      role,
      invitedBy: inviterName || 'Team admin',
    });

    await member.save();

    // Send invite email
    await sendInviteEmail({
      email: email.toLowerCase(),
      role,
      inviterName: inviterName || 'A team member',
      tenantName: tenant?.name || 'SmartLink',
      inviteToken: member.inviteToken,
      request,
    });

    logger.info({ tenantId: auth.tenantId, email, role }, 'Team member invited');

    return applyCors(request, NextResponse.json(successResponse({ member }), { status: 201 }));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message, stack: err.stack }, 'Invite team member error');
    return applyCors(request, new NextResponse(JSON.stringify(Errors.INTERNAL_ERROR(err.message)), { status: 500 }));
  }
}

async function sendInviteEmail({
  email,
  role,
  inviterName,
  tenantName,
  inviteToken,
  request,
}: {
  email: string;
  role: TeamRole;
  inviterName: string;
  tenantName: string;
  inviteToken: string;
  request: NextRequest;
}) {
  const origin = request.headers.get('origin') || request.nextUrl.origin;
  const acceptUrl = `${origin}/invite/accept?token=${inviteToken}`;

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'SmartLink <noreply@smartlink.dev>';
    logger.info({ to: email, from: fromEmail, acceptUrl }, 'Sending invite email');

    const result = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `You're invited to join ${tenantName} on SmartLink`,
      html: buildInviteEmailHtml({
        inviterName,
        tenantName,
        role,
        acceptUrl,
        expiresInDays: 7,
      }),
      text: buildInviteEmailText({
        inviterName,
        tenantName,
        role,
        acceptUrl,
        expiresInDays: 7,
      }),
    });

    if (result.error) {
      logger.error({ email, resendError: result.error }, 'Resend returned error — email not delivered');
    } else {
      logger.info({ email, resendId: result.data?.id }, 'Invite email sent successfully');
    }
  } catch (emailErr) {
    logger.error({ email, error: String(emailErr) }, 'Failed to send invite email — invite created but email not sent');
  }
}
