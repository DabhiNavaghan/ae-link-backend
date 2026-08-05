import IdentityModel from '@/lib/models/Identity';
import DeviceIdentityModel from '@/lib/models/DeviceIdentity';
import EventModel from '@/lib/models/Event';
import { Logger } from '@/lib/logger';
import { IEventAttribution, EventPlatform } from '@/types/events';
import { resolveAttribution, invalidateAttributionCache } from './event-attribution.service';
import {
  LIMITS,
  safeString,
  sanitizeTraits,
  hashIdentifier,
  DEFAULT_ALLOWED_TRAIT_KEYS,
} from '@/lib/utils/event-validation';

const logger = Logger.child({ service: 'identity' });

/**
 * Identity and sign-in stitching.
 *
 * Sign-in is the only moment the platform learns that a device belongs to a
 * person, and every valuable question about user tracking — lifetime value by
 * campaign, cohorts, cross-device journeys — hangs off getting this transition
 * right.
 *
 * Two rules shape the whole design:
 *
 *   Device↔user is many-to-many. A shared tablet, or a phone handed over at a
 *   ticket counter, legitimately belongs to more than one person. If sign-in
 *   rewrote a device's entire history, the second user would inherit the
 *   first's activity and their purchases — the failure mode that makes identity
 *   systems produce numbers nobody trusts.
 *
 *   The epoch bounds the damage. It increments on every identify and logout;
 *   backfill only touches events written at the device's current epoch, so it
 *   can never reach across a previous logout.
 */

export interface DeviceState {
  userId?: string;
  epoch: number;
}

/**
 * The device's current userId and epoch, used to stamp incoming events.
 *
 * Read on the ingest path, so it is cached briefly. A stale read costs at most
 * a few seconds of events carrying the previous userId; identify() invalidates
 * the entry, so the window closes as soon as the transition is known.
 */
interface DeviceCacheEntry {
  state: DeviceState;
  expiresAt: number;
}

const DEVICE_CACHE_TTL_MS = 30_000;
const DEVICE_CACHE_MAX = 10_000;
const deviceCache = new Map<string, DeviceCacheEntry>();

function deviceCacheKey(tenantId: string, deviceId: string): string {
  return `${tenantId}:${deviceId}`;
}

function invalidateDeviceCache(tenantId: string, deviceId: string): void {
  deviceCache.delete(deviceCacheKey(tenantId, deviceId));
}

/** Look up the current identity state for a set of devices in one query. */
export async function getDeviceStates(
  tenantId: string,
  deviceIds: string[]
): Promise<Map<string, DeviceState>> {
  const out = new Map<string, DeviceState>();
  const misses: string[] = [];
  const now = Date.now();

  for (const deviceId of new Set(deviceIds)) {
    const hit = deviceCache.get(deviceCacheKey(tenantId, deviceId));
    if (hit && now < hit.expiresAt) out.set(deviceId, hit.state);
    else misses.push(deviceId);
  }

  if (misses.length === 0) return out;

  try {
    const rows = await DeviceIdentityModel.find({
      tenantId,
      deviceId: { $in: misses },
    })
      .select('deviceId userId epoch')
      .lean();

    const found = new Map(rows.map((r) => [r.deviceId, r]));

    for (const deviceId of misses) {
      const row = found.get(deviceId);
      // A device we've never seen is epoch 0 with nobody signed in. We do not
      // create the row here — the ingest path should not write on every event.
      const state: DeviceState = row
        ? { userId: row.userId || undefined, epoch: row.epoch ?? 0 }
        : { epoch: 0 };

      out.set(deviceId, state);

      if (deviceCache.size >= DEVICE_CACHE_MAX) {
        const oldest = deviceCache.keys().next().value;
        if (oldest !== undefined) deviceCache.delete(oldest);
      }
      deviceCache.set(deviceCacheKey(tenantId, deviceId), {
        state,
        expiresAt: Date.now() + DEVICE_CACHE_TTL_MS,
      });
    }
  } catch (err) {
    // Identity is an enrichment, not a gate. If the lookup fails the events
    // still land — anonymous — and a later identify() backfills them.
    logger.warn({ error: String(err), tenantId }, 'Device state lookup failed');
    for (const deviceId of misses) out.set(deviceId, { epoch: 0 });
  }

  return out;
}

