import mongoose, { Schema, Model } from 'mongoose';

/**
 * Platform-wide switches, set from the admin panel.
 *
 * One document, fixed id. Anything that must be flipped for every tenant at
 * once — a kill switch for event ingest, how long debugging data is kept —
 * lives here rather than on each Tenant, so an operator changes it in one
 * place and does not have to remember which tenants exist.
 *
 * The admin app writes this document; the API reads it through
 * `system-settings.service.ts`, which caches it briefly. A change made in the
 * admin panel is live everywhere within SYSTEM_SETTINGS_CACHE_MS.
 *
 * Every field is optional in storage. The service layer owns the defaults so
 * an empty or missing document behaves exactly like the pre-settings build.
 */

export const SYSTEM_SETTINGS_ID = 'global';

/**
 * Hard ceiling on match-attempt retention. The backstop TTL index on
 * `createdAt` is sized to this (+1 day), so an admin can move the window
 * anywhere below it without an index rebuild. Raising it means changing
 * BACKSTOP_RETENTION_DAYS in MatchAttempt.ts and re-running the migration.
 */
export const MATCH_ATTEMPT_MAX_RETENTION_DAYS = 30;
export const MATCH_ATTEMPT_MIN_RETENTION_DAYS = 1;

export const EVENT_MAX_RETENTION_DAYS = 365;
export const EVENT_MIN_RETENTION_DAYS = 1;

export interface ISystemSettings {
  _id: string;
  eventTracking?: {
    /**
     * Platform-wide kill switch for event ingest. When false, POST
     * /api/v1/events stores nothing and the SDK is told at init to stop
     * queueing. Deep linking, attribution and installs are unaffected.
     */
    enabled?: boolean;
    /**
     * Default TTL for raw events, in days. A tenant's own
     * `settings.eventRetentionDays` still wins when set.
     */
    retentionDays?: number;
  };
  matchAttempts?: {
    /**
     * How long a match attempt row is kept, in days. Overrides the
     * MATCH_ATTEMPT_RETENTION_DAYS env fallback. Clamped to
     * [MATCH_ATTEMPT_MIN_RETENTION_DAYS, MATCH_ATTEMPT_MAX_RETENTION_DAYS].
     */
    retentionDays?: number;
  };
  /** Values the admin "Apply to All" pushes into every Tenant.settings. */
  tenantDefaults?: {
    matchThreshold?: number;
    fingerprintTtlHours?: number;
    enableDeferredDeepLink?: boolean;
  };
  /** Feature flags suggested for a newly created tenant. */
  defaultFlags?: Record<string, boolean>;
  updatedBy?: string;
  updatedAt?: Date;
}

const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    _id: { type: String, default: SYSTEM_SETTINGS_ID },
    eventTracking: {
      enabled: Boolean,
      retentionDays: Number,
    },
    matchAttempts: {
      retentionDays: Number,
    },
    tenantDefaults: {
      matchThreshold: Number,
      fingerprintTtlHours: Number,
      enableDeferredDeepLink: Boolean,
    },
    defaultFlags: { type: Schema.Types.Mixed },
    updatedBy: String,
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    // Only one document ever exists, so a versionKey is noise.
    versionKey: false,
    // The admin app may add fields before this build learns about them.
    strict: false,
  }
);

const SystemSettingsModel: Model<ISystemSettings> =
  mongoose.models.SystemSettings ||
  mongoose.model<ISystemSettings>('SystemSettings', systemSettingsSchema);

export default SystemSettingsModel;
