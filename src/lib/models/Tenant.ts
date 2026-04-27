import mongoose, { Schema, Model } from 'mongoose';
import { ITenant, IAppConfig, ITenantSettings } from '@/types';
import crypto from 'crypto';

const appConfigSchema = new Schema<IAppConfig>(
  {
    android: {
      package: String,
      sha256: String,
      storeUrl: String,
    },
    ios: {
      bundleId: String,
      teamId: String,
      appId: String,
      storeUrl: String,
    },
  },
  { _id: false }
);

const tenantSettingsSchema = new Schema<ITenantSettings>(
  {
    fingerprintTtlHours: {
      type: Number,
      default: 72,
    },
    matchThreshold: {
      type: Number,
      default: 60,
    },
    defaultFallbackUrl: String,
  },
  { _id: false }
);

const tenantSchema = new Schema<ITenant>(
  {
    name: {
      type: String,
      required: true,
    },
    domain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    apiKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    apiSecret: {
      type: String,
      required: true,
    },
    app: {
      type: appConfigSchema,
      required: true,
    },
    settings: {
      type: tenantSettingsSchema,
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Generate API key BEFORE validation so required fields are satisfied
tenantSchema.pre('validate', function (next) {
  if (!this.apiKey) {
    this.apiKey = crypto.randomBytes(24).toString('hex');
  }
  if (!this.apiSecret) {
    this.apiSecret = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// Prevent password leakage in API responses
tenantSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.apiSecret;
  return obj;
};

const TenantModel: Model<ITenant> =
  mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', tenantSchema);

export default TenantModel;
