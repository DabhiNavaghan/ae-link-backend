import mongoose, { Schema, Model } from 'mongoose';
import { IEventRollup } from '@/types/events';

/**
 * Daily pre-aggregate per tenant × event name × link × campaign × platform.
 *
 * Dashboards read this; raw events are for drill-down and expire on a TTL.
 * Building rollups before volume climbs is much cheaper than retrofitting them
 * onto a collection that already holds millions of rows.
 *
 * `dimKey` exists because the dimension set is partly optional (an unattributed
 * event has no linkId), and a unique index over nullable fields in MongoDB
 * treats every missing value as null — which collides. A composite string is
 * unambiguous and makes the upsert a single indexed lookup.
 */
const eventRollupSchema = new Schema<IEventRollup>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    /** UTC midnight of the day being summarised. */
    date: {
      type: Date,
      required: true,
    },
    /** `${name}|${linkId ?? '-'}|${campaignId ?? '-'}|${platform ?? '-'}` */
    dimKey: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    linkId: { type: Schema.Types.ObjectId, ref: 'Link' },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    platform: String,

    count: { type: Number, default: 0 },
    uniqueDevices: { type: Number, default: 0 },
    uniqueUsers: { type: Number, default: 0 },
    valueSum: { type: Number, default: 0 },
    currency: String,

    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

eventRollupSchema.index({ tenantId: 1, date: 1, dimKey: 1 }, { unique: true });
eventRollupSchema.index({ tenantId: 1, name: 1, date: -1 });
eventRollupSchema.index({ tenantId: 1, campaignId: 1, date: -1 });
eventRollupSchema.index({ tenantId: 1, linkId: 1, date: -1 });

/** Build the composite dimension key for a rollup bucket. */
export function buildDimKey(parts: {
  name: string;
  linkId?: unknown;
  campaignId?: unknown;
  platform?: string;
}): string {
  return [
    parts.name,
    parts.linkId ? String(parts.linkId) : '-',
    parts.campaignId ? String(parts.campaignId) : '-',
    parts.platform || '-',
  ].join('|');
}

const EventRollupModel: Model<IEventRollup> =
  mongoose.models.EventRollup ||
  mongoose.model<IEventRollup>('EventRollup', eventRollupSchema);

export default EventRollupModel;
