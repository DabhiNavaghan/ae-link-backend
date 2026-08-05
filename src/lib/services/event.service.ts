import { Types } from 'mongoose';
import EventModel from '@/lib/models/Event';
import TenantModel from '@/lib/models/Tenant';
import { Logger } from '@/lib/logger';
import { liveEvents } from '@/lib/services/live-events';
import { resolveAttributionBatch } from './event-attribution.service';
import { ensureDefinitions } from './event-definition.service';
import {
  getDeviceStates,
  incrementIdentityCounters,
} from './identity.service';
import {
  TrackEventInput,
  TrackEventResult,
  EventPlatform,
  EventTrustLevel,
  IEvent,
} from '@/types/events';
import {
  LIMITS,
  isValidEventName,
  safeString,
  sanitizeProperties,
  resolveTimestamps,
  resolveMoney,
  DEFAULT_ATTRIBUTION_WINDOW_DAYS,
  DEFAULT_EVENT_RETENTION_DAYS,
} from '@/lib/utils/event-validation';

const logger = Logger.child({ service: 'event' });

/**
 * Event ingest.
 *
 * The contract is per-event, not per-batch: one malformed event never rejects
 * the other forty-nine. The endpoint answers 207 with a result array, and the
 * SDK drops accepted and permanently-rejected events from its queue while
 * retrying only the ones that failed transiently.
 */

const VALID_PLATFORMS: EventPlatform[] = ['android', 'ios', 'web', 'server', 'other'];

export interface IngestContext {
  tenantId: string;
  appId?: string;
  trust: EventTrustLevel;
  country?: string;
  city?: string;
}

export interface IngestSummary {
  results: TrackEventResult[];
  accepted: number;
  rejected: number;
  duplicates: number;
}

/** Per-tenant policy, resolved once per request. */
export interface TenantEventPolicy {
  attributionWindowDays: number;
  retentionDays: number;
  maxEventNames: number;
  requireSignedRevenue: boolean;
  allowedTraitKeys?: string[];
  storePlaintextEmail: boolean;
}

const policyCache = new Map<string, { policy: TenantEventPolicy; expiresAt: number }>();
const POLICY_TTL_MS = 60_000;

export async function getTenantPolicy(tenantId: string): Promise<TenantEventPolicy> {
  const hit = policyCache.get(tenantId);
  if (hit && Date.now() < hit.expiresAt) return hit.policy;

  let settings: Record<string, any> = {};
  try {
    const tenant = await TenantModel.findById(tenantId).select('settings').lean();
    settings = (tenant as any)?.settings || {};
  } catch (err) {
    logger.warn({ error: String(err), tenantId }, 'Policy load failed — using defaults');
  }

  const policy: TenantEventPolicy = {
    attributionWindowDays:
      settings.attributionWindowDays || DEFAULT_ATTRIBUTION_WINDOW_DAYS,
    retentionDays: settings.eventRetentionDays || DEFAULT_EVENT_RETENTION_DAYS,
    maxEventNames: settings.maxEventNames || LIMITS.EVENT_NAME_CARDINALITY_MAX,
    requireSignedRevenue: settings.requireSignedRevenue === true,
    allowedTraitKeys: settings.allowedTraitKeys?.length
      ? settings.allowedTraitKeys
      : undefined,
    storePlaintextEmail: settings.storePlaintextEmail === true,
  };

  policyCache.set(tenantId, { policy, expiresAt: Date.now() + POLICY_TTL_MS });
  return policy;
}

export function invalidatePolicy(tenantId: string): void {
  policyCache.delete(tenantId);
}

// ── Per-event validation ───────────────────────────────────────────────────

interface PreparedEvent {
  index: number;
  doc: Partial<IEvent>;
  warnings: string[];
}

interface RejectedEvent {
  index: number;
  code: string;
  message: string;
}

function reject(index: number, code: string, message: string): RejectedEvent {
  return { index, code, message };
}

/**
 * Validate and normalise a single event. Returns either a document ready to
 * write or a structured rejection — never throws, so a hostile payload can't
 * take down the batch.
 */
