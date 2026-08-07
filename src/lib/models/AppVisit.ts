import mongoose, { Schema, Model } from 'mongoose';
import { IAppVisit } from '@/types';

/**
 * A visit to an app's public store page.
 *
 * Deliberately a separate collection from Click — see IAppVisit for why. The
 * shape mirrors Click's device/geo fields so the same analytics helpers and
 * dashboard components read naturally against either.
 */
const appVisitSchema = new Schema<IAppVisit>(
  {
    appId: {
      type: Schema.Types.ObjectId,
      ref: 'App',
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
    userAgent: {
      type: String,
      required: true,
    },
    referer: String,
    device: {
      os: {
        type: String,
        enum: ['android', 'ios', 'windows', 'macos', 'linux', 'other'],
        required: true,
      },
      type: {
        type: String,
        enum: ['mobile', 'tablet', 'desktop'],
        required: true,
      },
      browser: String,
      model: String,
    },
    geo: {
      country: String,
      countryCode: String,
      city: String,
      region: String,
      source: { type: String, enum: ['cloudflare', 'ipapi', 'none'] },
    },
    sentTo: {
      type: String,
      enum: ['ios', 'android', 'none'],
      default: 'none',
      index: true,
    },
    utm: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Analytics access patterns: always scoped to one app, usually over a window.
appVisitSchema.index({ appId: 1, createdAt: -1 });
appVisitSchema.index({ tenantId: 1, createdAt: -1 });
appVisitSchema.index({ appId: 1, 'utm.source': 1 }, { sparse: true });
// Supports the dedupe lookup on repeat loads from the same device.
appVisitSchema.index({ appId: 1, ipAddress: 1, createdAt: -1 });

const AppVisitModel: Model<IAppVisit> =
  mongoose.models.AppVisit || mongoose.model<IAppVisit>('AppVisit', appVisitSchema);

export default AppVisitModel;