// ── Identify ───────────────────────────────────────────────────────────────

export interface IdentifyOptions {
  tenantId: string;
  appId?: string;
  userId: string;
  deviceId: string;
  traits?: Record<string, unknown>;
  email?: string;
  platform?: EventPlatform;
  /** Tenant policy, resolved by the caller. */
  allowedTraitKeys?: string[];
  storePlaintextEmail?: boolean;
  attributionWindowDays?: number;
}

export interface IdentifyResult {
  userId: string;
  epoch: number;
  /** True the first time this person was ever seen — the call that sets acquisition. */
  isNewIdentity: boolean;
  acquisition?: IEventAttribution;
  backfilledEvents: number;
  warnings: string[];
}

/**
 * Attach a device to a person.
 *
 * Order matters:
 *   1. Bump the device epoch and record the new owner.
 *   2. Upsert the identity and attach the device at that epoch.
 *   3. Set acquisition — once, on first identify, never overwritten.
 *   4. Backfill this device's events at the *previous* epoch, which are the
 *      anonymous events this same person generated before signing in.
 */
export async function identify(
  options: IdentifyOptions
): Promise<IdentifyResult> {
  const warnings: string[] = [];

  const userId = safeString(options.userId, LIMITS.USER_ID_MAX_LENGTH);
  const deviceId = safeString(options.deviceId, LIMITS.DEVICE_ID_MAX_LENGTH);

  if (!userId) throw new Error('userId is required');
  if (!deviceId) throw new Error('deviceId is required');

  const { tenantId } = options;
  const now = new Date();

  // ── 1. Device transition ──
  // The epoch increments whenever the device changes hands. deviceId itself is
  // never regenerated: rotating it would sever install attribution and re-count
  // the install, corrupting numbers the platform already gets right.
  const existingDevice = await DeviceIdentityModel.findOne({
    tenantId,
    deviceId,
  })
    .select('userId epoch')
    .lean();

  const previousEpoch = existingDevice?.epoch ?? 0;
  const previousUserId = existingDevice?.userId;

  // Re-identifying as the same person is idempotent — no epoch bump, so a
  // token refresh or an app restart doesn't fragment the device's history.
  const isSameUser = previousUserId === userId;
  const epoch = isSameUser ? previousEpoch : previousEpoch + 1;

  await DeviceIdentityModel.updateOne(
    { tenantId, deviceId },
    {
      $set: {
        userId,
        epoch,
        platform: options.platform,
        lastIdentifiedAt: now,
      },
      $setOnInsert: { tenantId, deviceId },
    },
    { upsert: true }
  );

  invalidateDeviceCache(tenantId, deviceId);
  invalidateAttributionCache(tenantId, deviceId);

  // ── 2. Traits ──
  const traitResult = sanitizeTraits(
    options.traits,
    options.allowedTraitKeys?.length
      ? options.allowedTraitKeys
      : DEFAULT_ALLOWED_TRAIT_KEYS
  );
  warnings.push(...traitResult.warnings);

  // Email is stored hashed by default. It stays matchable — the same address
  // hashes the same way every time — without being readable in a database dump.
  let emailHash: string | undefined;
  if (options.email) {
    const email = safeString(options.email, 320);
    if (email && email.includes('@')) {
      emailHash = hashIdentifier(email);
      if (options.storePlaintextEmail) {
        traitResult.value = { ...(traitResult.value || {}), email };
      }
    } else {
      warnings.push('email dropped: not a valid address');
    }
  }

  // ── 3. Upsert identity, attach device ──
  const existing = await IdentityModel.findOne({ tenantId, userId });
  const isNewIdentity = !existing;

  const deviceEntry = {
    deviceId,
    platform: options.platform,
    epoch,
    firstSeenAt: now,
    lastSeenAt: now,
  };

  if (isNewIdentity) {
    await IdentityModel.create({
      tenantId,
      appId: options.appId || undefined,
      userId,
      devices: [deviceEntry],
      traits: traitResult.value,
      emailHash,
      firstSeenAt: now,
      identifiedAt: now,
      lastSeenAt: now,
    });
  } else {
    const hasDevice = existing!.devices.some((d) => d.deviceId === deviceId);

    const update: Record<string, unknown> = {
      $set: {
        lastSeenAt: now,
        ...(emailHash ? { emailHash } : {}),
        // Traits merge rather than replace, so a partial identify() call never
        // silently erases what an earlier one recorded.
        ...Object.fromEntries(
          Object.entries(traitResult.value || {}).map(([k, v]) => [
            `traits.${k}`,
            v,
          ])
        ),
      },
    };

    if (hasDevice) {
      // Same device signing in again — refresh its epoch in place.
      await IdentityModel.updateOne(
        { tenantId, userId, 'devices.deviceId': deviceId },
        {
          ...update,
          $set: {
            ...(update.$set as object),
            'devices.$.lastSeenAt': now,
            'devices.$.epoch': epoch,
          },
        }
      );
    } else {
      // Merge devices, not histories. Each event keeps the device that produced
      // it; the user is a lens over them, not a rewrite.
      await IdentityModel.updateOne(
        { tenantId, userId },
        { ...update, $push: { devices: deviceEntry } }
      );
    }
  }

  // ── 4. Acquisition — first touch, set once, never overwritten ──
  let acquisition: IEventAttribution | undefined;
  if (isNewIdentity) {
    try {
      acquisition = await resolveAttribution({
        tenantId,
        deviceId,
        occurredAt: now,
        windowDays: options.attributionWindowDays,
      });

      if (acquisition.model !== 'none') {
        await IdentityModel.updateOne(
          { tenantId, userId, acquisition: { $exists: false } },
          {
            $set: {
              acquisition: {
                linkId: acquisition.linkId,
                clickId: acquisition.clickId,
                campaignId: acquisition.campaignId,
                source: acquisition.source,
                medium: acquisition.medium,
                campaign: acquisition.campaign,
                shortCode: acquisition.shortCode,
                model: acquisition.model,
                deviceId,
                at: now,
              },
            },
          }
        );
      }
    } catch (err) {
      logger.warn(
        { error: String(err), tenantId, userId },
        'Acquisition resolution failed — identity created without it'
      );
    }
  }

  // ── 5. Bounded backfill ──
  const backfilledEvents = await backfillDeviceEvents({
    tenantId,
    deviceId,
    userId,
    // Events written before this sign-in carry the previous epoch. Those are
    // this person's anonymous events. Anything older belongs to whoever held
    // the device before, and is deliberately out of reach.
    epoch: previousEpoch,
    newEpoch: epoch,
  });

  logger.info(
    {
      tenantId,
      userId,
      deviceId,
      epoch,
      isNewIdentity,
      backfilledEvents,
      acquisitionModel: acquisition?.model,
    },
    'Identity resolved'
  );

  return {
    userId,
    epoch,
    isNewIdentity,
    acquisition,
    backfilledEvents,
    warnings,
  };
}

