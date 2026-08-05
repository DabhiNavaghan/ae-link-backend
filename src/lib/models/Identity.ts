import mongoose, { Schema, Model } from 'mongoose';
import {
  IIdentity,
  IIdentityDevice,
  IIdentityAcquisition,
} from '@/types/events';

const identityDeviceSchema = new Schema<IIdentityDevice>(
  {
    deviceId: { type: String, required: true },
    platform: {
      type: String,
      enum: ['android', 'ios', 'web', 'server', 'other'],
    },
    // The epoch this device was on when it was attached to this identity.
    // Backfill never reaches events written before it.
    epoch: { type: Number, required: true, default: 0 },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * Which link acquired this person — first touch, across every device.
 *
 * Deliberately different from per-event attribution. A person may arrive on a
 * phone, sign in on a tablet and buy on the web; last-touch would hand credit
 * to whichever device happened to transact. Written once, on first identify,
 * and never overwritten.
 */
const acquisitionSchema = new Schema<IIdentityAcquisition>(
  {
    linkId: { type: Schema.Types.ObjectId, ref: 'Link' },
    clickId: { type: Schema.Types.ObjectId, ref: 'Click' },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    source: String,
    medium: String,
    campaign: String,
    shortCode: String,
    model: {
      type: String,
      enum: ['explicit_click', 'install_match', 'last_touch', 'direct', 'none'],
      default: 'none',
    },
    deviceId: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const identitySchema = new Schema<IIdentity>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    appId: {
      type: Schema.Types.ObjectId,
      ref: 'App',
    },
    userId: {
      type: String,
      required: true,
      trim: true,
    },

    // Device↔user is many-to-many. A shared tablet legitimately belongs to
    // several identities; each keeps only the epochs it owned.
    devices: {
      type: [identityDeviceSchema],
      default: [],
    },

    acquisition: {
      type: acquisitionSchema,
      default: undefined,
    },

    traits: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    emailHash: {
      type: String,
      index: true,
      sparse: true,
    },

    firstSeenAt: { type: Date, default: Date.now },
    identifiedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },

    eventCount: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },
    lastEventAt: Date,

    isErased: { type: Boolean, default: false },
    erasedAt: Date,
  },
  { timestamps: true }
);

identitySchema.index({ tenantId: 1, userId: 1 }, { unique: true });
identitySchema.index({ tenantId: 1, 'devices.deviceId': 1 });
identitySchema.index({ tenantId: 1, 'acquisition.linkId': 1 });
identitySchema.index({ tenantId: 1, 'acquisition.campaignId': 1 });
identitySchema.index({ tenantId: 1, lastSeenAt: -1 });

const IdentityModel: Model<IIdentity> =
  mongoose.models.Identity ||
  mongoose.model<IIdentity>('Identity', identitySchema);

export default IdentityModel;
