import { Types } from 'mongoose';
import EventModel from '@/lib/models/Event';
import EventDefinitionModel from '@/lib/models/EventDefinition';
import IdentityModel from '@/lib/models/Identity';
import InstallModel from '@/lib/models/Install';
import ClickModel from '@/lib/models/Click';
import LinkModel from '@/lib/models/Link';
import CampaignModel from '@/lib/models/Campaign';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ service: 'event-analytics' });

/**
 * Reporting over the event stream.
 *
 * Everything here filters on tenantId first and matches a compound index whose
 * leading field is tenantId — the same shape the Event model declares. Nothing
 * resolves attribution at read time: the link and campaign were denormalized
 * onto the row on ingest, so these are index scans rather than $lookup chains.
 */

export interface EventQueryFilters {
  tenantId: string;
  from: Date;
  to: Date;
  /** Restrict to one event name. */
  name?: string;
  linkId?: string;
  campaignId?: string;
  userId?: string;
  deviceId?: string;
  platform?: string;
  /** Only events whose definition is flagged isConversion. */
  conversionsOnly?: boolean;
}

/** Build the tenant-scoped match stage shared by every query below. */
async function buildMatch(
  filters: EventQueryFilters
): Promise<Record<string, unknown>> {
  const match: Record<string, unknown> = {
    tenantId: new Types.ObjectId(filters.tenantId),
    occurredAt: { $gte: filters.from, $lte: filters.to },
  };

  if (filters.name) match.name = filters.name;
  if (filters.linkId && Types.ObjectId.isValid(filters.linkId)) {
    match['attribution.linkId'] = new Types.ObjectId(filters.linkId);
  }
  if (filters.campaignId && Types.ObjectId.isValid(filters.campaignId)) {
    match['attribution.campaignId'] = new Types.ObjectId(filters.campaignId);
  }
  if (filters.userId) match.userId = filters.userId;
  if (filters.deviceId) match.deviceId = filters.deviceId;
  if (filters.platform) match.platform = filters.platform;

  if (filters.conversionsOnly) {
    // A conversion is a label over events, not a parallel counter. The set of
    // conversion names is tiny, so resolving it into an $in beats denormalizing
    // a flag that would go stale the moment a tenant re-labels a name.
    const defs = await EventDefinitionModel.find({
      tenantId: filters.tenantId,
      isConversion: true,
    })
      .select('name')
      .lean();
    match.name = { $in: defs.map((d) => d.name) };
  }

  return match;
}

/**
 * Count distinct values of `distinctField` per `groupField`, without ever
 * materialising the set of values.
 *
 * The obvious `$addToSet` + `$size` collects every distinct device or user into
 * an array inside one output document. A single document cannot exceed 16 MB —
 * a limit `allowDiskUse` does not lift — so a busy tenant's `app_open` bucket
 * would fail the whole query somewhere north of a few hundred thousand devices.
 * Grouping by (group, value) first collapses duplicates, then a second group
 * counts the survivors: exact, and bounded by the number of groups rather than
 * the number of distinct values.
 */
async function countDistinctPerGroup(
  match: Record<string, unknown>,
  groupField: string,
  distinctField: 'deviceId' | 'userId'
): Promise<Map<string, number>> {
  const rows = await EventModel.aggregate([
    // Excluding nulls here is what makes "unique users" mean identified people
    // rather than "people, plus one for everybody anonymous".
    { $match: { ...match, [distinctField]: { $ne: null } } },
    { $group: { _id: { group: groupField, value: `$${distinctField}` } } },
    { $group: { _id: '$_id.group', distinct: { $sum: 1 } } },
  ]).allowDiskUse(true);

  return new Map(rows.map((r) => [r._id ? String(r._id) : '', r.distinct]));
}

/** Groups with no value (an unattributed campaign) key on the empty string. */
const groupKey = (id: unknown) => (id ? String(id) : '');

// ── Breakdown by event name ────────────────────────────────────────────────

export interface EventNameStat {
  name: string;
  label: string;
  isConversion: boolean;
  count: number;
  uniqueDevices: number;
  uniqueUsers: number;
  totalValue: number;
  lastOccurredAt: Date;
}

