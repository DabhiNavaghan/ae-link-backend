import { Logger } from '@/lib/logger';
import DeferredLinkModel from '@/lib/models/DeferredLink';
import { IDeferredLink, ILinkParams, FingerprintData } from '@/types';
import FingerprintService, { ScoredCandidate } from './fingerprint.service';
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
    ttlHours: number = 6
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
   * Match a deferred link by finding matching fingerprints.
   *
   * Returns the winning DeferredLink plus the full ranked candidate list, so
   * the caller can persist exactly what was considered and why it lost.
   *
   * Candidates above the threshold are tried in descending confidence order
   * rather than only the single best one: a fingerprint whose DeferredLink was
   * never created (link lookup failed at click time) or was already consumed by
   * an earlier launch would otherwise abort the whole match even when the
   * runner-up would have matched cleanly.
   */
  static async matchDeferredLink(
    tenantId: string,
    incomingFingerprint: FingerprintData,
    matchThreshold: number = 68,
    linkId?: string
  ): Promise<{
    deferredLink: IDeferredLink | null;
    candidates: ScoredCandidate[];
    /** Index into `candidates` of the winner, or -1. */
    selectedIndex: number;
    reason: string;
  }> {
    const candidates = await FingerprintService.rankCandidates(
      tenantId,
      incomingFingerprint,
      linkId
    );

    if (!candidates.length) {
      logger.debug(
        { tenantId, linkId },
        'No candidate fingerprints for deferred match'
      );
      return { deferredLink: null, candidates, selectedIndex: -1, reason: 'no_candidates' };
    }

    const qualifying = candidates.filter((c) => c.confidence >= matchThreshold);

    if (!qualifying.length) {
      const best = candidates[0];
      const reason =
        best.details.rejectedReason === 'no_hard_evidence'
          ? 'no_hard_evidence'
          : best.details.platformMismatch
          ? 'platform_mismatch'
          : 'below_threshold';

      logger.debug(
        { tenantId, linkId, bestConfidence: best.confidence, matchThreshold, reason },
        'No candidate met the match threshold'
      );
      return { deferredLink: null, candidates, selectedIndex: -1, reason };
    }

    for (const candidate of qualifying) {
      const fingerprintId = candidate.fingerprint._id;

      const deferredLink = await DeferredLinkModel.findOne({
        fingerprintId,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      });

      if (!deferredLink) {
        logger.debug(
          { fingerprintId, confidence: candidate.confidence },
          'Candidate passed threshold but has no pending deferred link — trying next'
        );
        continue;
      }

      deferredLink.status = 'matched';
      deferredLink.matchedAt = new Date();
      deferredLink.matchScore = candidate.confidence;
      deferredLink.matchDetails = candidate.details;

      await deferredLink.save();

      // Mark the fingerprint as matched so it can't win a second install.
      await FingerprintService.markAsMatched(fingerprintId.toString());

      logger.info(
        {
          deferredLinkId: deferredLink._id,
          fingerprintId,
          confidence: candidate.confidence,
        },
        'Deferred link matched'
      );

      return {
        deferredLink,
        candidates,
        selectedIndex: candidates.indexOf(candidate),
        reason: 'matched',
      };
    }

    logger.warn(
      { tenantId, qualifyingCount: qualifying.length },
      'Candidates met the threshold but none had a pending deferred link'
    );
    return { deferredLink: null, candidates, selectedIndex: -1, reason: 'no_deferred_link' };
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