/**
 * Stamp userId onto this device's anonymous events at a single epoch.
 *
 * Bounded by construction: one device, one epoch, only rows that don't already
 * carry a userId. Rewriting costs one bounded write burst and keeps every
 * subsequent read flat — the alternative, an alias table resolved at read time,
 * stays correct forever but puts a join on every query.
 */
async function backfillDeviceEvents(input: {
  tenantId: string;
  deviceId: string;
  userId: string;
  epoch: number;
  newEpoch: number;
}): Promise<number> {
  try {
    const result = await EventModel.updateMany(
      {
        tenantId: input.tenantId,
        deviceId: input.deviceId,
        identityEpoch: input.epoch,
        userId: { $exists: false },
      },
      {
        $set: {
          userId: input.userId,
          // Move the rows onto the new epoch so a second identify() for the
          // same person cannot re-scan and re-write them.
          identityEpoch: input.newEpoch,
        },
      }
    );
    return result.modifiedCount || 0;
  } catch (err) {
    logger.warn(
      { error: String(err), ...input },
      'Backfill failed — events remain anonymous'
    );
    return 0;
  }
}

// ── Logout ─────────────────────────────────────────────────────────────────

export interface LogoutResult {
  epoch: number;
  deviceId: string;
}

/**
 * End the session on a device.
 *
 * Bumps the epoch and clears userId. It must NOT regenerate deviceId — the
 * install record, the deferred-link match and every historical event are keyed
 * on it, and rotating it would re-count the install as a new one.
 *
 * Events already written keep the userId they were stamped with. Logging out
 * does not un-attribute the past; it draws a line the next backfill cannot cross.
 */
