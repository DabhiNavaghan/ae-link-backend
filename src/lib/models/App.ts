import mongoose, { Schema, Model } from 'mongoose';
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

// Compound index for tenant's apps
appSchema.index({ tenantId: 1, isActive: 1 });

const AppModel: Model<IApp> =
  mongoose.models.App || mongoose.model<IApp>('App', appSchema);

export default AppModel;
