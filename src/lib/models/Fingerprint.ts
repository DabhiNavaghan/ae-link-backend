import mongoose, { Schema, Model } from 'mongoose';
import { IFingerprint, IScreenInfo } from '@/types';
import crypto from 'crypto';

const screenInfoSchema = new Schema<IScreenInfo>(
  {
    width: {
      type: Number,
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const fingerprintSchema = new Schema<IFingerprint>(
  {
    clickId: {
      type: Schema.Types.ObjectId,
      ref: 'Click',
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
    ipAddress: {
      type: String,
      required: true,
      index: true,
    },
    userAgentHash: {
      type: String,
      required: true,
      index: true,
    },
    screen: {
      type: screenInfoSchema,
      required: true,
    },
    language: String,
    timezone: String,
    timezoneOffset: String,
    deviceMemory: Number,
    connectionType: String,
    platform: String,
    vendor: String,
    hardwareConcurrency: Number,
    touchSupport: Boolean,
    colorDepth: Number,
    pixelRatio: Number,
    fingerprintHash: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'matched', 'expired'],
      default: 'pending',
      index: true,
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

// Compound indexes for matching
fingerprintSchema.index({ tenantId: 1, status: 1 });
fingerprintSchema.index(
  { linkId: 1, status: 1, createdAt: -1 }
);

const FingerprintModel: Model<IFingerprint> =
  mongoose.models.Fingerprint || mongoose.model<IFingerprint>('Fingerprint', fingerprintSchema);

export default FingerprintModel;