export async function logout(
  tenantId: string,
  deviceId: string
): Promise<LogoutResult> {
  const safeDeviceId = safeString(deviceId, LIMITS.DEVICE_ID_MAX_LENGTH);
  if (!safeDeviceId) throw new Error('deviceId is required');

  const now = new Date();

  const updated = await DeviceIdentityModel.findOneAndUpdate(
    { tenantId, deviceId: safeDeviceId },
    {
      $inc: { epoch: 1 },
      $unset: { userId: '' },
      $set: { lastLogoutAt: now },
      $setOnInsert: { tenantId, deviceId: safeDeviceId },
    },
    { upsert: true, new: true }
  );

  invalidateDeviceCache(tenantId, safeDeviceId);
  invalidateAttributionCache(tenantId, safeDeviceId);

  logger.info(
    { tenantId, deviceId: safeDeviceId, epoch: updated.epoch },
    'Device logged out'
  );

  return { epoch: updated.epoch, deviceId: safeDeviceId };
}

// ── Erasure ────────────────────────────────────────────────────────────────

export interface EraseResult {
  userId: string;
  identityDeleted: boolean;
  eventsAnonymised: number;
}

/**
 * Erase a person, as a supported single operation rather than a bespoke script.
 *
 * The identity row is deleted; the person's events are anonymised in place
 * rather than removed, so aggregate counts stay intact and historical reports
 * don't silently change after a data-subject request.
 */
export async function eraseIdentity(
  tenantId: string,
  userId: string
): Promise<EraseResult> {
  const eventResult = await EventModel.updateMany(
    { tenantId, userId },
    {
      // deviceId goes too: keeping it would leave the erased person
      // re-identifiable by joining their events back to a device still in use.
      // The cost is that these rows no longer contribute to unique-device
      // counts — an acceptable trade for an erasure that actually erases.
      $unset: { userId: '', deviceId: '' },
    }
  );

  await DeviceIdentityModel.updateMany(
    { tenantId, userId },
    { $inc: { epoch: 1 }, $unset: { userId: '' } }
  );

  const deleted = await IdentityModel.deleteOne({ tenantId, userId });

  // Any cached device state naming this person is now wrong.
  deviceCache.clear();

  logger.info(
    {
      tenantId,
      userId,
      eventsAnonymised: eventResult.modifiedCount,
      identityDeleted: deleted.deletedCount > 0,
    },
    'Identity erased'
  );

  return {
    userId,
    identityDeleted: deleted.deletedCount > 0,
    eventsAnonymised: eventResult.modifiedCount || 0,
  };
}

// ── Denormalized counters ──────────────────────────────────────────────────

/**
 * Roll event counts and revenue onto the identity so a user list doesn't run an
 * aggregation per row. Fire-and-forget from the ingest path.
 */
export async function incrementIdentityCounters(
  tenantId: string,
  updates: Array<{ userId: string; count: number; value: number; lastEventAt: Date }>
): Promise<void> {
  if (updates.length === 0) return;
  try {
    await IdentityModel.bulkWrite(
      updates.map((u) => ({
        updateOne: {
          filter: { tenantId, userId: u.userId },
          update: {
            $inc: { eventCount: u.count, totalValue: u.value },
            $set: { lastEventAt: u.lastEventAt, lastSeenAt: u.lastEventAt },
          },
        },
      })),
      { ordered: false }
    );
  } catch (err) {
    logger.debug({ error: String(err), tenantId }, 'Identity counter update failed');
  }
}

const IdentityService = {
  getDeviceStates,
  identify,
  logout,
  eraseIdentity,
  incrementIdentityCounters,
};

export default IdentityService;