/** Counts, unique reach and revenue per event name. The default reporting view. */
export async function getEventBreakdown(
  filters: EventQueryFilters,
  limit = 100
): Promise<EventNameStat[]> {
  const match = await buildMatch(filters);

  const [rows, deviceCounts, userCounts] = await Promise.all([
    EventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$name',
          count: { $sum: 1 },
          totalValue: { $sum: { $ifNull: ['$value', 0] } },
          lastOccurredAt: { $max: '$occurredAt' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    countDistinctPerGroup(match, '$name', 'deviceId'),
    countDistinctPerGroup(match, '$name', 'userId'),
  ]);

  // Attach the tenant's own labels so the dashboard shows "Ticket Purchase"
  // rather than raw snake_case.
  const defs = await EventDefinitionModel.find({
    tenantId: filters.tenantId,
    name: { $in: rows.map((r) => r._id) },
  })
    .select('name label isConversion')
    .lean();
  const defByName = new Map(defs.map((d) => [d.name, d]));

  return rows.map((r) => ({
    name: r._id,
    label: defByName.get(r._id)?.label || r._id,
    isConversion: defByName.get(r._id)?.isConversion || false,
    count: r.count,
    uniqueDevices: deviceCounts.get(groupKey(r._id)) || 0,
    uniqueUsers: userCounts.get(groupKey(r._id)) || 0,
    totalValue: r.totalValue,
    lastOccurredAt: r.lastOccurredAt,
  }));
}

// ── Breakdown by campaign ──────────────────────────────────────────────────

export interface CampaignStat {
  campaignId: string | null;
  campaignName: string;
  events: number;
  conversions: number;
  uniqueDevices: number;
  uniqueUsers: number;
  totalValue: number;
}

/**
 * "Which campaign did this user come from, and what are they doing?" —
 * answered per campaign, in one pass.
 *
 * Rows with no campaign are reported as `null` rather than dropped: the
 * unattributed share is a metric worth watching, not noise to hide.
 */
export async function getCampaignBreakdown(
  filters: EventQueryFilters
): Promise<CampaignStat[]> {
  const match = await buildMatch(filters);

  const conversionDefs = await EventDefinitionModel.find({
    tenantId: filters.tenantId,
    isConversion: true,
  })
    .select('name')
    .lean();
  const conversionNames = conversionDefs.map((d) => d.name);

  const [rows, deviceCounts, userCounts] = await Promise.all([
    EventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$attribution.campaignId',
          // The snapshot taken at ingest, used when the campaign has since been
          // deleted — a report should not lose its label to a later edit.
          campaignLabel: { $first: '$attribution.campaign' },
          events: { $sum: 1 },
          conversions: {
            $sum: { $cond: [{ $in: ['$name', conversionNames] }, 1, 0] },
          },
          totalValue: { $sum: { $ifNull: ['$value', 0] } },
        },
      },
      { $sort: { events: -1 } },
      { $limit: 200 },
    ]),
    countDistinctPerGroup(match, '$attribution.campaignId', 'deviceId'),
    countDistinctPerGroup(match, '$attribution.campaignId', 'userId'),
  ]);

  const campaignIds = rows.map((r) => r._id).filter(Boolean);
  const campaigns = campaignIds.length
    ? await CampaignModel.find({
        _id: { $in: campaignIds },
        tenantId: filters.tenantId,
      })
        .select('name')
        .lean()
    : [];
  const nameById = new Map(campaigns.map((c) => [String(c._id), c.name]));

  return rows.map((r) => ({
    campaignId: r._id ? String(r._id) : null,
    campaignName:
      (r._id && nameById.get(String(r._id))) ||
      r.campaignLabel ||
      (r._id ? 'Deleted campaign' : 'Unattributed'),
    events: r.events,
    conversions: r.conversions,
    uniqueDevices: deviceCounts.get(groupKey(r._id)) || 0,
    uniqueUsers: userCounts.get(groupKey(r._id)) || 0,
    totalValue: r.totalValue,
  }));
}

