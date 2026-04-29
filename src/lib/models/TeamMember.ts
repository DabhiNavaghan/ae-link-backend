import mongoose, { Schema, Model } from 'mongoose';
import { ITeamMember } from '@/types';
import crypto from 'crypto';

const teamMemberSchema = new Schema<ITeamMember>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: String,
    role: {
      type: String,
      enum: ['administrator', 'admin', 'editor', 'analyst'],
      required: true,
      default: 'editor',
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'revoked'],
      default: 'pending',
      index: true,
    },
    clerkUserId: {
      type: String,
      index: true,
      sparse: true,
    },
    allowedApps: {
      type: [{ type: Schema.Types.ObjectId, ref: 'App' }],
      default: [], // empty = access to all apps
    },
    invitedBy: {
      type: String,
      required: true,
    },
    inviteToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    invitedAt: {
      type: Date,
      default: Date.now,
    },
    acceptedAt: Date,
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index: one active invite per email per tenant
teamMemberSchema.index({ tenantId: 1, email: 1 }, { unique: true });

// Generate invite token before validation
teamMemberSchema.pre('validate', function (next) {
  if (!this.inviteToken) {
    this.inviteToken = crypto.randomBytes(32).toString('hex');
  }
  if (!this.expiresAt) {
    // Default: 7 days from now
    this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  next();
});

const TeamMemberModel: Model<ITeamMember> =
  mongoose.models.TeamMember || mongoose.model<ITeamMember>('TeamMember', teamMemberSchema);

export default TeamMemberModel;