function prepareEvent(
  input: TrackEventInput,
  index: number,
  ctx: IngestContext,
  policy: TenantEventPolicy,
  now: Date
): PreparedEvent | RejectedEvent {
  if (!input || typeof input !== 'object') {
    return reject(index, 'INVALID_EVENT', 'Event must be an object');
  }

  // ── Name ──
  if (!isValidEventName(input.name)) {
    return reject(
      index,
      'INVALID_NAME',
      'name must match ^[a-z][a-z0-9_]{0,63}$ — lowercase letters, digits and underscores'
    );
  }

  // ── Timestamps ──
  const ts = resolveTimestamps(input.occurredAt, now);
  if (ts.issue) {
    return reject(index, ts.issue.code, ts.issue.message);
  }

  // ── Money ──
  const money = resolveMoney(input.value, input.currency);
  if (money.issue) {
    return reject(index, money.issue.code, money.issue.message);
  }

  // A client key ships inside the app binary. If this tenant bills on revenue,
  // a value arriving at client trust is refused rather than quietly recorded —
  // an unverifiable number in a revenue report is worse than a missing one.
  if (money.value !== undefined && policy.requireSignedRevenue && ctx.trust !== 'server') {
    return reject(
      index,
      'UNSIGNED_REVENUE',
      'This tenant requires monetary events to be sent server-to-server or HMAC-signed'
    );
  }

  // ── Properties ──
  const props = sanitizeProperties(input.properties);

  // ── Identifiers ──
  const deviceId = safeString(input.deviceId, LIMITS.DEVICE_ID_MAX_LENGTH);
  const sessionId = safeString(input.sessionId, LIMITS.SESSION_ID_MAX_LENGTH);
  const idempotencyKey = safeString(
    input.idempotencyKey,
    LIMITS.IDEMPOTENCY_KEY_MAX_LENGTH
  );

  const rawPlatform = safeString(input.platform, 16)?.toLowerCase();
  const platform = VALID_PLATFORMS.includes(rawPlatform as EventPlatform)
    ? (rawPlatform as EventPlatform)
    : ctx.trust === 'server'
      ? 'server'
      : 'other';

  const expiresAt = new Date(
    ts.occurredAt.getTime() + policy.retentionDays * 24 * 60 * 60 * 1000
  );

  return {
    index,
    warnings: props.warnings,
    doc: {
      // Assigned up front rather than left to insertMany. With ordered:false a
      // partial failure throws, and mongoose does not write ids back onto the
      // plain objects we passed in — so without this we could not tell the
      // caller the id of an event that actually succeeded.
      _id: new Types.ObjectId() as any,
      tenantId: new Types.ObjectId(ctx.tenantId) as any,
      appId: ctx.appId ? (new Types.ObjectId(ctx.appId) as any) : undefined,
      name: input.name,
      deviceId,
      sessionId,
      // userId is resolved server-side from device state, never taken from the
      // request body — the SDK sends a userId to identify(), it does not get to
      // assert who someone is on every event.
      identityEpoch: 0,
      value: money.value,
      currency: money.currency,
      trust: ctx.trust,
      properties: props.value,
      occurredAt: ts.occurredAt,
      receivedAt: ts.receivedAt,
      clockSkewMs: ts.clockSkewMs,
      platform,
      sdkVersion: safeString(input.sdkVersion, 32),
      appVersion: safeString(input.appVersion, 32),
      country: ctx.country,
      city: ctx.city,
      idempotencyKey,
      expiresAt,
    },
  };
}

function isRejection(v: PreparedEvent | RejectedEvent): v is RejectedEvent {
  return (v as RejectedEvent).code !== undefined;
}

// ── Batch ingest ───────────────────────────────────────────────────────────

/**
 * Ingest a batch of events.
 *
 * Shape of the work, in order:
 *   1. Validate each event independently.
 *   2. Register any new event names, enforcing the cardinality ceiling.
 *   3. Resolve attribution once per distinct device, not once per event.
 *   4. Stamp the device's current userId and epoch.
 *   5. Insert unordered, so one duplicate key doesn't abort the rest.
 *   6. Emit to the live feed and roll up counters — both fire-and-forget.
 */
