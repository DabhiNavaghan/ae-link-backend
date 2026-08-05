import { Types } from 'mongoose';
import EventDefinitionModel from '@/lib/models/EventDefinition';
import { Logger } from '@/lib/logger';
import {
  LIMITS,
  SYSTEM_EVENT_NAMES,
  humanizeEventName,
} from '@/lib/utils/event-validation';

const logger = Logger.child({ service: 'event-definition' });

/**
 * The per-tenant event vocabulary.
 *
 * Names auto-register on first sight so a tenant can ship tracking without a
 * dashboard round-trip, then get curated in admin — the reporting UI shows
 * "Ticket Purchase", not `ticket_purchase`.
 *
 * This is also where the cardinality guard lives. Unbounded event names are how
 * event systems become unqueryable: a name derived from a product id gives you
 * a million one-row series and no dashboard. The ceiling is per tenant and
 * generous; hitting it is a signal that a property was mistakenly used as a name.
 */

// Known names, cached per tenant so a hot ingest path doesn't hit the database
// once per event just to ask "have I seen this before?".
interface TenantVocabulary {
  names: Set<string>;
  expiresAt: number;
}

const VOCAB_TTL_MS = 60_000;
const vocabCache = new Map<string, TenantVocabulary>();

function getCachedVocabulary(tenantId: string): Set<string> | undefined {
  const hit = vocabCache.get(tenantId);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    vocabCache.delete(tenantId);
    return undefined;
  }
  return hit.names;
}

async function loadVocabulary(tenantId: string): Promise<Set<string>> {
  const cached = getCachedVocabulary(tenantId);
  if (cached) return cached;

  const defs = await EventDefinitionModel.find({ tenantId })
    .select('name')
    .lean();
  const names = new Set(defs.map((d) => d.name));
  vocabCache.set(tenantId, { names, expiresAt: Date.now() + VOCAB_TTL_MS });
  return names;
}

export function invalidateVocabulary(tenantId: string): void {
  vocabCache.delete(tenantId);
}

export interface RegisterResult {
  /** False when the tenant is at its name ceiling and this name is new. */
  allowed: boolean;
  reason?: string;
}

/**
 * Ensure definitions exist for every name in a batch.
 *
 * Called once per request with the full distinct name set rather than once per
 * event, so a 50-event batch costs at most one write.
 */
export async function ensureDefinitions(
  tenantId: string,
  names: string[],
  options: {
    appId?: string;
    maxNames?: number;
    /** Counts to fold into eventCount, keyed by name. */
    counts?: Map<string, number>;
  } = {}
): Promise<Map<string, RegisterResult>> {
  const results = new Map<string, RegisterResult>();
  const distinct = Array.from(new Set(names));
  if (distinct.length === 0) return results;

  const maxNames = options.maxNames || LIMITS.EVENT_NAME_CARDINALITY_MAX;

  let known: Set<string>;
  try {
    known = await loadVocabulary(tenantId);
  } catch (err) {
    // A vocabulary read failure must not reject the batch — accept the events
    // and let the definition catch up on a later request.
    logger.warn({ error: String(err), tenantId }, 'Vocabulary load failed');
    for (const name of distinct) results.set(name, { allowed: true });
    return results;
  }

  const unknown = distinct.filter((n) => !known.has(n));
  const now = new Date();

  // Cardinality is only checked when something new would be created. An
  // established tenant at the ceiling keeps ingesting its existing names.
  let budget = Infinity;
  if (unknown.length > 0) {
    const existingCount = await EventDefinitionModel.countDocuments({ tenantId });
    budget = Math.max(0, maxNames - existingCount);
  }

  const toCreate: string[] = [];
  for (const name of distinct) {
    if (known.has(name)) {
      results.set(name, { allowed: true });
      continue;
    }
    if (toCreate.length >= budget) {
      results.set(name, {
        allowed: false,
        reason:
          `Tenant has reached its limit of ${maxNames} distinct event names. ` +
          `"${name}" was not recorded. This usually means a value (an id, a title) ` +
          `is being sent as an event name — send it in properties instead.`,
      });
      continue;
    }
    toCreate.push(name);
    results.set(name, { allowed: true });
  }

  if (toCreate.length > 0) {
    try {
      await EventDefinitionModel.bulkWrite(
        toCreate.map((name) => ({
          updateOne: {
            filter: { tenantId, name },
            update: {
              $setOnInsert: {
                tenantId: new Types.ObjectId(tenantId),
                name,
                appId: options.appId
                  ? new Types.ObjectId(options.appId)
                  : undefined,
                label: humanizeEventName(name),
                category: 'uncategorized',
                isConversion: false,
                expectsValue: false,
                status: 'active',
                isSystem: (SYSTEM_EVENT_NAMES as readonly string[]).includes(name),
                firstSeenAt: now,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false }
      );
      invalidateVocabulary(tenantId);
      logger.info({ tenantId, names: toCreate }, 'Auto-registered event definitions');
    } catch (err) {
      // A duplicate-key race between two concurrent batches is expected and
      // harmless — the definition exists either way.
      logger.debug({ error: String(err), tenantId }, 'Definition upsert race');
    }
  }

  // Roll usage counters forward. Fire-and-forget: these drive an admin list,
  // not a report, and must never slow the ingest path.
  if (options.counts && options.counts.size > 0) {
    EventDefinitionModel.bulkWrite(
      Array.from(options.counts.entries()).map(([name, count]) => ({
        updateOne: {
          filter: { tenantId, name },
          update: { $inc: { eventCount: count }, $set: { lastSeenAt: now } },
        },
      })),
      { ordered: false }
    ).catch((err) => {
      logger.debug({ error: String(err), tenantId }, 'Definition counter update failed');
    });
  }

  return results;
}

/** Event names this tenant has flagged as conversions. Used to build the conversion view over events. */
export async function getConversionNames(tenantId: string): Promise<string[]> {
  const defs = await EventDefinitionModel.find({ tenantId, isConversion: true })
    .select('name')
    .lean();
  return defs.map((d) => d.name);
}

const EventDefinitionService = {
  ensureDefinitions,
  getConversionNames,
  invalidateVocabulary,
};

export default EventDefinitionService;
