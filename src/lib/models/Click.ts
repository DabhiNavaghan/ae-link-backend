import mongoose, { Schema, Model } from 'mongoose';
import { IClick, IDeviceInfo, IGeoInfo, ClickChannel } from '@/types';

const deviceInfoSchema = new Schema<IDeviceInfo>(
  {
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
  { _id: false }
);

const geoInfoSchema = new Schema<IGeoInfo>(
  {
    country: String,
    city: String,
    region: String,
  },
  { _id: false }
);

const clickSchema = new Schema<IClick>(
  {
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
    userAgent: {
      type: String,
      required: true,
    },
    referer: String,
    channel: {
      type: String,
      enum: ['whatsapp', 'email', 'qr', 'instagram', 'sms', 'push', 'web', 'direct', 'facebook', 'twitter', 'tiktok', 'youtube', 'other'],
      default: 'direct',
      index: true,
    },
    device: {
      type: deviceInfoSchema,
      required: true,
    },
    geo: {
      type: geoInfoSchema,
      default: () => ({}),
    },
    isAppInstalled: {
      type: Boolean,
      default: false,
    },
    actionTaken: {
      type: String,
      enum: ['app_opened', 'store_redirect', 'web_fallback'],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound indexes for analytics
clickSchema.index({ tenantId: 1, createdAt: -1 });
clickSchema.index({ linkId: 1, createdAt: -1 });
clickSchema.index({ 'device.os': 1, createdAt: -1 });
clickSchema.index({ 'device.type': 1, createdAt: -1 });
clickSchema.index({ tenantId: 1, channel: 1, createdAt: -1 });

const ClickModel: Model<IClick> =
  mongoose.models.Click || mongoose.model<IClick>('Click', clickSchema);

export default ClickModel;
