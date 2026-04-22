import mongoose, { Schema, Model } from 'mongoose';
import { ICampaign } from '@/types';

const campaignSchema = new Schema<ICampaign>(
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
      required: true,
      lowercase: true,
      trim: true,
    },
    description: String,
    status: {
      type: String,
      enum: ['active', 'paused', 'archived'],
      default: 'active',
      index: true,
    },
    fallbackUrl: String,
    startDate: Date,
    endDate: Date,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true }
);

// Compound index for tenant + slug uniqueness
campaignSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

const CampaignModel: Model<ICampaign> =
  mongoose.models.Campaign || mongoose.model<ICampaign>('Campaign', campaignSchema);

export default CampaignModel;
