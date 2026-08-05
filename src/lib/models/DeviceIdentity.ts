import mongoose, { Schema, Model } from 'mongoose';
import { IDeviceIdentity } from '@/types/events';

/**
 * Who is currently signed in on one device, and which identity epoch it is on.
 *
 * Split out from Identity for two reasons:
 *   1. Events arrive keyed on a device and every single one needs this lookup.
 *      A unique {tenantId, deviceId} document is O(1); scanning Identity.devices
 *      is not.
 *   2. A device has an epoch even when nobody is signed in. Logout bumps the
 *      epoch and clears userId — that is what stops the next person on a shared
 *      device from inheriting the previous person's history.
 *
 * The epoch never resets and deviceId is never rotated: rotating it would sever
 * install attribution and re-count the install.
 */
const deviceIdentitySchema = new Schema<IDeviceIdentity>(
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
    },
    userId: String,
    epoch: {
      type: Number,
      required: true,
      default: 0,
    },
    platform: {
      type: String,
      enum: ['android', 'ios', 'web', 'server', 'other'],
    },
    lastIdentifiedAt: Date,
    lastLogoutAt: Date,
  },
  { timestamps: true }
);

deviceIdentitySchema.index({ tenantId: 1, deviceId: 1 }, { unique: true });
deviceIdentitySchema.index({ tenantId: 1, userId: 1 });

const DeviceIdentityModel: Model<IDeviceIdentity> =
  mongoose.models.DeviceIdentity ||
  mongoose.model<IDeviceIdentity>('DeviceIdentity', deviceIdentitySchema);

export default DeviceIdentityModel;
