import mongoose, { Schema, Model } from 'mongoose';
import { IConversion } from '@/types';

const conversionSchema = new Schema<IConversion>(
  {
    linkId: {
      type: Schema.Types.ObjectId,
      ref: 'Link',
      required: true,
      index: true,
    },
    clickId: {
      type: Schema.Types.ObjectId,
      ref: 'Click',
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    deferredLinkId: {
      type: Schema.Types.ObjectId,
      ref: 'DeferredLink',
      index: true,
    },
    conversionType: {
      type: String,
      enum: [
        'app_open',
        'registration',
        'ticket_purchase',
        'event_view',
        'custom',
      ],
      required: true,
    },
    deviceId: String,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound indexes for analytics
conversionSchema.index({ tenantId: 1, createdAt: -1 });
conversionSchema.index({ linkId: 1, createdAt: -1 });
conversionSchema.index({
  conversionType: 1,
  createdAt: -1,
});

const ConversionModel: Model<IConversion> =
  mongoose.models.Conversion || mongoose.model<IConversion>('Conversion', conversionSchema);

export default ConversionModel;
