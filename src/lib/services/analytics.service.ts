import { Logger } from '@/lib/logger';
import ClickModel from '@/lib/models/Click';
import ConversionModel from '@/lib/models/Conversion';
import LinkModel from '@/lib/models/Link';
import CampaignModel from '@/lib/models/Campaign';
import DeferredLinkModel from '@/lib/models/DeferredLink';
import InstallModel from '@/lib/models/Install';
import {
  LinkAnalytics,
  CampaignAnalytics,
  DashboardOverview,
} from '@/types';
import { Types } from 'mongoose';

const logger = Logger.child({ service: 'AnalyticsService' });

export class AnalyticsService {
  /**
   * Get analytics for a specific link
   */
  static async getLinkAnalytics(linkId: string): Promise<LinkAnalytics | null> {
    const link = await LinkModel.findById(linkId).lean();
    if (!link) return null;

    const linkObjId = new Types.ObjectId(linkId);
    const matchStage = { $match: { linkId: linkObjId } };

    // Run all independent aggregations in parallel for performance
    const [
      clicks,
      devices,
      actions,
      uniqueIps,
      conversions,
      deferredStats,
      installsByOS,
      topCountries,
      topBrowsers,
      topReferrers,
      channels,
      clicksTrend,
      topDeepLinks,
      topRefParams,
      topUtmSources,
      topUtmMediums,
      topUtmCampaigns,
      customParams,
      latestClicks,
    ] = await Promise.all([
      // OS breakdown
      ClickModel.aggregate([
        matchStage,
        { $group: { _id: '$device.os', count: { $sum: 1 } } },
      ]),

      // Device type breakdown
      ClickModel.aggregate([
        matchStage,
        { $group: { _id: '$device.type', count: { $sum: 1 } } },
      ]),

      // Action breakdown (app_opened / store_redirect / web_fallback)
      ClickModel.aggregate([
        matchStage,
        { $group: { _id: '$actionTaken', count: { $sum: 1 } } },
      ]),

      // Unique clicks by device (IP + UserAgent combo = unique device)
      ClickModel.aggregate([
        matchStage,
        { $group: { _id: { ip: '$ipAddress', ua: '$userAgent' } } },
        { $count: 'unique' },
      ]),

      // Conversion data — only deferred-match installs
      ConversionModel.aggregate([
        { $match: { linkId: linkObjId, deferredLinkId: { $exists: true, $ne: null } } },
        { $group: { _id: '$conversionType', count: { $sum: 1 } } },
      ]),

      // Deferred match stats
      DeferredLinkModel.aggregate([
        { $match: { linkId: linkObjId, status: { $in: ['matched', 'confirmed'] } } },
        { $count: 'matched' },
      ]),

      // Installs by OS — from ConversionModel via DeferredLink → Fingerprint → Click chain.
      // Traces: Conversion.deferredLinkId → DeferredLink.fingerprintId → Fingerprint.clickId → Click.device.os
      ConversionModel.aggregate([
        { $match: { linkId: linkObjId, deferredLinkId: { $exists: true, $ne: null } } },
        { $lookup: { from: 'deferredlinks', localField: 'deferredLinkId', foreignField: '_id', as: 'dl' } },
        { $unwind: { path: '$dl', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'fingerprints', localField: 'dl.fingerprintId', foreignField: '_id', as: 'fp' } },
        { $unwind: { path: '$fp', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'clicks', localField: 'fp.clickId', foreignField: '_id', as: 'click' } },
        { $unwind: { path: '$click', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$click.device.os', count: { $sum: 1 } } },
      ]),

      // Top countries
      ClickModel.aggregate([
        matchStage,
        { $group: { _id: '$geo.country', clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 } },
        { $limit: 10 },
      ]),

      // Top browsers
      ClickModel.aggregate([
        matchStage,
        { $group: { _id: '$device.browser', clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 } },
        { $limit: 5 },
      ]),

      // Top referrers
      ClickModel.aggregate([
        { $match: { linkId: linkObjId, referer: { $nin: [null, ''] } } },
        { $group: { _id: '$referer', clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 } },
        { $limit: 10 },
      ]),

      // Channel breakdown
      ClickModel.aggregate([
        matchStage,
        { $group: { _id: '$channel', clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 } },
      ]),

      // Clicks trend — last 30 days grouped by date
      ClickModel.aggregate([
        {
          $match: {
            linkId: linkObjId,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            clicks: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Top deepLink URLs from metadata (clicks + app opens + installs in one pass)
      // installs = store_redirect + isAppInstalled (user went to store, installed, opened app)
      // app_opened = direct app open (app was already installed)
      ClickModel.aggregate([
        { $match: { linkId: linkObjId, 'metadata.deepLink': { $exists: true, $ne: null } } },
        { $group: {
          _id: '$metadata.deepLink',
          clicks: { $sum: 1 },
          appOpened: { $sum: { $cond: [{ $eq: ['$actionTaken', 'app_opened'] }, 1, 0] } },
          installs: { $sum: { $cond: [{ $and: [{ $eq: ['$actionTaken', 'store_redirect'] }, { $eq: ['$isAppInstalled', true] }] }, 1, 0] } },
        } },
        { $sort: { clicks: -1 } },
        { $limit: 20 },
      ]),

      // Top ref params from metadata
      ClickModel.aggregate([
        { $match: { linkId: linkObjId, 'metadata.ref': { $exists: true, $ne: null } } },
        { $group: {
          _id: '$metadata.ref',
          clicks: { $sum: 1 },
          appOpened: { $sum: { $cond: [{ $eq: ['$actionTaken', 'app_opened'] }, 1, 0] } },
          installs: { $sum: { $cond: [{ $and: [{ $eq: ['$actionTaken', 'store_redirect'] }, { $eq: ['$isAppInstalled', true] }] }, 1, 0] } },
        } },
        { $sort: { clicks: -1 } },
        { $limit: 15 },
      ]),

      // Top UTM sources from metadata
      ClickModel.aggregate([
        { $match: { linkId: linkObjId, 'metadata.utmSource': { $exists: true, $ne: null } } },
        { $group: {
          _id: '$metadata.utmSource',
          clicks: { $sum: 1 },
          appOpened: { $sum: { $cond: [{ $eq: ['$actionTaken', 'app_opened'] }, 1, 0] } },
          installs: { $sum: { $cond: [{ $and: [{ $eq: ['$actionTaken', 'store_redirect'] }, { $eq: ['$isAppInstalled', true] }] }, 1, 0] } },
        } },
        { $sort: { clicks: -1 } },
        { $limit: 10 },
      ]),

      // Top UTM mediums from metadata
      ClickModel.aggregate([
        { $match: { linkId: linkObjId, 'metadata.utmMedium': { $exists: true, $ne: null } } },
        { $group: {
          _id: '$metadata.utmMedium',
          clicks: { $sum: 1 },
          appOpened: { $sum: { $cond: [{ $eq: ['$actionTaken', 'app_opened'] }, 1, 0] } },
          installs: { $sum: { $cond: [{ $and: [{ $eq: ['$actionTaken', 'store_redirect'] }, { $eq: ['$isAppInstalled', true] }] }, 1, 0] } },
        } },
        { $sort: { clicks: -1 } },
        { $limit: 10 },
      ]),

      // Top UTM campaigns from metadata
      ClickModel.aggregate([
        { $match: { linkId: linkObjId, 'metadata.utmCampaign': { $exists: true, $ne: null } } },
        { $group: {
          _id: '$metadata.utmCampaign',
          clicks: { $sum: 1 },
          appOpened: { $sum: { $cond: [{ $eq: ['$actionTaken', 'app_opened'] }, 1, 0] } },
          installs: { $sum: { $cond: [{ $and: [{ $eq: ['$actionTaken', 'store_redirect'] }, { $eq: ['$isAppInstalled', true] }] }, 1, 0] } },
        } },
        { $sort: { clicks: -1 } },
        { $limit: 10 },
      ]),

      // Custom params — flatten metadata.custom object keys and count values
      ClickModel.aggregate([
        { $match: { linkId: linkObjId, 'metadata.custom': { $exists: true, $type: 'object' } } },
        { $project: { customEntries: { $objectToArray: '$metadata.custom' }, actionTaken: 1, isAppInstalled: 1 } },
        { $unwind: '$customEntries' },
        {
          $group: {
            _id: { key: '$customEntries.k', value: '$customEntries.v' },
            clicks: { $sum: 1 },
            appOpened: { $sum: { $cond: [{ $eq: ['$actionTaken', 'app_opened'] }, 1, 0] } },
            installs: { $sum: { $cond: [{ $and: [{ $eq: ['$actionTaken', 'store_redirect'] }, { $eq: ['$isAppInstalled', true] }] }, 1, 0] } },
          },
        },
        { $sort: { clicks: -1 } },
        { $limit: 30 },
      ]),

      // Latest click
      ClickModel.findOne(
        { linkId: linkObjId },
        { createdAt: 1 },
        { sort: { createdAt: -1 } }
      ).lean(),
    ]);

    const totalConversions = conversions.reduce((sum: number, c: any) => sum + c.count, 0);
    const totalClicks = link.clickCount || 0;
    const deferredMatches = deferredStats[0]?.matched || 0;

    // Installs = ConversionModel deferred-link conversions (same source as conversions.total)
    const totalInstalls = installsByOS.reduce((sum: number, i: any) => sum + i.count, 0);

    // With the fixed resolve API (conditional $cond update), store_redirect
    // actionTaken is preserved for genuine store visits. No correction needed.
    const storeRedirectCount = actions.find((a: any) => a._id === 'store_redirect')?.count || 0;
    const appOpenedCount = actions.find((a: any) => a._id === 'app_opened')?.count || 0;

    return {
      linkId,
      shortCode: link.shortCode,
      totalClicks,
      clicks: {
        unique: uniqueIps[0]?.unique || 0,
        web: clicks.find((c: any) => c._id === 'other')?.count || 0,
        android: clicks.find((c: any) => c._id === 'android')?.count || 0,
        ios: clicks.find((c: any) => c._id === 'ios')?.count || 0,
        other:
          clicks.find((c: any) => !['android', 'ios', 'other'].includes(c._id))
            ?.count || 0,
      },
      devices: {
        mobile: devices.find((d: any) => d._id === 'mobile')?.count || 0,
        tablet: devices.find((d: any) => d._id === 'tablet')?.count || 0,
        desktop: devices.find((d: any) => d._id === 'desktop')?.count || 0,
      },
      // Installs broken down by OS (android / ios)
      installs: {
        total: totalInstalls,
        android: installsByOS.find((i: any) => i._id === 'android')?.count || 0,
        ios: installsByOS.find((i: any) => i._id === 'ios')?.count || 0,
      },
      actions: {
        appOpened: appOpenedCount,
        appInstalled: actions.find((a: any) => a._id === 'app_installed')?.count || 0,
        storeRedirect: storeRedirectCount,
        webFallback: actions.find((a: any) => a._id === 'web_fallback')?.count || 0,
      },
      conversions: {
        total: totalConversions,
        appOpen: conversions.find((c: any) => c._id === 'app_open')?.count || 0,
        registration:
          conversions.find((c: any) => c._id === 'registration')?.count || 0,
        purchase:
          conversions.find((c: any) => c._id === 'ticket_purchase')?.count || 0,
        view: conversions.find((c: any) => c._id === 'event_view')?.count || 0,
      },
      deferredMatches,
      deferredMatchRate: totalClicks > 0 ? (deferredMatches / totalClicks) * 100 : 0,
      channels: channels.map((c: any) => ({
        channel: c._id || 'direct',
        clicks: c.clicks,
      })),
      topCountries: topCountries.map((c: any) => ({
        country: c._id || 'Unknown',
        clicks: c.clicks,
      })),
      topBrowsers: topBrowsers.map((b: any) => ({
        browser: b._id || 'Unknown',
        clicks: b.clicks,
      })),
      topReferrers: topReferrers.map((r: any) => ({
        referrer: r._id || 'Unknown',
        clicks: r.clicks,
      })),
      topDeepLinks: topDeepLinks.map((d: any) => ({
        url: d._id || 'Unknown',
        clicks: d.clicks,
        appOpened: d.appOpened || 0,
        installs: d.installs || 0,
      })),
      topRefParams: topRefParams.map((r: any) => ({
        ref: r._id || 'Unknown',
        clicks: r.clicks,
        appOpened: r.appOpened || 0,
        installs: r.installs || 0,
      })),
      topUtmSources: topUtmSources.map((s: any) => ({
        source: s._id || 'Unknown',
        clicks: s.clicks,
        appOpened: s.appOpened || 0,
        installs: s.installs || 0,
      })),
      topUtmMediums: topUtmMediums.map((m: any) => ({
        medium: m._id || 'Unknown',
        clicks: m.clicks,
        appOpened: m.appOpened || 0,
        installs: m.installs || 0,
      })),
      topUtmCampaigns: topUtmCampaigns.map((c: any) => ({
        campaign: c._id || 'Unknown',
        clicks: c.clicks,
        appOpened: c.appOpened || 0,
        installs: c.installs || 0,
      })),
      customParams: customParams.map((p: any) => ({
        key: p._id?.key || 'unknown',
        value: String(p._id?.value || ''),
        clicks: p.clicks,
        appOpened: p.appOpened || 0,
        installs: p.installs || 0,
      })),
      clicksTrend: clicksTrend.map((t: any) => ({
        date: t._id,
        clicks: t.clicks,
      })),
      createdAt: (link as any).createdAt,
      lastClicked: latestClicks?.createdAt || (link as any).createdAt,
    };
  }

  /**
   * Get analytics for a specific campaign
   */
  static async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics | null> {
    const campaign = await CampaignModel.findById(campaignId).lean();
    if (!campaign) return null;

    // Get links in campaign
    const links = await LinkModel.find({
      campaignId: new Types.ObjectId(campaignId),
    }).lean();

    const linkIds = links.map((l) => new Types.ObjectId(l._id));

    // Get total clicks
    const clickStats = await ClickModel.aggregate([
      { $match: { linkId: { $in: linkIds } } },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: 1 },
        },
      },
    ]);

    // Get conversions — only deferred-match installs
    const conversionStats = await ConversionModel.aggregate([
      { $match: { linkId: { $in: linkIds }, deferredLinkId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$linkId',
          conversions: { $sum: 1 },
        },
      },
    ]);

    // Get by link type
    const byLinkType = await LinkModel.aggregate([
      { $match: { campaignId: new Types.ObjectId(campaignId) } },
      {
        $lookup: {
          from: 'clicks',
          localField: '_id',
          foreignField: 'linkId',
          as: 'clicks',
        },
      },
      {
        $group: {
          _id: '$linkType',
          clicks: { $sum: { $size: '$clicks' } },
          conversions: { $sum: 1 },
        },
      },
    ]);

    // Get top links
    const topLinks = await LinkModel.aggregate([
      { $match: { campaignId: new Types.ObjectId(campaignId) } },
      {
        $lookup: {
          from: 'clicks',
          localField: '_id',
          foreignField: 'linkId',
          as: 'clicks',
        },
      },
      {
        $lookup: {
          from: 'conversions',
          let: { lid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$linkId', '$$lid'] }, deferredLinkId: { $exists: true, $ne: null } } },
          ],
          as: 'conversions',
        },
      },
      {
        $project: {
          shortCode: 1,
          clicks: { $size: '$clicks' },
          conversions: { $size: '$conversions' },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 10 },
    ]);

    // Get top referrers for campaign
    const topReferrers = await ClickModel.aggregate([
      { $match: { linkId: { $in: linkIds }, referer: { $nin: [null, ''] } } },
      {
        $group: {
          _id: '$referer',
          clicks: { $sum: 1 },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 10 },
    ]);

    const totalClicks = clickStats[0]?.totalClicks || 0;
    const totalConversions = conversionStats.reduce((sum, s) => sum + s.conversions, 0);

    return {
      campaignId,
      campaignName: campaign.name,
      totalLinks: links.length,
      totalClicks,
      totalConversions,
      conversionRate:
        totalClicks > 0
          ? Math.min((totalConversions / totalClicks) * 100, 100)
          : 0,
      deferredMatchRate: 0,
      byLinkType: byLinkType.reduce(
        (acc, item) => {
          acc[item._id] = { clicks: item.clicks, conversions: item.conversions };
          return acc;
        },
        {} as Record<string, { clicks: number; conversions: number }>
      ),
      topLinks: topLinks.map((l) => ({
        shortCode: l.shortCode,
        clicks: l.clicks,
        conversions: l.conversions,
      })),
      topReferrers: topReferrers.map((r) => ({
        referrer: r._id || 'Unknown',
        clicks: r.clicks,
      })),
    };
  }

  /**
   * Get dashboard overview for a tenant with optional filters
   */
  static async getDashboardOverview(
    tenantId: string,
    filters?: { appId?: string; channel?: string; startDate?: Date; endDate?: Date }
  ): Promise<DashboardOverview> {
    const tenantObjId = new Types.ObjectId(tenantId);

    // Build base match filters for clicks
    const clickMatch: Record<string, any> = { tenantId: tenantObjId };
    if (filters?.channel) {
      clickMatch.channel = filters.channel;
    }
    if (filters?.startDate || filters?.endDate) {
      const dateCond: Record<string, any> = {};
      if (filters?.startDate) dateCond.$gte = filters.startDate;
      if (filters?.endDate) dateCond.$lte = filters.endDate;
      clickMatch.createdAt = dateCond;
    }

    // Build link match filter (for appId filtering)
    const linkMatch: Record<string, any> = { tenantId: tenantObjId };
    if (filters?.appId) {
      linkMatch.appId = new Types.ObjectId(filters.appId);
    }

    // If appId filter, get linkIds belonging to that app first
    let filteredLinkIds: Types.ObjectId[] | null = null;
    if (filters?.appId) {
      const appLinks = await LinkModel.find(linkMatch, { _id: 1 }).lean();
      filteredLinkIds = appLinks.map((l) => new Types.ObjectId(l._id));
      clickMatch.linkId = { $in: filteredLinkIds };
    }

    // Total clicks
    const clickCount = await ClickModel.countDocuments(clickMatch);

    // Installs (store redirects) and opens (app already installed, deep link opened)
    const installCount = await ClickModel.countDocuments({ ...clickMatch, actionTaken: 'store_redirect' });
    const openCount = await ClickModel.countDocuments({ ...clickMatch, actionTaken: 'app_opened' });

    // Total conversions — only count deferred-match installs (real attributions)
    const conversionMatch: Record<string, any> = {
      tenantId: tenantObjId,
      deferredLinkId: { $exists: true, $ne: null },
    };
    if (filteredLinkIds) {
      conversionMatch.linkId = { $in: filteredLinkIds };
    }
    const conversionCount = await ConversionModel.countDocuments(conversionMatch);

    // Total links
    const linkCountMatch: Record<string, any> = { ...linkMatch, isActive: { $ne: false } };
    const linkCount = await LinkModel.countDocuments(linkCountMatch);

    // Active campaigns
    const campaignMatch: Record<string, any> = { tenantId: tenantObjId, status: 'active' };
    if (filters?.appId) {
      campaignMatch.appId = new Types.ObjectId(filters.appId);
    }
    const campaignCount = await CampaignModel.countDocuments(campaignMatch);

    // Deferred links matched
    const deferredMatch: Record<string, any> = { tenantId: tenantObjId, status: 'matched' };
    if (filteredLinkIds) {
      deferredMatch.linkId = { $in: filteredLinkIds };
    }
    const deferredMatched = await DeferredLinkModel.countDocuments(deferredMatch);

    // Top links by clicks with destination and campaign name
    const topLinksPipeline: any[] = [
      { $match: linkCountMatch },
      { $sort: { clickCount: -1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: 'conversions',
          let: { lid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$linkId', '$$lid'] }, deferredLinkId: { $exists: true, $ne: null } } },
          ],
          as: 'conversions',
        },
      },
      {
        $lookup: {
          from: 'campaigns',
          localField: 'campaignId',
          foreignField: '_id',
          as: 'campaign',
        },
      },
      {
        $project: {
          title: 1,
          shortCode: 1,
          destinationUrl: 1,
          clicks: '$clickCount',
          conversions: { $size: '$conversions' },
          campaignName: { $arrayElemAt: ['$campaign.name', 0] },
        },
      },
    ];
    const topLinks = await LinkModel.aggregate(topLinksPipeline);

    // Top campaigns with full details
    const topCampaignMatchStage: Record<string, any> = { tenantId: tenantObjId };
    if (filters?.appId) {
      topCampaignMatchStage.appId = new Types.ObjectId(filters.appId);
    }
    const topCampaignsPipeline: any[] = [
      { $match: topCampaignMatchStage },
      {
        $lookup: {
          from: 'links',
          let: { campaignId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$campaignId', '$$campaignId'] },
                    ...(filters?.appId
                      ? [{ $eq: ['$appId', new Types.ObjectId(filters.appId)] }]
                      : []),
                  ],
                },
              },
            },
          ],
          as: 'links',
        },
      },
      {
        $addFields: {
          linkCount: { $size: '$links' },
          totalClicks: { $sum: '$links.clickCount' },
        },
      },
      {
        $lookup: {
          from: 'conversions',
          let: { linkIds: '$links._id' },
          pipeline: [
            { $match: { $expr: { $in: ['$linkId', '$$linkIds'] }, deferredLinkId: { $exists: true, $ne: null } } },
          ],
          as: 'allConversions',
        },
      },
      {
        $project: {
          name: 1,
          status: 1,
          linkCount: 1,
          clicks: '$totalClicks',
          conversions: { $size: '$allConversions' },
          metadata: 1,
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 6 },
    ];
    const topCampaigns = await CampaignModel.aggregate(topCampaignsPipeline);

    // Clicks trend — use the provided date range, or fall back to last 30 days
    const trendStart = filters?.startDate || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
    const trendEnd = filters?.endDate || new Date();
    const trendClickMatch = filters?.startDate || filters?.endDate
      ? { ...clickMatch }
      : { ...clickMatch, createdAt: { $gte: trendStart, $lte: trendEnd } };
    const clicksTrend = await ClickModel.aggregate([
      { $match: trendClickMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          clicks: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Conversions trend for the same period
    const convTrendMatch: Record<string, any> = {
      tenantId: tenantObjId,
      ...(filters?.startDate || filters?.endDate
        ? { createdAt: clickMatch.createdAt }
        : { createdAt: { $gte: trendStart, $lte: trendEnd } }),
    };
    if (filteredLinkIds) {
      convTrendMatch.linkId = { $in: filteredLinkIds };
    }
    // Only count deferred-match installs in trend
    convTrendMatch.deferredLinkId = { $exists: true, $ne: null };
    const conversionsTrend = await ConversionModel.aggregate([
      { $match: convTrendMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          conversions: { $sum: 1 },
        },
      },
    ]);
    const convTrendMap = new Map(conversionsTrend.map((c) => [c._id, c.conversions]));

    // Opens trend — clicks where the app was already installed and opened
    const opensTrend = await ClickModel.aggregate([
      { $match: { ...trendClickMatch, actionTaken: 'app_opened' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          opens: { $sum: 1 },
        },
      },
    ]);
    const opensTrendMap = new Map(opensTrend.map((o) => [o._id, o.opens]));

    // Top referrers
    const topReferrers = await ClickModel.aggregate([
      { $match: { ...clickMatch, referer: { $nin: [null, ''] } } },
      {
        $group: {
          _id: '$referer',
          clicks: { $sum: 1 },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 10 },
    ]);

    const totalReferrerClicks = topReferrers.reduce((sum, r) => sum + r.clicks, 0);

    // Channel breakdown — normalize null / "" / whitespace to "direct" before grouping
    const channelBreakdown = await ClickModel.aggregate([
      { $match: clickMatch },
      {
        $group: {
          _id: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$channel', null] },
                  { $eq: ['$channel', ''] },
                  { $not: ['$channel'] },
                ],
              },
              then: 'direct',
              else: { $toLower: '$channel' },
            },
          },
          clicks: { $sum: 1 },
        },
      },
      { $sort: { clicks: -1 } },
    ]);

    const totalChannelClicks = channelBreakdown.reduce((sum, c) => sum + c.clicks, 0);

    // Platform breakdown (OS)
    const platformBreakdown = await ClickModel.aggregate([
      { $match: clickMatch },
      {
        $group: {
          _id: '$device.os',
          count: { $sum: 1 },
        },
      },
    ]);

    const android = platformBreakdown.find((p) => p._id === 'android')?.count || 0;
    const ios = platformBreakdown.find((p) => p._id === 'ios')?.count || 0;
    const webClicks = platformBreakdown
      .filter((p) => !['android', 'ios'].includes(p._id))
      .reduce((sum, p) => sum + p.count, 0);

    // Recent clicks (last 20) for live stream
    const recentClicks = await ClickModel.aggregate([
      { $match: clickMatch },
      { $sort: { createdAt: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'links',
          localField: 'linkId',
          foreignField: '_id',
          as: 'link',
        },
      },
      {
        $lookup: {
          from: 'campaigns',
          localField: 'link.campaignId',
          foreignField: '_id',
          as: 'campaign',
        },
      },
      {
        $project: {
          time: { $dateToString: { format: '%Y-%m-%dT%H:%M:%S.%LZ', date: '$createdAt' } },
          platform: '$device.os',
          campaign: { $ifNull: [{ $arrayElemAt: ['$campaign.name', 0] }, 'direct'] },
          action: '$actionTaken',
          channel: { $ifNull: ['$channel', 'direct'] },
        },
      },
    ]);

    // ── SDK Install metrics (from Install collection) ──
    const installMatch: Record<string, any> = { tenantId: tenantObjId };
    const installTrendDateFilter = filters?.startDate || filters?.endDate
      ? clickMatch.createdAt
      : { $gte: trendStart, $lte: trendEnd };

    const [newInstallCount, totalDeviceCount, installsTrend, appLaunchesTrend] = await Promise.all([
      // New installs: genuine first app launches
      InstallModel.countDocuments({ ...installMatch, installType: 'first_install' }),
      // Total devices: all unique devices tracked by SDK
      InstallModel.countDocuments(installMatch),
      // Install trend — first_install records by day for the same time window
      InstallModel.aggregate([
        {
          $match: {
            ...installMatch,
            installType: 'first_install',
            createdAt: installTrendDateFilter,
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            installs: { $sum: 1 },
          },
        },
      ]),
      // App launches trend — ALL install types (every device that launched) by day
      InstallModel.aggregate([
        {
          $match: {
            ...installMatch,
            createdAt: installTrendDateFilter,
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            launches: { $sum: 1 },
          },
        },
      ]),
    ]);
    const installsTrendMap = new Map(installsTrend.map((i: any) => [i._id, i.installs]));
    const appLaunchesTrendMap = new Map(appLaunchesTrend.map((a: any) => [a._id, a.launches]));

    return {
      totalClicks: clickCount,
      totalInstalls: installCount,
      totalOpens: openCount,
      totalConversions: conversionCount,
      conversionRate: clickCount > 0 ? Math.min((conversionCount / clickCount) * 100, 100) : 0,
      installRate: clickCount > 0 ? Math.min((installCount / clickCount) * 100, 100) : 0,
      totalLinks: linkCount,
      activeCampaigns: campaignCount,
      deferredLinksMatched: deferredMatched,
      newInstalls: newInstallCount,
      totalDevices: totalDeviceCount,
      totalAppLaunches: totalDeviceCount,
      topLinks: topLinks.map((l) => ({
        linkId: l._id.toString(),
        title: l.title || undefined,
        shortCode: l.shortCode,
        destinationUrl: l.destinationUrl,
        campaignName: l.campaignName || undefined,
        clicks: l.clicks,
        conversions: l.conversions,
      })),
      topReferrers: topReferrers.map((r) => ({
        referrer: r._id || 'Unknown',
        clicks: r.clicks,
        percentage: totalReferrerClicks > 0 ? Math.round((r.clicks / totalReferrerClicks) * 1000) / 10 : 0,
      })),
      topCampaigns: topCampaigns.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        status: c.status,
        channels: (c.metadata?.channels as string) || '',
        linkCount: c.linkCount,
        clicks: c.clicks,
        conversions: c.conversions,
        conversionRate: c.clicks > 0 ? Math.min((c.conversions / c.clicks) * 100, 100) : 0,
      })),
      clicksTrend: clicksTrend.map((ct) => ({
        date: ct._id,
        clicks: ct.clicks,
        conversions: convTrendMap.get(ct._id) || 0,
        opens: opensTrendMap.get(ct._id) || 0,
        installs: installsTrendMap.get(ct._id) || 0,
        appLaunches: appLaunchesTrendMap.get(ct._id) || 0,
      })),
      channelBreakdown: channelBreakdown.map((cb) => ({
        channel: cb._id,
        clicks: cb.clicks,
        percentage: totalChannelClicks > 0 ? Math.round((cb.clicks / totalChannelClicks) * 1000) / 10 : 0,
      })),
      platformBreakdown: { android, ios, web: webClicks },
      recentClicks: recentClicks.map((rc) => ({
        time: rc.time,
        platform: rc.platform,
        campaign: rc.campaign,
        action: rc.action,
        channel: rc.channel,
      })),
    };
  }
}

export default AnalyticsService;
