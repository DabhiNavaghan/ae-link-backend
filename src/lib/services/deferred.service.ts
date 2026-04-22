import { Logger } from '@/lib/logger';
import DeferredLinkModel from '@/lib/models/DeferredLink';
import { IDeferredLink, ILinkParams, FingerprintData } from '@/types';
import FingerprintService from './fingerprint.service';
import { Types } from 'mongoose';

const logger = Logger.child({ service: 'DeferredService' });

export class DeferredService {
  /**
   * Create a deferred link for later matching
   */
  static async createDeferredLink(
    fingerprintId: string,
    linkId: string,
    tenantId: string,
    params: ILinkParams,
    destinationUrl: string,
    ttlHours: number = 72
  ): Promise<IDeferredLink> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    const deferredLink = new DeferredLinkModel({
      fingerprintId,
      linkId,
      tenantId,
      params,
      destinationUrl,
      status: 'pending',
      expiresAt,
      matchScore: 0,
      matchDetails: {},
    });

    await deferredLink.save();
    logger.debug(
      {
        deferredLinkId: deferredLink._id,
        linkId,
        fingerprintId,
      },
      'Deferred link created'
    );

    return deferredLink;
  }

  /**
   * Match a deferred link by finding matching fingerprints
   */
  static async matchDeferredLink(
    tenantId: string,
    incomingFingerprint: FingerprintData,
    matchThreshold: number = 70,
    linkId?: string
  ): Promise<IDeferredLink | null> {
    const { fingerprint, matchScore, matchDetails } =
      await FingerprintService.findMatchingFingerprint(
        tenantId,
        incomingFingerprint,
        matchThreshold,
        linkId
      );

    if (!fingerprint) {
      logger.debug(
        { tenantId, linkId },
        'No matching fingerprint found for deferred match'
      );
      return null;
    }

    // Find the deferred link associated with this fingerprint
    const deferredLink = await DeferredLinkModel.findOne({
      fingerprintId: fingerprint._id,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (!deferredLink) {
      logger.debug(
        { fingerprintId: fingerprint._id },
        'No pending deferred link for matched fingerprint'
      );
      return null;
    }

    // Update deferred link with match details
    deferredLink.status = 'matched';
    deferredLink.matchedAt = new Date();
    deferredLink.matchScore = matchScore;
    deferredLink.matchDetails = matchDetails;

    await deferredLink.save();

    // Mark the fingerprint as matched
    await FingerprintService.markAsMatched(fingerprint._id.toString());

    logger.info(
      {
        deferredLinkId: deferredLink._id,
        fingerprintId: fingerprint._id,
        matchScore,
      },
      'Deferred link matched'
    );

    return deferredLink;
  }

  /**
   * Confirm a matched deferred link (app received it)
   */
  static async confirmDeferredLink(
    deferredLinkId: string,
    deviceId: string
  ): Promise<IDeferredLink | null> {
    const deferredLink = await DeferredLinkModel.findByIdAndUpdate(
      deferredLinkId,
      {
        status: 'confirmed',
        confirmedAt: new Date(),
        deviceId,
      },
      { new: true }
    );

    if (deferredLink) {
      logger.info(
        { deferredLinkId, deviceId },
        'Deferred link confirmed'
      );
    }

    return deferredLink;
  }

  /**
   * Get a deferred link by ID
   */
  static async getDeferredLink(deferredLinkId: string): Promise<IDeferredLink | null> {
    return DeferredLinkModel.findById(deferredLinkId);
  }

  /**
   * Get all pending deferred links for a device
   */
  static async getPendingDeferredLinksForDevice(
    tenantId: string,
    deviceId: string
  ): Promise<IDeferredLink[]> {
    return DeferredLinkModel.find({
      tenantId,
      deviceId,
      status: { $in: ['pending', 'matched'] },
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });
  }

  /**
   * Mark deferred links as failed
   */
  static async markAsFailed(
    deferredLinkId: string,
    reason?: string
  ): Promise<IDeferredLink | null> {
    const deferredLink = await DeferredLinkModel.findByIdAndUpdate(
      deferredLinkId,
      {
        status: 'failed',
        matchDetails: {
          failureReason: reason || 'Unknown',
        },
      },
      { new: true }
    );

    if (deferredLink) {
      logger.warn(
        { deferredLinkId, reason },
        'Deferred link marked as failed'
      );
    }

    return deferredLink;
  }

  /**
   * Get deferred link statistics
   */
  static async getStats(tenantId: string): Promise<{
    total: number;
    pending: number;
    matched: number;
    confirmed: number;
    failed: number;
    expired: number;
  }> {
    const stats = await DeferredLinkModel.aggregate([
      { $match: { tenantId: new Types.ObjectId(tenantId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      total: 0,
      pending: 0,
      matched: 0,
      confirmed: 0,
      failed: 0,
      expired: 0,
    };

    for (const stat of stats) {
      result.total += stat.count;
      if (stat._id in result) {
        (result as any)[stat._id] = stat.count;
      }
    }

    return result;
  }
}

export default DeferredService;
