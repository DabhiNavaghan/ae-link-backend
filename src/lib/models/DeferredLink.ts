import mongoose, { Schema, Model } from 'mongoose';
import { IDeferredLink, ILinkParams, IMatchDetails } from '@/types';

const linkParamsSchema = new Schema<ILinkParams>(
  {
    eventId: String,
    action: String,
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    utmTerm: String,
    utmContent: String,
    userEmail: String,
    userId: String,
    couponCode: String,
    referralCode: String,
    custom: Schema.Types.Mixed,
  },
  { _id: false }
);

const deferredLinkSchema = new Schema<IDeferredLink>(
  {
    fingerprintId: {
      type: Schema.Types.ObjectId,
      ref: 'Fingerprint',
      required: true,
    },
    linkId: {
      type: Schema.Types.ObjectId,
      ref: 'Link',
      required: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    params: {
      type: linkParamsSchema,
      required: true,
    },
    destinationUrl: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'matched', 'confirmed', 'expired', 'failed'],
      default: 'pending',
      index: true,
    },
    matchedAt: Date,
    confirmedAt: Date,
    deviceId: String,
    matchScore: {
      type: Number,
      default: 0,
    },
    matchDetails: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
      expireAfterSeconds: 0,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound indexes for efficient querying
deferredLinkSchema.index({ tenantId: 1, status: 1 });
deferredLinkSchema.index({ linkId: 1, status: 1 });
deferredLinkSchema.index(
  { deviceId: 1, status: 1 }
);

const DeferredLinkModel: Model<IDeferredLink> =
  mongoose.models.DeferredLink || mongoose.model<IDeferredLink>('DeferredLink', deferredLinkSchema);

export default DeferredLinkModel;
