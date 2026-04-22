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
    };
  }

  /**
   * Get dashboard overview for a tenant
   */
  static async getDashboardOverview(tenantId: string): Promise<DashboardOverview> {
    // Total clicks
    const clickCount = await ClickModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
    });

    // Total conversions
    const conversionCount = await ConversionModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
    });

    // Total links
    const linkCount = await LinkModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
    });

    // Active campaigns
    const campaignCount = await CampaignModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
      status: 'active',
    });

    // Deferred links matched
    const deferredMatched = await DeferredLinkModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
      status: 'matched',
    });

    // Top links by clicks
    const topLinks = await LinkModel.aggregate([
      { $match: { tenantId: new Types.ObjectId(tenantId) } },
      { $sort: { clickCount: -1 } },
      { $limit: 5 },
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
          clicks: '$clickCount',
          conversions: { $size: '$conversions' },
        },
      },
    ]);

    // Top campaigns
    const topCampaigns = await CampaignModel.aggregate([
      { $match: { tenantId: new Types.ObjectId(tenantId) } },
      {
        $lookup: {
          from: 'links',
          localField: '_id',
          foreignField: 'campaignId',
          as: 'links',
        },
      },
      {
        $unwind: '$links',
      },
      {
        $group: {
          _id: {
            campaignId: '$_id',
            name: '$name',
          },
          clicks: { $sum: '$links.clickCount' },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 5 },
    ]);

    // Clicks trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const clicksTrend = await ClickModel.aggregate([
      {
        $match: {
          tenantId: new Types.ObjectId(tenantId),
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          clicks: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      totalClicks: clickCount,
      totalConversions: conversionCount,
      conversionRate:
        clickCount > 0 ? (conversionCount / clickCount) * 100 : 0,
      totalLinks: linkCount,
      activeCampaigns: campaignCount,
      deferredLinksMatched: deferredMatched,
      topLinks: topLinks.map((l) => ({
        shortCode: l.shortCode,
        clicks: l.clicks,
        conversions: l.conversions,
      })),
      topCampaigns: topCampaigns.map((c) => ({
        name: c._id.name,
        clicks: c.clicks,
        conversions: 0,
      })),
      clicksTrend: clicksTrend.map((ct) => ({
        date: ct._id,
        clicks: ct.clicks,
      })),
    };
  }
}

export default AnalyticsService;