// ── Breakdown by link ──────────────────────────────────────────────────────

export interface LinkStat {
  linkId: string | null;
  title: string;
  shortCode: string | null;
  events: number;
  conversions: number;
  uniqueUsers: number;
  totalValue: number;
}

export async function getLinkBreakdown(
  filters: EventQueryFilters,
  limit = 100
): Promise<LinkStat[]> {
  const match = await buildMatch(filters);

  const conversionDefs = await EventDefinitionModel.find({
    tenantId: filters.tenantId,
    isConversion: true,
  })
    .select('name')
    .lean();
  const conversionNames = conversionDefs.map((d) => d.name);

  const [rows, userCounts] = await Promise.all([
    EventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$attribution.linkId',
          shortCode: { $first: '$attribution.shortCode' },
          events: { $sum: 1 },
          conversions: {
            $sum: { $cond: [{ $in: ['$name', conversionNames] }, 1, 0] },
          },
          totalValue: { $sum: { $ifNull: ['$value', 0] } },
        },
      },
      { $sort: { events: -1 } },
      { $limit: limit },
    ]),
    countDistinctPerGroup(match, '$attribution.linkId', 'userId'),
  ]);

  const linkIds = rows.map((r) => r._id).filter(Boolean);
  const links = linkIds.length
    ? await LinkModel.find({ _id: { $in: linkIds }, tenantId: filters.tenantId })
        .select('title shortCode')
        .lean()
    : [];
  const byId = new Map(links.map((l) => [String(l._id), l]));

  return rows.map((r) => {
    const link = r._id ? byId.get(String(r._id)) : undefined;
    return {
      linkId: r._id ? String(r._id) : null,
      title:
        (link as any)?.title ||
        (link as any)?.shortCode ||
        r.shortCode ||
        (r._id ? 'Deleted link' : 'Unattributed'),
      shortCode: (link as any)?.shortCode || r.shortCode || null,
      events: r.events,
      conversions: r.conversions,
      uniqueUsers: userCounts.get(groupKey(r._id)) || 0,
      totalValue: r.totalValue,
    };
  });
}

// ── Timeseries ─────────────────────────────────────────────────────────────

export interface TimeseriesPoint {
  date: string;
  count: number;
  value: number;
}

export async function getEventTimeseries(
  filters: EventQueryFilters
): Promise<TimeseriesPoint[]> {
  const match = await buildMatch(filters);

  const rows = await EventModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$occurredAt' },
        },
        count: { $sum: 1 },
        value: { $sum: { $ifNull: ['$value', 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => ({ date: r._id, count: r.count, value: r.value }));
}

// ── The funnel ─────────────────────────────────────────────────────────────

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  /** Share of the stage above. Null for the first stage. */
  conversionRate: number | null;
}

/**
 * click → install → app open → sign-in → conversion.
 *
 * This is the funnel the platform could not previously close: it stopped at
 * install, because nothing downstream of it was ever recorded.
 *
 * Each stage is counted from the collection that owns it rather than derived
 * from the one above, so a stage can legitimately exceed its predecessor when
 * the date window clips a journey. That is visible in the numbers rather than
 * hidden by forcing monotonicity.
 */
