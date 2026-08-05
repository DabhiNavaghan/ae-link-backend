import { Types } from 'mongoose';
import InstallModel from '@/lib/models/Install';
import DeferredLinkModel from '@/lib/models/DeferredLink';
import FingerprintModel from '@/lib/models/Fingerprint';
import ClickModel from '@/lib/models/Click';
import LinkModel from '@/lib/models/Link';
import { Logger } from '@/lib/logger';
import { IEventAttribution, AttributionModel } from '@/types/events';
import { DEFAULT_ATTRIBUTION_WINDOW_DAYS } from '@/lib/utils/event-validation';

const logger = Logger.child({ service: 'event-attribution' });

/**
 * Attribution resolver.
 *
 * One job: given a device and a timestamp, name the click that earned this
 * event. It runs once per event on write, and the answer is denormalized onto
 * the event row — read-time resolution would mean a four-collection $lookup
 * chain on every dashboard load, which is already the slowest query in
 * analytics.service.ts at install volume and would not survive event volume.
 *
 * The ladder, strongest claim first:
 *
 *   1. explicit_click — the SDK opened a deep link and carries the clickId.
 *   2. install_match  — deviceId → Install → DeferredLink → Fingerprint → Click.
 *                       Exact and already built; always beats a recency guess.
 *   3. last_touch     — most recent device→click bridge inside the lookback
 *                       window. A weaker claim, labelled honestly.
 *   4. direct         — the app was launched from a link (Install.lastLinkId).
 *   5. none           — organic. Recorded as data, not as a failure.
 *
 * Note on step 3: Click carries no deviceId — clicks happen in a browser before
 * the app exists. DeferredLink is the only collection that bridges the two, so
 * "the device's recent clicks" means "recent DeferredLinks carrying this
 * deviceId".
 */

export interface ResolveInput {
  tenantId: string;
  deviceId?: string;
  /** Passed when the SDK knows exactly which click opened the app. */
  clickId?: string;
  occurredAt: Date;
  windowDays?: number;
}

// ── Per-device memo cache ──────────────────────────────────────────────────
//
// A batch of 50 events from one device must not run the lookup chain 50 times.
// Attribution for a device is stable for far longer than this TTL — the cache
// exists to collapse a burst, not to be a source of truth.

interface CacheEntry {
  value: IEventAttribution;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 5_000;
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): IEventAttribution | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  // Refresh insertion order so the eviction below is roughly LRU.
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key: string, value: IEventAttribution): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Map preserves insertion order — the first key is the least recently used.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Drop a device's memo — called on identify/logout so a stale answer can't outlive the transition. */
export function invalidateAttributionCache(
  tenantId: string,
  deviceId: string
): void {
  cache.delete(`${tenantId}:${deviceId}`);
}

// ── Link enrichment ────────────────────────────────────────────────────────

interface LinkFacts {
  campaignId?: Types.ObjectId;
  source?: string;
  medium?: string;
  campaign?: string;
  shortCode?: string;
}

/**
 * Pull the campaign and UTM snapshot off a link.
 *
 * These are copied onto the event rather than referenced so that renaming a
 * campaign or editing a link's params never silently rewrites what historical
 * reports say happened.
 */
async function loadLinkFacts(
  tenantId: string,
  linkId: Types.ObjectId | string | undefined
): Promise<LinkFacts> {
  if (!linkId) return {};
  try {
    const link = await LinkModel.findOne({ _id: linkId, tenantId })
      .select('campaignId params shortCode')
      .lean();
    if (!link) return {};
    const params = (link as any).params || {};
    return {
      campaignId: (link as any).campaignId || undefined,
      source: params.utmSource || undefined,
      medium: params.utmMedium || undefined,
      campaign: params.utmCampaign || undefined,
      shortCode: (link as any).shortCode || undefined,
    };
  } catch (err) {
    logger.warn({ error: String(err), linkId: String(linkId) }, 'Link lookup failed');
    return {};
  }
}

function build(
  model: AttributionModel,
  ids: Partial<IEventAttribution>,
  facts: LinkFacts = {}
): IEventAttribution {
  return {
    ...ids,
    campaignId: facts.campaignId,
    source: facts.source,
    medium: facts.medium,
    campaign: facts.campaign,
    shortCode: facts.shortCode,
    model,
    resolvedAt: new Date(),
  } as IEventAttribution;
}

