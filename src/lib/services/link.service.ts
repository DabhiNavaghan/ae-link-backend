import { Logger } from '@/lib/logger';
import LinkModel from '@/lib/models/Link';
import { ILink, CreateLinkDto, UpdateLinkDto } from '@/types';
import { generateShortCode, isValidShortCode } from '@/utils/short-code';
import { Types } from 'mongoose';

const logger = Logger.child({ service: 'LinkService' });

export class LinkService {
  /**
   * Create a new link
   */
  static async createLink(
    tenantId: string,
    dto: CreateLinkDto
  ): Promise<ILink> {
    // Generate or validate short code
    let shortCode = dto.shortCode;
    if (!shortCode) {
      shortCode = await this.generateUniqueShortCode();
    } else if (!isValidShortCode(shortCode)) {
      throw new Error('Invalid short code format');
    } else {
      // Check if custom short code is available
      const existing = await LinkModel.findOne({ shortCode });
      if (existing) {
        throw new Error(`Short code "${shortCode}" already in use`);
      }
    }

    const link = new LinkModel({
      tenantId,
      campaignId: dto.campaignId ? new Types.ObjectId(dto.campaignId) : undefined,
      shortCode,
      destinationUrl: dto.destinationUrl,
      linkType: dto.linkType,
      params: dto.params || {},
      platformOverrides: dto.platformOverrides || {},
      isActive: true,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    await link.save();
    logger.info(
      {
        linkId: link._id,
        shortCode,
        tenantId,
      },
      'Link created'
    );

    return link;
  }

  /**
   * Get link by short code
   */
  static async getLinkByShortCode(
    shortCode: string
  ): Promise<ILink | null> {
    const link = await LinkModel.findOne({
      shortCode,
      isActive: true,
    });

    if (link && link.expiresAt && link.expiresAt < new Date()) {
      logger.debug({ shortCode }, 'Link has expired');
      return null;
    }

    return link;
  }

  /**
   * Get link by ID
   */
  static async getLink(linkId: string): Promise<ILink | null> {
    return LinkModel.findById(linkId);
  }

  /**
   * List links for a tenant
   */
  static async listLinks(
    tenantId: string,
    options?: {
      campaignId?: string;
      status?: 'active' | 'inactive' | 'expired';
      limit?: number;
      offset?: number;
    }
  ): Promise<{ links: ILink[]; total: number }> {
    const query: Record<string, any> = { tenantId };

    if (options?.campaignId) {
      query.campaignId = new Types.ObjectId(options.campaignId);
    }

    if (options?.status === 'active') {
      query.isActive = true;
      query.expiresAt = { $exists: false };
    } else if (options?.status === 'inactive') {
      query.isActive = false;
    } else if (options?.status === 'expired') {
      query.expiresAt = { $lt: new Date() };
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const [links, total] = await Promise.all([
      LinkModel.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset),
      LinkModel.countDocuments(query),
    ]);

    return { links, total };
  }

  /**
   * Update a link
   */
  static async updateLink(
    linkId: string,
    dto: UpdateLinkDto
  ): Promise<ILink | null> {
    const updateData: Record<string, any> = {};

    if (dto.destinationUrl !== undefined) {
      updateData.destinationUrl = dto.destinationUrl;
    }
    if (dto.params !== undefined) {
      updateData.params = dto.params;
    }
    if (dto.platformOverrides !== undefined) {
      updateData.platformOverrides = dto.platformOverrides;
    }
    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }
    if (dto.expiresAt !== undefined) {
      updateData.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    const link = await LinkModel.findByIdAndUpdate(
      linkId,
      updateData,
      { new: true }
    );

    if (link) {
      logger.info({ linkId }, 'Link updated');
    }

    return link;
  }

  /**
   * Delete a link
   */
  static async deleteLink(linkId: string): Promise<boolean> {
    const result = await LinkModel.findByIdAndDelete(linkId);
    if (result) {
      logger.info({ linkId }, 'Link deleted');
      return true;
    }
    return false;
  }

  /**
   * Increment click count
   */
  static async incrementClickCount(linkId: string): Promise<void> {
    await LinkModel.updateOne(
      { _id: linkId },
      { $inc: { clickCount: 1 } }
    );
  }

  /**
   * Generate a unique short code
   */
  private static async generateUniqueShortCode(
    attempts = 0
  ): Promise<string> {
    if (attempts > 10) {
      throw new Error('Failed to generate unique short code after 10 attempts');
    }

    const shortCode = generateShortCode(7);
    const existing = await LinkModel.findOne({ shortCode });

    if (existing) {
      return this.generateUniqueShortCode(attempts + 1);
    }

    return shortCode;
  }
}

export default LinkService;
