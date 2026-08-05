import { Document, Types } from 'mongoose';

// ============================================================================
// Event tracking — shared types
//
// The vocabulary here is deliberately tenant-agnostic. No event name, no
// conversion type and no trait key is hardcoded: tenants declare their own
// vocabulary through EventDefinition. Adding a second tenant must never
// require a schema migration.
// ============================================================================

/**
 * How an event was attributed to a link.
 *
 *  explicit_click — the SDK carried a clickId from the deep link it opened
 *  install_match  — device → Install → DeferredLink → Click (exact, always wins
 *                   over any recency-based guess)
 *  last_touch     — most recent device→click bridge inside the lookback window
 *  direct         — the app was launched from a link, credited by launch URL
 *  none           — organic. Data, not a failure.
 */
export type AttributionModel =
  | 'explicit_click'
  | 'install_match'
  | 'last_touch'
  | 'direct'
  | 'none';

export type EventPlatform = 'android' | 'ios' | 'web' | 'server' | 'other';

/**
 * How much the server trusts the values on this event.
 *
 *  client — sent by an app using a distributable API key. A repackaged app can
 *           forge these, so revenue here is indicative, not billable.
 *  server — sent with a tenant key from a backend, or HMAC-signed with the
 *           tenant's apiSecret. Safe to bill on.
 */
export type EventTrustLevel = 'client' | 'server';

/** Denormalized attribution, resolved once on ingest and never re-derived. */
export interface IEventAttribution {
  linkId?: Types.ObjectId;
  clickId?: Types.ObjectId;
  installId?: Types.ObjectId;
  deferredLinkId?: Types.ObjectId;
  campaignId?: Types.ObjectId;

  /** UTM snapshot taken at resolve time, so renaming a campaign never rewrites history. */
  source?: string;
  medium?: string;
  campaign?: string;
  shortCode?: string;

  model: AttributionModel;
  resolvedAt: Date;
}

export interface IEvent extends Document {
  tenantId: Types.ObjectId;
  appId?: Types.ObjectId;

  /** Validated against EVENT_NAME_PATTERN — never enumerated. */
  name: string;

  deviceId?: string;
  sessionId?: string;

  /** The tenant's own user id. Null until identify(). */
  userId?: string;
  /** Bumps on identify/logout. Bounds the backfill so a shared device can't leak history. */
  identityEpoch: number;

  attribution: IEventAttribution;

  value?: number;
  currency?: string;
  trust: EventTrustLevel;

  properties?: Record<string, unknown>;

  /** Client clock — what reporting uses. */
  occurredAt: Date;
  /** Server clock — what ops uses. */
  receivedAt: Date;
  /** occurredAt − receivedAt. A health metric, not a bug. */
  clockSkewMs?: number;

  platform?: EventPlatform;
  sdkVersion?: string;
  appVersion?: string;

  /** Coarse geo only. We deliberately do not store the IP on events. */
  country?: string;
  city?: string;

  idempotencyKey?: string;

  /** Set from the tenant's retention setting; drives the TTL index. */
  expiresAt?: Date;

  createdAt: Date;
}

// ── Event definitions (per-tenant vocabulary) ──────────────────────────────

export interface IEventDefinition extends Document {
  tenantId: Types.ObjectId;
  appId?: Types.ObjectId;
  name: string;
  label: string;
  description?: string;
  category?: string;
  /** Conversions are a label over events, never a parallel counter. */
  isConversion: boolean;
  expectsValue: boolean;
  defaultCurrency?: string;
  status: 'active' | 'hidden';
  /** True for names the SDK emits automatically (app_open, session_start, …). */
  isSystem: boolean;
  eventCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Identity ───────────────────────────────────────────────────────────────

export interface IIdentityDevice {
  deviceId: string;
  platform?: EventPlatform;
  epoch: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

/** Which link/campaign acquired this person. First touch, across every device. */
export interface IIdentityAcquisition {
  linkId?: Types.ObjectId;
  clickId?: Types.ObjectId;
  campaignId?: Types.ObjectId;
  source?: string;
  medium?: string;
  campaign?: string;
  shortCode?: string;
  model: AttributionModel;
  deviceId?: string;
  at: Date;
}

export interface IIdentity extends Document {
  tenantId: Types.ObjectId;
  appId?: Types.ObjectId;
  /** The tenant's own user id. We never mint our own. */
  userId: string;

  devices: IIdentityDevice[];
  acquisition?: IIdentityAcquisition;

  /** Allowlisted, non-PII-by-default. See lib/utils/event-validation.ts. */
  traits?: Record<string, unknown>;
  /** sha256 of the lowercased, trimmed email. Plaintext needs an explicit opt-in. */
  emailHash?: string;

  firstSeenAt: Date;
  identifiedAt: Date;
  lastSeenAt: Date;

  /** Cheap denormalized counters so a user list doesn't aggregate on every load. */
  eventCount: number;
  totalValue: number;
  lastEventAt?: Date;

  isErased: boolean;
  erasedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Current identity state of one device. Split out from Identity because events
 * arrive keyed on a device and need an O(1) lookup, and because a device has an
 * epoch even when nobody is signed in.
 */
export interface IDeviceIdentity extends Document {
  tenantId: Types.ObjectId;
  deviceId: string;
  userId?: string;
  epoch: number;
  platform?: EventPlatform;
  lastIdentifiedAt?: Date;
  lastLogoutAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Rollups ────────────────────────────────────────────────────────────────

export interface IEventRollup extends Document {
  tenantId: Types.ObjectId;
  /** UTC midnight of the day being summarised. */
  date: Date;
  /** name|linkId|campaignId|platform — a stable composite so upserts are unique. */
  dimKey: string;
  name: string;
  linkId?: Types.ObjectId;
  campaignId?: Types.ObjectId;
  platform?: string;
  count: number;
  uniqueDevices: number;
  uniqueUsers: number;
  valueSum: number;
  currency?: string;
  computedAt: Date;
}

// ── Ingest DTOs ────────────────────────────────────────────────────────────

export interface TrackEventInput {
  name: string;
  deviceId?: string;
  sessionId?: string;
  userId?: string;
  occurredAt?: string;
  value?: number;
  currency?: string;
  properties?: Record<string, unknown>;
  idempotencyKey?: string;
  platform?: string;
  sdkVersion?: string;
  appVersion?: string;
  /** Set when the SDK opened a deep link and knows exactly which click it was. */
  clickId?: string;
}

export interface TrackEventResult {
  index: number;
  accepted: boolean;
  eventId?: string;
  /** True when the idempotency key had already been seen — a no-op, not an error. */
  duplicate?: boolean;
  attribution?: AttributionModel;
  /** Fields that were dropped or coerced. The event was still accepted. */
  warnings?: string[];
  error?: { code: string; message: string };
}

export interface IdentifyInput {
  userId: string;
  deviceId: string;
  traits?: Record<string, unknown>;
  email?: string;
  platform?: string;
}
