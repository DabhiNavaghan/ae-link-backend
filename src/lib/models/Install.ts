import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IInstall extends Document {
  tenantId: mongoose.Types.ObjectId;
  deviceId: string;
  platform: 'android' | 'ios';
  packageName?: string;
  appVersion?: string;
  appBuildNumber?: string;
  osVersion?: string;
  deviceModel?: string;
  deviceManufacturer?: string;
  locale?: string;
  timezone?: string;
  installType: 'first_install' | 'reinstall' | 'return_user';
  matchResult: 'matched' | 'organic' | 'skipped';
  deferredLinkId?: mongoose.Types.ObjectId;
  matchScore?: number;
  ipAddress?: string;
  launchCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
}

const installSchema = new Schema<IInstall>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['android', 'ios'],
      required: true,
    },
    packageName: String,
    appVersion: String,
    appBuildNumber: String,
    osVersion: String,
    deviceModel: String,
    deviceManufacturer: String,
    locale: String,
    timezone: String,
    installType: {
      type: String,
      enum: ['first_install', 'reinstall', 'return_user'],
      default: 'first_install',
      index: true,
    },
    matchResult: {
      type: String,
      enum: ['matched', 'organic', 'skipped'],
      default: 'organic',
      index: true,
    },
    deferredLinkId: {
      type: Schema.Types.ObjectId,
      ref: 'DeferredLink',
    },
    matchScore: Number,
    ipAddress: String,
    launchCount: {
      type: Number,
      default: 1,
    },
    firstSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Find existing install by tenant + device
installSchema.index({ tenantId: 1, deviceId: 1 }, { unique: true });
installSchema.index({ tenantId: 1, installType: 1 });
installSchema.index({ tenantId: 1, matchResult: 1 });

const InstallModel: Model<IInstall> =
  mongoose.models.Install || mongoose.model<IInstall>('Install', installSchema);

export default InstallModel;
