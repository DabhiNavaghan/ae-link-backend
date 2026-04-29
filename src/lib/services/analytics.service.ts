import { Logger } from '@/lib/logger';
import ClickModel from '@/lib/models/Click';
import ConversionModel from '@/lib/models/Conversion';
import LinkModel from '@/lib/models/Link';
import CampaignModel from '@/lib/models/Campaign';
import DeferredLinkModel from '@/lib/models/DeferredLink';
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

    // Get click data
    const clicks = await ClickModel.aggregate([
      { $match: { linkId: new Types.ObjectId(linkId) } },
      {
        $group: {
          _id: '$device.os',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get device type breakdown
    const devices = await ClickModel.aggregate([
      { $match: { linkId: new Types.ObjectId(linkId) } },
      {
        $group: {
          _id: '$device.type',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get conversion data
    const conversions = await ConversionModel.aggregate([
      { $match: { linkId: new Types.ObjectId(linkId) } },
      {
        $group: {
          _id: '$conversionType',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get deferred match stats
    const deferredStats = await DeferredLinkModel.aggregate([
      {
        $match: {
          linkId: new Types.ObjectId(linkId),
          status: { $in: ['matched', 'confirmed'] },
        },
      },
      {
        $count: 'matched',
      },
    ]);

    // Get geo data
    const topCountries = await ClickModel.aggregate([
      { $match: { linkId: new Types.ObjectId(linkId) } },
      {
        $group: {
          _id: '$geo.country',
          clicks: { $sum: 1 },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 10 },
    ]);

    // Get browser data
    const topBrowsers = await ClickModel.aggregate([
      { $match: { linkId: new Types.ObjectId(linkId) } },
      {
        $group: {
          _id: '$device.browser',
          clicks: { $sum: 1 },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 5 },
    ]);

    // Get top referrers
    const topReferrers = await ClickModel.aggregate([
      { $match: { linkId: new Types.ObjectId(linkId), referer: { $nin: [null, ''] } } },
      {
        $group: {
          _id: '$referer',
          clicks: { $sum: 1 },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 10 },
    ]);

    // Get latest clicks
    const latestClicks = await ClickModel.findOne(
      { linkId: new Types.ObjectId(linkId) },
      { createdAt: 1 },
      { sort: { createdAt: -1 } }
    ).lean();

    const totalConversions = conversions.reduce((sum, c) => sum + c.count, 0);
    const totalClicks = link.clickCount || 0;
    const deferredMatches = deferredStats[0]?.matched || 0;

    return {
      linkId,
      shortCode: link.shortCode,
      totalClicks,
      clicks: {
        web: clicks.find((c) => c._id === 'other')?.count || 0,
        android: clicks.find((c) => c._id === 'android')?.count || 0,
        ios: clicks.find((c) => c._id === 'ios')?.count || 0,
        other:
          clicks.find((c) => !['android', 'ios', 'other'].includes(c._id))
            ?.count || 0,
      },
      devices: {
        mobile: devices.find((d) => d._id === 'mobile')?.count || 0,
        tablet: devices.find((d) => d._id === 'tablet')?.count || 0,
        desktop: devices.find((d) => d._id === 'desktop')?.count || 0,
      },
      conversions: {
        total: totalConversions,
        appOpen: conversions.find((c) => c._id === 'app_open')?.count || 0,
        registration:
          conversions.find((c) => c._id === 'registration')?.count || 0,
        purchase:
          conversions.find((c) => c._id === 'ticket_purchase')?.count || 0,
        view: conversions.find((c) => c._id === 'event_view')?.count || 0,
      },
      deferredMatches,
      deferredMatchRate: totalClicks > 0 ? (deferredMatches / totalClicks) * 100 : 0,
      topCountries: topCountries.map((c) => ({
        country: c._id || 'Unknown',
        clicks: c.clicks,
      })),
      topBrowsers: topBrowsers.map((b) => ({
        browser: b._id || 'Unknown',
        clicks: b.clicks,
      })),
      topReferrers: topReferrers.map((r) => ({
        referrer: r._id || 'Unknown',
        clicks: r.clicks,
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

    // Get conversions
    const conversionStats = await ConversionModel.aggregate([
      { $match: { linkId: { $in: linkIds } } },
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
          localField: '_id',
          foreignField: 'linkId',
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
          ? (totalConversions / totalClicks) * 100
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
    filters?: { appId?: string; channel?: string }
  ): Promise<DashboardOverview> {
    const tenantObjId = new Types.ObjectId(tenantId);

    // Build base match filters for clicks
    const clickMatch: Record<string, any> = { tenantId: tenantObjId };
    if (filters?.channel) {
      clickMatch.channel = filters.channel;
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

    // Total conversions
    const conversionMatch: Record<string, any> = { tenantId: tenantObjId };
    if (filteredLinkIds) {
      conversionMatch.linkId = { $in: filteredLinkIds };
    }
    const conversionCount = await ConversionModel.countDocuments(conversionMatch);

    // Total links
    const linkCountMatch: Record<string, any> = { ...linkMatch, isActive: true };
    const linkCount = await LinkModel.countDocuments(linkCountMatch);

    // Active campaigns
    const campaignMatch: Record<string, any> = { tenantId: tenantObjId, status: 'active' };
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
          localField: '_id',
          foreignField: 'linkId',
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
    const topCampaignsPipeline: any[] = [
      { $match: { tenantId: tenantObjId } },
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
          localField: 'links._id',
          foreignField: 'linkId',
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

    // Clicks trend (last 30 days) with conversions
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trendClickMatch = { ...clickMatch, createdAt: { $gte: thirtyDaysAgo } };
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
      createdAt: { $gte: thirtyDaysAgo },
    };
    if (filteredLinkIds) {
      convTrendMatch.linkId = { $in: filteredLinkIds };
    }
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

    // Channel breakdown
    const channelBreakdown = await ClickModel.aggregate([
      { $match: clickMatch },
      {
        $group: {
          _id: '$channel',
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

    return {
      totalClicks: clickCount,
      totalConversions: conversionCount,
      conversionRate: clickCount > 0 ? (conversionCount / clickCount) * 100 : 0,
      totalLinks: linkCount,
      activeCampaigns: campaignCount,
      deferredLinksMatched: deferredMatched,
      topLinks: topLinks.map((l) => ({
        linkId: l._id.toString(),
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
        conversionRate: c.clicks > 0 ? (c.conversions / c.clicks) * 100 : 0,
      })),
      clicksTrend: clicksTrend.map((ct) => ({
        date: ct._id,
        clicks: ct.clicks,
        conversions: convTrendMap.get(ct._id) || 0,
      })),
      channelBreakdown: channelBreakdown.map((cb) => ({
        channel: cb._id || 'direct',
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
