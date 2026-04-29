import { Logger } from '@/lib/logger';
import CampaignModel from '@/lib/models/Campaign';
import { ICampaign, CreateCampaignDto, UpdateCampaignDto } from '@/types';
import { Types } from 'mongoose';

const logger = Logger.child({ service: 'CampaignService' });

export class CampaignService {
  /**
   * Create a new campaign
   */
  static async createCampaign(
    tenantId: string,
    dto: CreateCampaignDto
  ): Promise<ICampaign> {
    const campaign = new CampaignModel({
      tenantId,
      appId: dto.appId ? new Types.ObjectId(dto.appId) : undefined,
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      status: 'active',
      fallbackUrl: dto.fallbackUrl,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      metadata: dto.metadata || {},
    });

    await campaign.save();
    logger.info(
      {
        campaignId: campaign._id,
        tenantId,
        slug: campaign.slug,
      },
      'Campaign created'
    );

    return campaign;
  }

  /**
   * Get campaign by ID
   */
  static async getCampaign(campaignId: string): Promise<ICampaign | null> {
    return CampaignModel.findById(campaignId);
  }

  /**
   * Get campaign by slug (within tenant)
   */
  static async getCampaignBySlug(
    tenantId: string,
    slug: string
  ): Promise<ICampaign | null> {
    return CampaignModel.findOne({
      tenantId,
      slug,
    });
  }

  /**
   * List campaigns for a tenant
   */
  static async listCampaigns(
    tenantId: string,
    options?: {
      status?: 'active' | 'paused' | 'archived';
      appId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ campaigns: ICampaign[]; total: number }> {
    const query: Record<string, any> = { tenantId };

    if (options?.status) {
      query.status = options.status;
    }

    if (options?.appId) {
      query.appId = new Types.ObjectId(options.appId);
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const [campaigns, total] = await Promise.all([
      CampaignModel.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset),
      CampaignModel.countDocuments(query),
    ]);

    return { campaigns, total };
  }

  /**
   * Update a campaign
   */
  static async updateCampaign(
    campaignId: string,
    dto: UpdateCampaignDto
  ): Promise<ICampaign | null> {
    const updateData: Record<string, any> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.appId !== undefined) updateData.appId = dto.appId ? new Types.ObjectId(dto.appId) : null;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.fallbackUrl !== undefined) updateData.fallbackUrl = dto.fallbackUrl;
    if (dto.startDate !== undefined) {
      updateData.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.endDate !== undefined) {
      updateData.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata;

    const campaign = await CampaignModel.findByIdAndUpdate(
      campaignId,
      updateData,
      { new: true }
    );

    if (campaign) {
      logger.info({ campaignId }, 'Campaign updated');
    }

    return campaign;
  }

  /**
   * Delete a campaign
   */
  static async deleteCampaign(campaignId: string): Promise<boolean> {
    const result = await CampaignModel.findByIdAndDelete(campaignId);
    if (result) {
      logger.info({ campaignId }, 'Campaign deleted');
      return true;
    }
    return false;
  }

  /**
   * Pause a campaign
   */
  static async pauseCampaign(campaignId: string): Promise<ICampaign | null> {
    return CampaignModel.findByIdAndUpdate(
      campaignId,
      { status: 'paused' },
      { new: true }
    );
  }

  /**
   * Archive a campaign
   */
  static async archiveCampaign(campaignId: string): Promise<ICampaign | null> {
    return CampaignModel.findByIdAndUpdate(
      campaignId,
      { status: 'archived' },
      { new: true }
    );
  }
}

export default CampaignService;