export async function getFunnel(filters: {
  tenantId: string;
  from: Date;
  to: Date;
  linkId?: string;
  campaignId?: string;
}): Promise<FunnelStage[]> {
  const tenantOid = new Types.ObjectId(filters.tenantId);
  const dateRange = { $gte: filters.from, $lte: filters.to };

  // Clicks and installs predate the event system and live in their own
  // collections, so the top of the funnel is counted there.
  const clickMatch: Record<string, unknown> = {
    tenantId: tenantOid,
    createdAt: dateRange,
  };
  if (filters.linkId && Types.ObjectId.isValid(filters.linkId)) {
    clickMatch.linkId = new Types.ObjectId(filters.linkId);
  } else if (filters.campaignId && Types.ObjectId.isValid(filters.campaignId)) {
    // Click carries no campaignId — resolve the campaign's links first.
    const links = await LinkModel.find({
      tenantId: filters.tenantId,
      campaignId: filters.campaignId,
    })
      .select('_id')
      .lean();
    clickMatch.linkId = { $in: links.map((l) => l._id) };
  }

  const eventFilters: EventQueryFilters = {
    tenantId: filters.tenantId,
    from: filters.from,
    to: filters.to,
    linkId: filters.linkId,
    campaignId: filters.campaignId,
  };
  const eventMatch = await buildMatch(eventFilters);

  const conversionMatch = await buildMatch({
    ...eventFilters,
    conversionsOnly: true,
  });

  const identityMatch: Record<string, unknown> = {
    tenantId: tenantOid,
    identifiedAt: dateRange,
  };
  if (filters.linkId && Types.ObjectId.isValid(filters.linkId)) {
    identityMatch['acquisition.linkId'] = new Types.ObjectId(filters.linkId);
  }
  if (filters.campaignId && Types.ObjectId.isValid(filters.campaignId)) {
    identityMatch['acquisition.campaignId'] = new Types.ObjectId(
      filters.campaignId
    );
  }

  const [clicks, installs, opens, signIns, conversions] = await Promise.all([
    ClickModel.countDocuments(clickMatch),
    // Installs are only filterable by link through the attribution chain, which
    // is exactly what the event system now denormalizes — so when a link or
    // campaign filter is set we count install events instead of Install rows.
    filters.linkId || filters.campaignId
      ? EventModel.countDocuments({ ...eventMatch, name: 'app_install' })
      : InstallModel.countDocuments({
          tenantId: tenantOid,
          installType: { $in: ['first_install', 'reinstall'] },
          createdAt: dateRange,
        }),
    EventModel.countDocuments({ ...eventMatch, name: 'app_open' }),
    IdentityModel.countDocuments(identityMatch),
    EventModel.countDocuments(conversionMatch),
  ]);

  const rate = (n: number, prev: number) =>
    prev > 0 ? Math.round((n / prev) * 10000) / 100 : null;

  return [
    { stage: 'click', label: 'Clicked', count: clicks, conversionRate: null },
    {
      stage: 'install',
      label: 'Installed',
      count: installs,
      conversionRate: rate(installs, clicks),
    },
    {
      stage: 'open',
      label: 'Opened app',
      count: opens,
      conversionRate: rate(opens, installs),
    },
    {
      stage: 'signin',
      label: 'Signed in',
      count: signIns,
      conversionRate: rate(signIns, opens),
    },
    {
      stage: 'conversion',
      label: 'Converted',
      count: conversions,
      conversionRate: rate(conversions, signIns),
    },
  ];
}

// ── Users ──────────────────────────────────────────────────────────────────

export interface UserRow {
  userId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  eventCount: number;
  totalValue: number;
  deviceCount: number;
  acquisition: {
    linkId: string | null;
    campaignId: string | null;
    campaign: string | null;
    source: string | null;
    shortCode: string | null;
    model: string;
  } | null;
}

/**
 * Users as a reportable unit: who was acquired, by which link and campaign,
 * and what they have been worth since.
 *
 * Reads the denormalized counters on Identity rather than aggregating events,
 * so listing users stays a plain indexed find() no matter how large the event
 * collection grows.
 */