export async function ingestEvents(
  rawEvents: TrackEventInput[],
  ctx: IngestContext
): Promise<IngestSummary> {
  const now = new Date();
  const policy = await getTenantPolicy(ctx.tenantId);

  const results: TrackEventResult[] = new Array(rawEvents.length);
  const prepared: PreparedEvent[] = [];

  // ── 1. Validate ──
  for (let i = 0; i < rawEvents.length; i++) {
    const outcome = prepareEvent(rawEvents[i], i, ctx, policy, now);
    if (isRejection(outcome)) {
      results[i] = {
        index: i,
        accepted: false,
        error: { code: outcome.code, message: outcome.message },
      };
    } else {
      prepared.push(outcome);
    }
  }

  if (prepared.length === 0) {
    return summarize(results);
  }

  // ── 2. Vocabulary + cardinality ──
  const counts = new Map<string, number>();
  for (const p of prepared) {
    const name = p.doc.name!;
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  const definitionResults = await ensureDefinitions(
    ctx.tenantId,
    Array.from(counts.keys()),
    { appId: ctx.appId, maxNames: policy.maxEventNames, counts }
  );

  const admitted: PreparedEvent[] = [];
  for (const p of prepared) {
    const decision = definitionResults.get(p.doc.name!);
    if (decision && !decision.allowed) {
      results[p.index] = {
        index: p.index,
        accepted: false,
        error: {
          code: 'EVENT_NAME_LIMIT',
          message: decision.reason || 'Event name limit reached',
        },
      };
    } else {
      admitted.push(p);
    }
  }

  if (admitted.length === 0) {
    return summarize(results);
  }

  // ── 3. Attribution, one lookup per device ──
  const attributions = await resolveAttributionBatch(
    ctx.tenantId,
    admitted.map((p) => ({
      index: p.index,
      deviceId: p.doc.deviceId,
      clickId: (rawEvents[p.index] as TrackEventInput)?.clickId,
      occurredAt: p.doc.occurredAt as Date,
    })),
    policy.attributionWindowDays
  );

  // ── 4. Identity stamping ──
  const deviceIds = admitted
    .map((p) => p.doc.deviceId)
    .filter((d): d is string => Boolean(d));
  const deviceStates = await getDeviceStates(ctx.tenantId, deviceIds);

  for (const p of admitted) {
    p.doc.attribution = attributions.get(p.index) || {
      model: 'none',
      resolvedAt: now,
    };

    if (p.doc.deviceId) {
      const state = deviceStates.get(p.doc.deviceId);
      if (state) {
        p.doc.identityEpoch = state.epoch;
        if (state.userId) p.doc.userId = state.userId;
      }
    }
  }

  // ── 5. Write ──
  // Unordered so a replayed idempotency key rejects only its own document.
  const inserted: Array<{ index: number; id: string }> = [];
  const duplicateIndexes = new Set<number>();

  try {
    await EventModel.insertMany(
      admitted.map((p) => p.doc),
      { ordered: false }
    );
    for (const p of admitted) {
      inserted.push({ index: p.index, id: String((p.doc as any)._id) });
    }
  } catch (err: any) {
    const writeErrors: any[] = err?.writeErrors || [];

    // No writeErrors means this wasn't a partial write — the batch never landed
    // (connection lost, validation threw before the send). Nothing is in the DB.
    if (writeErrors.length === 0) {
      logger.error(
        { error: String(err), tenantId: ctx.tenantId },
        'Event batch insert failed'
      );
      for (const p of admitted) {
        results[p.index] = {
          index: p.index,
          accepted: false,
          error: { code: 'WRITE_FAILED', message: 'Event could not be stored' },
        };
      }
      return summarize(results);
    }

    // Partial write. insertMany with ordered:false persists everything it can
    // and then throws; writeErrors names exactly which positions failed, so
    // every other position is already in the database.
    const failedPositions = new Map<number, any>();
    for (const we of writeErrors) {
      const pos = we?.index ?? we?.err?.index;
      if (typeof pos === 'number') failedPositions.set(pos, we);
    }

    for (let pos = 0; pos < admitted.length; pos++) {
      const p = admitted[pos];
      const failure = failedPositions.get(pos);

      if (!failure) {
        // This position is in the database. The _id was assigned in
        // prepareEvent, so we can report it without reading anything back.
        inserted.push({ index: p.index, id: String((p.doc as any)._id) });
        continue;
      }

      const code = failure?.code ?? failure?.err?.code;
      if (code === 11000) {
        // The unique {tenantId, idempotencyKey} index did its job: a retry of
        // an event we already have. That is the SDK's safety net working, not
        // an error — report it as a no-op.
        duplicateIndexes.add(p.index);
      } else {
        results[p.index] = {
          index: p.index,
          accepted: false,
          error: {
            code: 'WRITE_FAILED',
            message: 'Event could not be stored',
          },
        };
        logger.warn(
          { error: String(failure?.errmsg || failure), tenantId: ctx.tenantId },
          'Event write failed'
        );
      }
    }
  }

  const insertedById = new Map(inserted.map((i) => [i.index, i.id]));

  for (const p of admitted) {
    if (results[p.index]) continue; // already rejected above

    if (duplicateIndexes.has(p.index)) {
      results[p.index] = {
        index: p.index,
        accepted: true,
        duplicate: true,
        attribution: p.doc.attribution?.model,
      };
      continue;
    }

    results[p.index] = {
      index: p.index,
      accepted: true,
      eventId: insertedById.get(p.index),
      attribution: p.doc.attribution?.model,
      ...(p.warnings.length ? { warnings: p.warnings } : {}),
    } as TrackEventResult;
  }

  // ── 6. Side effects — never allowed to fail the request ──
  const stored = admitted.filter(
    (p) => !duplicateIndexes.has(p.index) && results[p.index]?.accepted
  );

  emitToLiveFeed(stored, ctx);
  rollIdentityCounters(stored, ctx.tenantId);

  return summarize(results);
}

function summarize(results: TrackEventResult[]): IngestSummary {
  let accepted = 0;
  let rejected = 0;
  let duplicates = 0;

  for (let i = 0; i < results.length; i++) {
    // Defensive: a gap here would mean a code path forgot to record an outcome.
    if (!results[i]) {
      results[i] = {
        index: i,
        accepted: false,
        error: { code: 'UNPROCESSED', message: 'Event was not processed' },
      };
    }
    if (results[i].accepted) {
      accepted++;
      if (results[i].duplicate) duplicates++;
    } else {
      rejected++;
    }
  }

  return { results, accepted, rejected, duplicates };
}

/**
 * Push tracked events into the admin Live Tracking feed, beside clicks and
 * installs. Capped per batch — a fifty-event flush must not flood the stream.
 */
function emitToLiveFeed(events: PreparedEvent[], ctx: IngestContext): void {
  const MAX_EMITTED = 10;
  try {
    for (const p of events.slice(0, MAX_EMITTED)) {
      const attribution = p.doc.attribution;
      liveEvents.emit({
        type: 'event',
        tenantId: ctx.tenantId,
        linkId: attribution?.linkId ? String(attribution.linkId) : undefined,
        shortCode: attribution?.shortCode,
        device: { os: p.doc.platform },
        geo: { country: ctx.country, city: ctx.city },
        metadata: {
          eventName: p.doc.name,
          deviceId: p.doc.deviceId,
          userId: p.doc.userId,
          sessionId: p.doc.sessionId,
          value: p.doc.value,
          currency: p.doc.currency,
          attributionModel: attribution?.model,
          campaign: attribution?.campaign,
          campaignId: attribution?.campaignId
            ? String(attribution.campaignId)
            : undefined,
          source: attribution?.source,
          trust: p.doc.trust,
        },
      });
    }
    if (events.length > MAX_EMITTED) {
      logger.debug(
        { suppressed: events.length - MAX_EMITTED },
        'Live feed emission capped for this batch'
      );
    }
  } catch (err) {
    logger.debug({ error: String(err) }, 'Live feed emit failed');
  }
}

/** Fold event counts and revenue onto identities so the user list stays a plain find(). */
function rollIdentityCounters(events: PreparedEvent[], tenantId: string): void {
  const byUser = new Map<string, { count: number; value: number; lastEventAt: Date }>();

  for (const p of events) {
    const userId = p.doc.userId;
    if (!userId) continue;
    const entry = byUser.get(userId) || {
      count: 0,
      value: 0,
      lastEventAt: p.doc.occurredAt as Date,
    };
    entry.count += 1;
    entry.value += p.doc.value || 0;
    if ((p.doc.occurredAt as Date) > entry.lastEventAt) {
      entry.lastEventAt = p.doc.occurredAt as Date;
    }
    byUser.set(userId, entry);
  }

  if (byUser.size === 0) return;

  void incrementIdentityCounters(
    tenantId,
    Array.from(byUser.entries()).map(([userId, v]) => ({ userId, ...v }))
  );
}

const EventService = { ingestEvents, getTenantPolicy, invalidatePolicy };

export default EventService;
