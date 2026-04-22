import { Logger } from '@/lib/logger';
import FingerprintModel from '@/lib/models/Fingerprint';
import { IFingerprint, FingerprintData, IMatchDetails } from '@/types';
import crypto from 'crypto';

const logger = Logger.child({ service: 'FingerprintService' });

export class FingerprintService {
  /**
   * Create a fingerprint hash from device data
   */
  static createFingerprintHash(fingerprint: FingerprintData): string {
    const components = [
      fingerprint.ipAddress,
      fingerprint.userAgent,
      `${fingerprint.screen?.width}x${fingerprint.screen?.height}`,
      fingerprint.language,
      fingerprint.timezone,
      fingerprint.platform,
    ]
      .filter(Boolean)
      .join('|');

    return crypto.createHash('sha256').update(components).digest('hex');
  }

  /**
   * Store a fingerprint from a web click
   */
  static async storeFingerprint(
    linkId: string,
    tenantId: string,
    clickId: string | undefined,
    fingerprint: FingerprintData,
    ttlHours: number = 72
  ): Promise<IFingerprint> {
    const userAgentHash = crypto
      .createHash('sha256')
      .update(fingerprint.userAgent || '')
      .digest('hex');

    const fingerprintHash = this.createFingerprintHash(fingerprint);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    const newFingerprint = new FingerprintModel({
      clickId: clickId || undefined,
      linkId,
      tenantId,
      ipAddress: fingerprint.ipAddress,
      userAgentHash,
      screen: fingerprint.screen,
      language: fingerprint.language,
      timezone: fingerprint.timezone,
      deviceMemory: fingerprint.deviceMemory,
      connectionType: fingerprint.connectionType,
      platform: fingerprint.platform,
      vendor: fingerprint.vendor,
      hardwareConcurrency: fingerprint.hardwareConcurrency,
      touchSupport: fingerprint.touchSupport,
      colorDepth: fingerprint.colorDepth,
      pixelRatio: fingerprint.pixelRatio,
      fingerprintHash,
      status: 'pending',
      expiresAt,
    });

    await newFingerprint.save();
    logger.debug(
      {
        fingerprintId: newFingerprint._id,
        linkId,
        hash: fingerprintHash,
      },
      'Fingerprint stored'
    );

    return newFingerprint;
  }

  /**
   * Find best matching fingerprint using scoring algorithm
   *
   * Scoring:
   * - IP match: 40 points
   * - UA hash match: 30 points
   * - Screen resolution: 10 points
   * - Language match: 5 points
   * - Timezone match: 5 points
   * - Time proximity: up to 10 points (10 - hours since click)
   * - Threshold: 70+ points
   */
  static async findMatchingFingerprint(
    tenantId: string,
    incomingFingerprint: FingerprintData,
    matchThreshold: number = 70,
    linkId?: string
  ): Promise<{
    fingerprint: IFingerprint | null;
    matchScore: number;
    matchDetails: IMatchDetails;
  }> {
    const incomingHash = this.createFingerprintHash(incomingFingerprint);
    const incomingUaHash = crypto
      .createHash('sha256')
      .update(incomingFingerprint.userAgent || '')
      .digest('hex');

    // Query for pending fingerprints within TTL
    const query: Record<string, any> = {
      tenantId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    };

    if (linkId) {
      query.linkId = linkId;
    }

    const candidates = await FingerprintModel.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    if (!candidates.length) {
      logger.debug(
        { tenantId, linkId },
        'No candidate fingerprints found'
      );
      return {
        fingerprint: null,
        matchScore: 0,
        matchDetails: {},
      };
    }

    let bestMatch: IFingerprint | null = null;
    let bestScore = 0;
    let bestDetails: IMatchDetails = {};

    for (const candidate of candidates) {
      const { score, details } = this.calculateMatchScore(
        incomingFingerprint,
        incomingHash,
        incomingUaHash,
        candidate
      );

      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate as unknown as IFingerprint;
        bestDetails = details;
      }

      // Short-circuit if we found a perfect match
      if (score >= 100) {
        break;
      }
    }

    if (bestScore >= matchThreshold && bestMatch) {
      logger.info(
        {
          fingerprintId: bestMatch._id,
          score: bestScore,
          details: bestDetails,
        },
        'Fingerprint matched'
      );

      return {
        fingerprint: bestMatch,
        matchScore: bestScore,
        matchDetails: bestDetails,
      };
    }

    logger.debug(
      {
        incomingTenantId: tenantId,
        bestScore,
        threshold: matchThreshold,
      },
      'No matching fingerprint found'
    );

    return {
      fingerprint: null,
      matchScore: bestScore,
      matchDetails: bestDetails,
    };
  }

  /**
   * Calculate match score between two fingerprints
   */
  private static calculateMatchScore(
    incoming: FingerprintData,
    incomingHash: string,
    incomingUaHash: string,
    candidate: any
  ): { score: number; details: IMatchDetails } {
    let score = 0;
    const details: IMatchDetails = {};

    // IP match: 40 points
    const ipMatch = incoming.ipAddress === candidate.ipAddress;
    if (ipMatch) {
      score += 40;
      details.ipMatch = true;
      details.ipScore = 40;
    }

    // User agent hash match: 30 points
    const uaHashMatch = incomingUaHash === candidate.userAgentHash;
    if (uaHashMatch) {
      score += 30;
      details.uaHashMatch = true;
      details.uaHashScore = 30;
    }

    // Screen resolution match: 10 points
    const screenMatch =
      incoming.screen?.width === candidate.screen?.width &&
      incoming.screen?.height === candidate.screen?.height;
    if (screenMatch) {
      score += 10;
      details.screenMatch = true;
      details.screenScore = 10;
    }

    // Language match: 5 points
    const languageMatch =
      incoming.language && incoming.language === candidate.language;
    if (languageMatch) {
      score += 5;
      details.languageMatch = true;
      details.languageScore = 5;
    }

    // Timezone match: 5 points
    const timezoneMatch =
      incoming.timezone && incoming.timezone === candidate.timezone;
    if (timezoneMatch) {
      score += 5;
      details.timezoneMatch = true;
      details.timezoneScore = 5;
    }

    // Time proximity: up to 10 points
    const hoursSince = (Date.now() - candidate.createdAt.getTime()) / (1000 * 60 * 60);
    const proximityScore = Math.max(0, 10 - Math.floor(hoursSince));
    score += proximityScore;
    details.proximityScore = proximityScore;

    details.totalScore = score;

    return { score, details };
  }

  /**
   * Mark fingerprint as matched
   */
  static async markAsMatched(fingerprintId: string): Promise<void> {
    await FingerprintModel.updateOne(
      { _id: fingerprintId },
      { status: 'matched' }
    );
    logger.debug({ fingerprintId }, 'Fingerprint marked as matched');
  }

  /**
   * Get fingerprint by ID
   */
  static async getFingerprint(fingerprintId: string): Promise<IFingerprint | null> {
    return FingerprintModel.findById(fingerprintId);
  }
}

export default FingerprintService;
