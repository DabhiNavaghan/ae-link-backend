import mongoose, { Schema, Model } from 'mongoose';
import { ILink, ILinkParams, IPlatformOverrides } from '@/types';

const linkParamsSchema = new Schema<ILinkParams>(
  {
    eventId: String,
    action: String,
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    utmTerm: String,
    utmContent: String,
    ct: String,
    pt: String,
    mt: String,
    userEmail: String,
    userId: String,
    couponCode: String,
    referralCode: String,
    custom: Schema.Types.Mixed,
  },
  { _id: false }
);

const platformOverridesSchema = new Schema<IPlatformOverrides>(
  {
    android: {
      url: String,
      fallback: String,
    },
    ios: {
      url: String,
      fallback: String,
    },
    web: {
      url: String,
    },
  },
  { _id: false }
);

const linkSchema = new Schema<ILink>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true,
    },
    appId: {
      type: Schema.Types.ObjectId,
      ref: 'App',
      index: true,
    },
    title: {
      type: String,
    },
    shortCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      sparse: true,
    },
    destinationUrl: {
      type: String,
      default: '',
    },
    linkType: {
      type: String,
      enum: ['event', 'ticket', 'profile', 'category', 'custom'],
      default: 'custom',
    },
    params: {
      type: linkParamsSchema,
      default: () => ({}),
    },
    platformOverrides: {
      type: platformOverridesSchema,
      default: () => ({}),
    },
    // Off = never send a click to the app store; fall back to the link's own
    // web destination, or the app-info interstitial when it has none. Phones
    // and desktop are switched independently. Both default on so existing
    // links keep behaving exactly as before (documents written before this
    // field are `undefined`, which the resolver reads as enabled).
    storeRedirect: {
      mobile: { type: Boolean, default: true },
      web: { type: Boolean, default: true },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    expiresAt: Date,
    clickCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      name: String,
      email: String,
      avatarUrl: String,
    },
  },
  { timestamps: true }
);

// TTL index for expiration
linkSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, sparse: true }
);

// Compound index for fast lookup by tenant
linkSchema.index({ tenantId: 1, isActive: 1 });

const LinkModel: Model<ILink> =
  mongoose.models.Link || mongoose.model<ILink>('Link', linkSchema);

export default LinkModel;
