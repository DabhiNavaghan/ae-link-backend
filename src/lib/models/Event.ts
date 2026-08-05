import mongoose, { Schema, Model } from 'mongoose';
import { IEvent, IEventAttribution } from '@/types/events';

/**
 * Attribution is embedded and denormalized on purpose.
 *
 * The alternative — resolving link/campaign at read time with a $lookup chain —
 * is what analytics.service.ts already does for installs, and it is the slowest
 * query in the service at install volume. Events will outnumber installs by
 * orders of magnitude, so the join has to happen once, on write.
 */
const attributionSchema = new Schema<IEventAttribution>(
  {
    linkId: { type: Schema.Types.ObjectId, ref: 'Link' },
    clickId: { type: Schema.Types.ObjectId, ref: 'Click' },
    installId: { type: Schema.Types.ObjectId, ref: 'Install' },
    deferredLinkId: { type: Schema.Types.ObjectId, ref: 'DeferredLink' },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },

    // Snapshot, not a reference — renaming a campaign must not rewrite history.
    source: String,
    medium: String,
    campaign: String,
    shortCode: String,

    model: {
      type: String,
      enum: ['explicit_click', 'install_match', 'last_touch', 'direct', 'none'],
      required: true,
      default: 'none',
    },
    resolvedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const eventSchema = new Schema<IEvent>(
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
      // Shape is validated in lib/utils/event-validation.ts before we get here.
      // Kept as a plain string so a new tenant never needs a schema migration.
    },

    deviceId: String,
    sessionId: String,

    userId: String,
    identityEpoch: {
      type: Number,
      default: 0,
      required: true,
    },

    attribution: {
      type: attributionSchema,
      required: true,
      default: () => ({ model: 'none', resolvedAt: new Date() }),
    },

    value: Number,
    currency: String,
    trust: {
      type: String,
      enum: ['client', 'server'],
      default: 'client',
      required: true,
    },

    properties: {
      type: Schema.Types.Mixed,
      default: undefined,
    },

    occurredAt: {
      type: Date,
      required: true,
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    clockSkewMs: Number,

    platform: {
      type: String,
      enum: ['android', 'ios', 'web', 'server', 'other'],
    },
    sdkVersion: String,
    appVersion: String,

    country: String,
    city: String,

    idempotencyKey: String,

    expiresAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// ── Query indexes ──────────────────────────────────────────────────────────
// Every one is tenant-prefixed. A query that can reach another tenant's rows
// should not even have an index that makes it fast.
eventSchema.index({ tenantId: 1, occurredAt: -1 });
eventSchema.index({ tenantId: 1, name: 1, occurredAt: -1 });
eventSchema.index({ tenantId: 1, 'attribution.linkId': 1, occurredAt: -1 });
eventSchema.index({ tenantId: 1, 'attribution.campaignId': 1, occurredAt: -1 });
eventSchema.index({ tenantId: 1, deviceId: 1, occurredAt: -1 });
eventSchema.index({ tenantId: 1, userId: 1, occurredAt: -1 });

// Backfill on identify scans exactly this: one device, one epoch.
eventSchema.index({ tenantId: 1, deviceId: 1, identityEpoch: 1 });

// Cross-tenant, time-only scans. Every index above is prefixed with tenantId,
// so a query that filters on occurredAt alone can use none of them — the daily
// rollup across all tenants and the internal admin views would each be a full
// collection scan on the largest collection in the system.
eventSchema.index({ occurredAt: -1 });

// Idempotency. This must be a PARTIAL index, not a sparse one: a compound
// sparse index only skips a document when it lacks *every* indexed field, and
// tenantId is always present — so every event without an idempotencyKey would
// index as null and the second one would collide.
eventSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
    name: 'tenant_idempotency_unique',
  }
);

// Retention. expiresAt is written per row from the tenant's setting, so
// tenants can differ without a second collection.
eventSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'event_ttl' }
);

const EventModel: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>('Event', eventSchema);

export default EventModel;