const UNATTRIBUTED: () => IEventAttribution = () => ({
  model: 'none',
  resolvedAt: new Date(),
});

// ── Ladder steps ───────────────────────────────────────────────────────────

/** 1. The SDK holds a clickId from the deep link it opened. Verified against the tenant. */
async function tryExplicitClick(
  tenantId: string,
  clickId: string
): Promise<IEventAttribution | null> {
  if (!Types.ObjectId.isValid(clickId)) return null;

  // Scoped by tenantId — a caller must not be able to attribute their events to
  // another tenant's click by guessing an id.
  const click = await ClickModel.findOne({ _id: clickId, tenantId })
    .select('linkId')
    .lean();
  if (!click?.linkId) return null;

  const facts = await loadLinkFacts(tenantId, click.linkId);
  return build(
    'explicit_click',
    { linkId: click.linkId as any, clickId: (click as any)._id },
    facts
  );
}

/** 2. deviceId → Install → DeferredLink → Fingerprint → Click. */
async function tryInstallMatch(
  tenantId: string,
  deviceId: string
): Promise<IEventAttribution | null> {
  const install = await InstallModel.findOne({ tenantId, deviceId })
    .select('_id deferredLinkId lastLinkId lastSeenAt')
    .lean();

  if (!install?.deferredLinkId) return null;

  const deferred = await DeferredLinkModel.findOne({
    _id: install.deferredLinkId,
    tenantId,
  })
    .select('linkId fingerprintId')
    .lean();
  if (!deferred?.linkId) return null;

  // The click id lives one hop further on, through the fingerprint.
  let clickId: Types.ObjectId | undefined;
  if (deferred.fingerprintId) {
    const fp = await FingerprintModel.findById(deferred.fingerprintId)
      .select('clickId')
      .lean();
    clickId = (fp as any)?.clickId || undefined;
  }

  const facts = await loadLinkFacts(tenantId, deferred.linkId);
  return build(
    'install_match',
    {
      linkId: deferred.linkId as any,
      clickId,
      installId: (install as any)._id,
      deferredLinkId: (deferred as any)._id,
    },
    facts
  );
}

/** 3. Most recent DeferredLink carrying this device, inside the lookback window. */
async function tryLastTouch(
  tenantId: string,
  deviceId: string,
  occurredAt: Date,
  windowDays: number
): Promise<IEventAttribution | null> {
  const windowStart = new Date(
    occurredAt.getTime() - windowDays * 24 * 60 * 60 * 1000
  );

  const deferred = await DeferredLinkModel.findOne({
    tenantId,
    deviceId,
    status: { $in: ['matched', 'confirmed'] },
    createdAt: { $gte: windowStart, $lte: occurredAt },
  })
    .sort({ createdAt: -1 })
    .select('linkId fingerprintId')
    .lean();

  if (!deferred?.linkId) return null;

  let clickId: Types.ObjectId | undefined;
  if (deferred.fingerprintId) {
    const fp = await FingerprintModel.findById(deferred.fingerprintId)
      .select('clickId')
      .lean();
    clickId = (fp as any)?.clickId || undefined;
  }

  const facts = await loadLinkFacts(tenantId, deferred.linkId);
  return build(
    'last_touch',
    {
      linkId: deferred.linkId as any,
      clickId,
      deferredLinkId: (deferred as any)._id,
    },
    facts
  );
}

/**
 * 4. The app was last launched from a link.
 *
 * Install.lastLinkId is written by /sdk/init on every open and holds a
 * shortCode, not an ObjectId — it is parsed out of the launch URL's path.
 */
