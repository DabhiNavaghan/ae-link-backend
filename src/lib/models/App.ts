import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';
import { IApp } from '@/types';

const appSchema = new Schema<IApp>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
    },
    apiKey: {
      type: String,
      unique: true,
      index: true,
    },
    android: {
      package: { type: String, default: '' },
      sha256: { type: String, default: '' },
      storeUrl: { type: String, default: '' },
    },
    ios: {
      bundleId: { type: String, default: '' },
      teamId: { type: String, default: '' },
      appId: { type: String, default: '' },
      storeUrl: { type: String, default: '' },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Auto-generate apiKey before first save
appSchema.pre('save', function (next) {
  if (!this.apiKey) {
    // Prefix with 'app_' so it's easy to distinguish from tenant keys
    this.apiKey = 'app_' + crypto.randomBytes(24).toString('hex');
  }
  next();
});

// Compound index for tenant's apps
appSchema.index({ tenantId: 1, isActive: 1 });

const AppModel: Model<IApp> =
  mongoose.models.App || mongoose.model<IApp>('App', appSchema);

export default AppModel;
