export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { applyCors } from '@/lib/middleware/cors';
import { requireAuth } from '@/lib/middleware/auth';
import TeamMemberModel from '@/lib/models/TeamMember';
import { successResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';
import { TeamRole } from '@/types';

const logger = Logger.child({ route: 'team/[id]' });

/**
 * PUT /api/v1/team/:id — Update a team member's role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const body = await request.json();
    const { role, allowedApps } = body as { role?: TeamRole; allowedApps?: string[] };

    const validRoles: TeamRole[] = ['administrator', 'admin', 'editor', 'analyst'];
    if (role && !validRoles.includes(role)) {
      return applyCors(request, new NextResponse(
        JSON.stringify(Errors.VALIDATION_ERROR({ role: 'Invalid role' })),
        { status: 400 }
      ));
    }

    const updateFields: Record<string, any> = {};
    if (role) updateFields.role = role;
    if (allowedApps !== undefined) updateFields.allowedApps = allowedApps;

    const member = await TeamMemberModel.findOneAndUpdate(
      { _id: params.id, tenantId: auth.tenantId },
      { $set: updateFields },
      { new: true }
    );

    if (!member) {
      return applyCors(request, new NextResponse(JSON.stringify(Errors.NOT_FOUND('Team member')), { status: 404 }));
    }

    logger.info({ tenantId: auth.tenantId, memberId: params.id, role }, 'Team member role updated');

    return applyCors(request, NextResponse.json(successResponse({ member })));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message }, 'Update team member error');
    return applyCors(request, new NextResponse(JSON.stringify(Errors.INTERNAL_ERROR(err.message)), { status: 500 }));
  }
}

/**
 * DELETE /api/v1/team/:id — Remove a team member or revoke invite
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const member = await TeamMemberModel.findOneAndDelete({
      _id: params.id,
      tenantId: auth.tenantId,
    });

    if (!member) {
      return applyCors(request, new NextResponse(JSON.stringify(Errors.NOT_FOUND('Team member')), { status: 404 }));
    }

    logger.info({ tenantId: auth.tenantId, memberId: params.id, email: member.email }, 'Team member removed');

    return applyCors(request, NextResponse.json(successResponse({ deleted: true })));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message }, 'Delete team member error');
    return applyCors(request, new NextResponse(JSON.stringify(Errors.INTERNAL_ERROR(err.message)), { status: 500 }));
  }
}
