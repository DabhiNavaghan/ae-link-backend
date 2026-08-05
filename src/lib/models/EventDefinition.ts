import mongoose, { Schema, Model } from 'mongoose';
import { IEventDefinition } from '@/types/events';

/**
 * The per-tenant event vocabulary.
 *
 * This is what keeps the platform multi-tenant. Conversion.conversionType is a
 * closed enum holding AllEvents' own nouns (ticket_purchase, event_view), so a
 * second tenant needs a migration to record their own conversions. Here the
 * names live in data: auto-registered on first sight, then curated in admin.
 *
 * `isConversion` lives here and nowhere else — a conversion is a label over
 * events, so flipping it reclassifies history instead of creating a second
 * counter that can disagree with the first.
 */
const eventDefinitionSchema = new Schema<IEventDefinition>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    appId: {
      type: Schema.Types.ObjectId,
      ref: 'App',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
    },
    description: String,
    category: {
      type: String,
      default: 'uncategorized',
    },
    isConversion: {
      type: Boolean,
      default: false,
      index: true,
    },
    expectsValue: {
      type: Boolean,
      default: false,
    },
    defaultCurrency: String,
    status: {
      type: String,
      enum: ['active', 'hidden'],
      default: 'active',
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    eventCount: {
      type: Number,
      default: 0,
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
  { timestamps: true }
);

// One definition per name per tenant. Also the cardinality guard's counter:
// countDocuments on this collection is cheap, on Event it is not.
eventDefinitionSchema.index({ tenantId: 1, name: 1 }, { unique: true });
eventDefinitionSchema.index({ tenantId: 1, isConversion: 1 });

const EventDefinitionModel: Model<IEventDefinition> =
  mongoose.models.EventDefinition ||
  mongoose.model<IEventDefinition>('EventDefinition', eventDefinitionSchema);

export default EventDefinitionModel;