export async function getUsers(filters: {
  tenantId: string;
  from?: Date;
  to?: Date;
  linkId?: string;
  campaignId?: string;
  page?: number;
  limit?: number;
  sort?: 'recent' | 'value' | 'events';
}): Promise<{ users: UserRow[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 25));

  const match: Record<string, unknown> = {
    tenantId: new Types.ObjectId(filters.tenantId),
  };

  if (filters.from || filters.to) {
    match.identifiedAt = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }
  if (filters.linkId && Types.ObjectId.isValid(filters.linkId)) {
    match['acquisition.linkId'] = new Types.ObjectId(filters.linkId);
  }
  if (filters.campaignId && Types.ObjectId.isValid(filters.campaignId)) {
    match['acquisition.campaignId'] = new Types.ObjectId(filters.campaignId);
  }

  const sortSpec: Record<string, 1 | -1> =
    filters.sort === 'value'
      ? { totalValue: -1 }
      : filters.sort === 'events'
        ? { eventCount: -1 }
        : { lastSeenAt: -1 };

  const [rows, total] = await Promise.all([
    IdentityModel.find(match)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        'userId firstSeenAt lastSeenAt eventCount totalValue devices acquisition'
      )
      .lean(),
    IdentityModel.countDocuments(match),
  ]);

  return {
    users: rows.map((r) => ({
      userId: r.userId,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
      eventCount: r.eventCount || 0,
      totalValue: r.totalValue || 0,
      deviceCount: r.devices?.length || 0,
      acquisition: r.acquisition
        ? {
            linkId: r.acquisition.linkId ? String(r.acquisition.linkId) : null,
            campaignId: r.acquisition.campaignId
              ? String(r.acquisition.campaignId)
              : null,
            campaign: r.acquisition.campaign || null,
            source: r.acquisition.source || null,
            shortCode: r.acquisition.shortCode || null,
            model: r.acquisition.model,
          }
        : null,
    })),
    total,
    page,
    limit,
  };
}

// ── Health ─────────────────────────────────────────────────────────────────

export interface IngestHealth {
  totalEvents: number;
  unattributedRate: number;
  identifiedRate: number;
  /** Mean absolute client/server clock gap. A rising number means offline replay or bad device clocks. */
  avgClockSkewMs: number;
  /** Worst gap in the window — usually an offline queue flushing days late. */
  maxClockSkewMs: number;
  distinctEventNames: number;
  nameBudgetUsed: number;
}

/**
 * Operational health of the pipeline.
 *
 * The unattributed rate is the headline: organic events are legitimate data,
 * but a rate that climbs sharply usually means attribution broke, not that
 * marketing stopped working.
 */
export async function getIngestHealth(filters: {
  tenantId: string;
  from: Date;
  to: Date;
  maxEventNames: number;
}): Promise<IngestHealth> {
  const match = {
    tenantId: new Types.ObjectId(filters.tenantId),
    occurredAt: { $gte: filters.from, $lte: filters.to },
  };

  const [agg, distinctNames] = await Promise.all([
    EventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unattributed: {
            $sum: { $cond: [{ $eq: ['$attribution.model', 'none'] }, 1, 0] },
          },
          identified: {
            $sum: { $cond: [{ $ifNull: ['$userId', false] }, 1, 0] },
          },
          // Accumulators, not $push. Pushing every skew into one array would
          // build a document that exceeds the 16 MB BSON limit long before the
          // event collection gets interesting.
          avgSkew: { $avg: { $abs: { $ifNull: ['$clockSkewMs', 0] } } },
          maxSkew: { $max: { $abs: { $ifNull: ['$clockSkewMs', 0] } } },
        },
      },
    ]),
    EventDefinitionModel.countDocuments({ tenantId: filters.tenantId }),
  ]);

  const row = agg[0];
  if (!row || row.total === 0) {
    return {
      totalEvents: 0,
      unattributedRate: 0,
      identifiedRate: 0,
      avgClockSkewMs: 0,
      maxClockSkewMs: 0,
      distinctEventNames: distinctNames,
      nameBudgetUsed: filters.maxEventNames
        ? Math.round((distinctNames / filters.maxEventNames) * 100)
        : 0,
    };
  }

  return {
    totalEvents: row.total,
    unattributedRate: Math.round((row.unattributed / row.total) * 10000) / 100,
    identifiedRate: Math.round((row.identified / row.total) * 10000) / 100,
    avgClockSkewMs: Math.round(row.avgSkew || 0),
    maxClockSkewMs: Math.round(row.maxSkew || 0),
    distinctEventNames: distinctNames,
    nameBudgetUsed: filters.maxEventNames
      ? Math.round((distinctNames / filters.maxEventNames) * 100)
      : 0,
  };
}

const EventAnalyticsService = {
  getEventBreakdown,
  getCampaignBreakdown,
  getLinkBreakdown,
  getEventTimeseries,
  getFunnel,
  getUsers,
  getIngestHealth,
};

export default EventAnalyticsService;