async function tryDirect(
  tenantId: string,
  deviceId: string,
  occurredAt: Date,
  windowDays: number
): Promise<IEventAttribution | null> {
  const install = await InstallModel.findOne({ tenantId, deviceId })
    .select('_id lastLinkId lastSeenAt lastSource lastMedium lastCampaign')
    .lean();

  if (!install?.lastLinkId) return null;

  const windowStart = new Date(
    occurredAt.getTime() - windowDays * 24 * 60 * 60 * 1000
  );
  const lastSeen = (install as any).lastSeenAt as Date | undefined;
  if (lastSeen && lastSeen < windowStart) return null;

  const link = await LinkModel.findOne({
    tenantId,
    shortCode: install.lastLinkId,
  })
    .select('_id campaignId params shortCode')
    .lean();

  if (!link) return null;

  const params = (link as any).params || {};
  return build(
    'direct',
    { linkId: (link as any)._id, installId: (install as any)._id },
    {
      campaignId: (link as any).campaignId || undefined,
      // The launch URL's own UTMs are more specific than the link's stored
      // defaults, so they win where present.
      source: (install as any).lastSource || params.utmSource || undefined,
      medium: (install as any).lastMedium || params.utmMedium || undefined,
      campaign: (install as any).lastCampaign || params.utmCampaign || undefined,
      shortCode: (link as any).shortCode || undefined,
    }
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve attribution for one event. Never throws — an attribution failure
 * must degrade to `model: "none"`, not lose the event.
 */
export async function resolveAttribution(
  input: ResolveInput
): Promise<IEventAttribution> {
  const {
    tenantId,
    deviceId,
    clickId,
    occurredAt,
    windowDays = DEFAULT_ATTRIBUTION_WINDOW_DAYS,
  } = input;

  try {
    // Step 1 is per-event, not per-device, so it sits outside the cache.
    if (clickId) {
      const explicit = await tryExplicitClick(tenantId, clickId);
      if (explicit) return explicit;
    }

    if (!deviceId) return UNATTRIBUTED();

    const cacheKey = `${tenantId}:${deviceId}`;
    const cached = cacheGet(cacheKey);
    if (cached) return { ...cached, resolvedAt: new Date() };

    const resolved =
      (await tryInstallMatch(tenantId, deviceId)) ||
      (await tryLastTouch(tenantId, deviceId, occurredAt, windowDays)) ||
      (await tryDirect(tenantId, deviceId, occurredAt, windowDays)) ||
      UNATTRIBUTED();

    cacheSet(cacheKey, resolved);
    return resolved;
  } catch (err) {
    logger.warn(
      { error: String(err), tenantId, deviceId },
      'Attribution resolution failed — recording as unattributed'
    );
    return UNATTRIBUTED();
  }
}

/**
 * Resolve attribution for a batch, running one lookup per distinct device
 * rather than one per event. Events carrying an explicit clickId are resolved
 * individually because their answer is per-event.
 *
 * Returns a map keyed by the caller's own index.
 */
export async function resolveAttributionBatch(
  tenantId: string,
  items: Array<{ index: number; deviceId?: string; clickId?: string; occurredAt: Date }>,
  windowDays: number = DEFAULT_ATTRIBUTION_WINDOW_DAYS
): Promise<Map<number, IEventAttribution>> {
  const results = new Map<number, IEventAttribution>();

  const explicitItems = items.filter((i) => i.clickId);
  const deviceItems = items.filter((i) => !i.clickId);

  await Promise.all(
    explicitItems.map(async (item) => {
      results.set(
        item.index,
        await resolveAttribution({
          tenantId,
          deviceId: item.deviceId,
          clickId: item.clickId,
          occurredAt: item.occurredAt,
          windowDays,
        })
      );
    })
  );

  // Group the rest by device so a 50-event burst costs one chain, not fifty.
  const byDevice = new Map<string, typeof deviceItems>();
  const deviceless: typeof deviceItems = [];

  for (const item of deviceItems) {
    if (!item.deviceId) {
      deviceless.push(item);
      continue;
    }
    const bucket = byDevice.get(item.deviceId);
    if (bucket) bucket.push(item);
    else byDevice.set(item.deviceId, [item]);
  }

  for (const item of deviceless) results.set(item.index, UNATTRIBUTED());

  await Promise.all(
    Array.from(byDevice.entries()).map(async ([deviceId, group]) => {
      // Resolve against the newest timestamp in the group; the lookback window
      // is measured in days, so sub-batch spread is immaterial.
      const newest = group.reduce(
        (max, i) => (i.occurredAt > max ? i.occurredAt : max),
        group[0].occurredAt
      );
      const attribution = await resolveAttribution({
        tenantId,
        deviceId,
        occurredAt: newest,
        windowDays,
      });
      for (const item of group) results.set(item.index, { ...attribution });
    })
  );

  return results;
}

const EventAttributionService = {
  resolveAttribution,
  resolveAttributionBatch,
  invalidateAttributionCache,
};

export default EventAttributionService;
