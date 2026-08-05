import { Types } from 'mongoose';
import EventModel from '@/lib/models/Event';
import EventRollupModel, { buildDimKey } from '@/lib/models/EventRollup';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ service: 'event-rollup' });

/**
 * Daily pre-aggregation.
 *
 * Raw events expire on a TTL; rollups are kept indefinitely, so a dashboard can
 * still show last year without the storage bill of last year's raw rows. Built
 * now rather than later because adding an aggregation pipeline to a collection
 * that already holds millions of rows is a maintenance window, and building it
 * against an empty collection is free.
 *
 * The job is idempotent: re-running it for a day recomputes that day's buckets
 * from scratch, so a failed or partial run is fixed by running it again.
 */

export interface RollupResult {
  date: string;
  tenants: number;
  buckets: number;
  durationMs: number;
}

/** UTC midnight of the day containing `date`. */
export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

/**
 * Roll up one UTC day, for one tenant or for all of them.
 *
 * Grouping happens in MongoDB and results come back one bucket at a time via
 * a cursor, so memory stays flat regardless of how many dimension combinations
 * a day produced.
 */
export async function rollupDay(options: {
  date: Date;
  tenantId?: string;
  /** Guard against a pathological day producing an unbounded write burst. */
  maxBuckets?: number;
}): Promise<RollupResult> {
  const startedAt = Date.now();
  const dayStart = startOfUtcDay(options.date);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const maxBuckets = options.maxBuckets || 50_000;

  const match: Record<string, unknown> = {
    occurredAt: { $gte: dayStart, $lt: dayEnd },
  };
  if (options.tenantId) {
    match.tenantId = new Types.ObjectId(options.tenantId);
  }

  const BUCKET = {
    tenantId: '$tenantId',
    name: '$name',
    linkId: '$attribution.linkId',
    campaignId: '$attribution.campaignId',
    platform: '$platform',
  };

  /**
   * Count distinct values of `field` per bucket without ever materialising the
   * set.
   *
   * The obvious `$addToSet: '$deviceId'` followed by `$size` builds one array
   * holding every distinct device in the bucket, inside a single output
   * document — which fails hard once a bucket sees a few hundred thousand
   * devices, because a document cannot exceed 16 MB and `allowDiskUse` does not
   * lift that limit. Grouping by (bucket, value) first collapses duplicates in
   * the index, then a second group counts the surviving rows.
   */
  const distinctByBucket = (field: string) =>
    EventModel.aggregate([
      { $match: { ...match, [field]: { $ne: null } } },
      { $group: { _id: { ...BUCKET, value: `$${field}` } } },
      {
        $group: {
          _id: {
            tenantId: '$_id.tenantId',
            name: '$_id.name',
            linkId: '$_id.linkId',
            campaignId: '$_id.campaignId',
            platform: '$_id.platform',
          },
          distinct: { $sum: 1 },
        },
      },
    ]).allowDiskUse(true);

  const bucketKey = (k: any) =>
    `${String(k.tenantId)}|${buildDimKey({
      name: k.name,
      linkId: k.linkId,
      campaignId: k.campaignId,
      platform: k.platform,
    })}`;

  // Two small side pipelines. Their output is one row per bucket — the same
  // cardinality as the main aggregation, and bounded by maxBuckets in practice.
  const [deviceRows, userRows] = await Promise.all([
    distinctByBucket('deviceId'),
    distinctByBucket('userId'),
  ]);

  const uniqueDevicesByBucket = new Map<string, number>(
    deviceRows.map((r: any) => [bucketKey(r._id), r.distinct])
  );
  const uniqueUsersByBucket = new Map<string, number>(
    userRows.map((r: any) => [bucketKey(r._id), r.distinct])
  );

  const cursor = EventModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: BUCKET,
        count: { $sum: 1 },
        valueSum: { $sum: { $ifNull: ['$value', 0] } },
        currency: { $first: '$currency' },
      },
    },
  ])
    .allowDiskUse(true)
    .cursor({ batchSize: 500 });

  const tenants = new Set<string>();
  let buckets = 0;
  let pending: any[] = [];
  const FLUSH_AT = 500;

  const flush = async () => {
    if (pending.length === 0) return;
    await EventRollupModel.bulkWrite(pending, { ordered: false });
    pending = [];
  };

  for await (const row of cursor as any) {
    if (buckets >= maxBuckets) {
      logger.warn(
        { date: dayStart.toISOString(), maxBuckets },
        'Rollup bucket cap reached — remaining dimensions were not aggregated'
      );
      break;
    }

    const key = row._id;
    tenants.add(String(key.tenantId));

    const dimKey = buildDimKey({
      name: key.name,
      linkId: key.linkId,
      campaignId: key.campaignId,
      platform: key.platform,
    });

    pending.push({
      updateOne: {
        filter: { tenantId: key.tenantId, date: dayStart, dimKey },
        update: {
          // $set, not $inc — a re-run must recompute the day, not double it.
          $set: {
            tenantId: key.tenantId,
            date: dayStart,
            dimKey,
            name: key.name,
            linkId: key.linkId || undefined,
            campaignId: key.campaignId || undefined,
            platform: key.platform || undefined,
            count: row.count,
            uniqueDevices: uniqueDevicesByBucket.get(bucketKey(key)) || 0,
            uniqueUsers: uniqueUsersByBucket.get(bucketKey(key)) || 0,
            valueSum: row.valueSum,
            currency: row.currency || undefined,
            computedAt: new Date(),
          },
        },
        upsert: true,
      },
    });

    buckets++;
    if (pending.length >= FLUSH_AT) await flush();
  }

  await flush();

  const durationMs = Date.now() - startedAt;

  logger.info(
    { date: dayStart.toISOString().slice(0, 10), tenants: tenants.size, buckets, durationMs },
    'Daily rollup complete'
  );

  return {
    date: dayStart.toISOString().slice(0, 10),
    tenants: tenants.size,
    buckets,
    durationMs,
  };
}

/**
 * Roll up the last N days.
 *
 * Defaults to 2 rather than 1 so a late-arriving offline queue — an event that
 * happened yesterday but only reached the server today — is folded into the
 * right day on the next run.
 */
export async function rollupRecent(
  days = 2,
  tenantId?: string
): Promise<RollupResult[]> {
  const results: RollupResult[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    results.push(await rollupDay({ date, tenantId }));
  }

  return results;
}

const EventRollupService = { rollupDay, rollupRecent, startOfUtcDay };

export default EventRollupService;
