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
    ttlHours: number = 72,
    rawData?: Record<string, any>,
    source: 'browser' | 'app' = 'browser'
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
      userAgent: fingerprint.userAgent,
      userAgentHash,
      screen: fingerprint.screen,
      language: fingerprint.language,
      timezone: fingerprint.timezone,
      timezoneOffset: (fingerprint as any).timezoneOffset,
      deviceMemory: fingerprint.deviceMemory,
      connectionType: fingerprint.connectionType,
      platform: fingerprint.platform,
      vendor: fingerprint.vendor,
      hardwareConcurrency: fingerprint.hardwareConcurrency,
      touchSupport: fingerprint.touchSupport,
      colorDepth: fingerprint.colorDepth,
      pixelRatio: fingerprint.pixelRatio,
      fingerprintHash,
      rawData: rawData || fingerprint,
      source,
      status: 'pending',
      expiresAt,
    });

    await newFingerprint.save();
    logger.info(
      {
        fingerprintId: newFingerprint._id,
        linkId,
        tenantId,
        source,
        ip: fingerprint.ipAddress,
        screen: fingerprint.screen,
        language: fingerprint.language,
        timezone: fingerprint.timezone,
        timezoneOffset: (fingerprint as any).timezoneOffset,
        pixelRatio: fingerprint.pixelRatio,
        platform: fingerprint.platform,
      },
      `Fingerprint stored from ${source}`
    );

    return newFingerprint;
  }

  /**
   * Find best matching fingerprint using scoring algorithm
   *
   * IMPORTANT: In deferred deep linking, the browser UA (Chrome/Safari)
   * will NEVER match the app UA (Dart HTTP client). So UA is excluded
   * from scoring. Instead we weight signals that persist across
   * web-click → app-install:
   *
   * Scoring (total 100):
   * - IP match:              40 points  (same network = strong signal)
   * - Screen resolution:     20 points  (same device = same screen)
   * - Timezone match:        15 points  (geographic signal)
   * - Language/locale match: 10 points  (device locale persists)
   * - Time proximity:        15 points  (closer = more likely same user)
   *
   * Default threshold: 60 points
   * IP + screen alone = 60 (solid match)
   * IP + timezone + language + proximity = 40+15+10+15 = 80 (strong match)
   */
  static async findMatchingFingerprint(
    tenantId: string,
    incomingFingerprint: FingerprintData,
    matchThreshold: number = 60,
    linkId?: string
  ): Promise<{
    fingerprint: IFingerprint | null;
    matchScore: number;
    matchDetails: IMatchDetails;
  }> {
    // Query for pending fingerprints within TTL
    const query: Record<string, any> = {
      tenantId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    };

    // If we have the linkId, narrow the search for better accuracy
    if (linkId) {
      query.linkId = linkId;
    }

    const candidates = await FingerprintModel.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    if (!candidates.length) {
      logger.info(
        { tenantId, linkId, ip: incomingFingerprint.ipAddress },
        'No candidate fingerprints found'
      );
      return {
        fingerprint: null,
        matchScore: 0,
        matchDetails: {},
      };
    }

    logger.info(
      {
        tenantId,
        linkId,
        candidateCount: candidates.length,
        incomingIp: incomingFingerprint.ipAddress,
        incomingScreen: incomingFingerprint.screen,
        incomingLanguage: incomingFingerprint.language,
        incomingTimezone: incomingFingerprint.timezone,
        incomingTimezoneOffset: (incomingFingerprint as any).timezoneOffset,
      },
      '🔍 Evaluating fingerprint candidates — APP data'
    );

    let bestMatch: IFingerprint | null = null;
    let bestScore = 0;
    let bestDetails: IMatchDetails = {};

    for (const candidate of candidates) {
      const { score, details } = this.calculateMatchScore(
        incomingFingerprint,
        candidate
      );

      // Log each candidate comparison for debugging
      logger.info(
        {
          candidateId: candidate._id,
          candidateIp: candidate.ipAddress,
          candidateScreen: candidate.screen,
          candidateLanguage: candidate.language,
          candidateTimezone: candidate.timezone,
          candidateTimezoneOffset: candidate.timezoneOffset,
          score,
          details,
        },
        `📊 Candidate comparison: score=${score}/${matchThreshold}`
      );

      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate as unknown as IFingerprint;
        bestDetails = details;
      }

      // Short-circuit on perfect match
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
          threshold: matchThreshold,
        },
        'Fingerprint matched successfully'
      );

      return {
        fingerprint: bestMatch,
        matchScore: bestScore,
        matchDetails: bestDetails,
      };
    }

    logger.info(
      {
        tenantId,
        bestScore,
        threshold: matchThreshold,
        bestDetails,
      },
      'No fingerprint met threshold'
    );

    return {
      fingerprint: null,
      matchScore: bestScore,
      matchDetails: bestDetails,
    };
  }

  /**
   * Calculate match score between incoming (app) and stored (web) fingerprints.
   *
   * Designed for CROSS-PLATFORM matching (browser → native app).
   * UA hash is intentionally excluded since browser and app UAs never match.
   */
  private static calculateMatchScore(
    incoming: FingerprintData,
    candidate: any
  ): { score: number; details: IMatchDetails } {
    let score = 0;
    const details: IMatchDetails = {};

    // ── IP match: 40 points ──
    // Same public IP = very likely same device/network
    if (incoming.ipAddress && candidate.ipAddress) {
      const ipMatch = incoming.ipAddress === candidate.ipAddress;
      if (ipMatch) {
        score += 40;
        details.ipMatch = true;
        details.ipScore = 40;
      }
    }

    // ── Screen resolution match: 20 points ──
    // Screen size persists between browser and native app on same device.
    // Browser sends CSS pixels (window.screen.width), Flutter sends logical pixels.
    // Both should be equivalent on the same device.
    if (incoming.screen?.width && incoming.screen?.height &&
        candidate.screen?.width && candidate.screen?.height) {
      const exactMatch =
        incoming.screen.width === candidate.screen.width &&
        incoming.screen.height === candidate.screen.height;

      if (exactMatch) {
        score += 20;
        details.screenMatch = true;
        details.screenScore = 20;
      } else {
        // Fuzzy screen match: within 10% tolerance
        // Handles slight differences in how CSS vs logical pixels are reported
        const widthRatio = incoming.screen.width / candidate.screen.width;
        const heightRatio = incoming.screen.height / candidate.screen.height;
        if (widthRatio > 0.9 && widthRatio < 1.1 &&
            heightRatio > 0.9 && heightRatio < 1.1) {
          score += 12;
          details.screenMatch = true;
          details.screenScore = 12;
        } else {
          // Try matching with swapped dimensions (portrait vs landscape)
          const swappedWidthRatio = incoming.screen.width / candidate.screen.height;
          const swappedHeightRatio = incoming.screen.height / candidate.screen.width;
          if (swappedWidthRatio > 0.9 && swappedWidthRatio < 1.1 &&
              swappedHeightRatio > 0.9 && swappedHeightRatio < 1.1) {
            score += 12;
            details.screenMatch = true;
            details.screenScore = 12;
          }
        }
      }

      // Log screen comparison for debugging
      logger.debug(
        {
          incomingScreen: incoming.screen,
          candidateScreen: candidate.screen,
          screenScore: details.screenScore || 0,
        },
        'Screen comparison'
      );
    }

    // ── Timezone match: 15 points ──
    // Same timezone = geographic proximity
    // Handles mixed formats: browser sends IANA name ("Asia/Kolkata"),
    // Flutter may send name, abbreviation ("IST"), or offset ("+05:30")
    if (incoming.timezone && candidate.timezone) {
      const inTz = incoming.timezone;
      const candTz = candidate.timezone;
      const inOffset = (incoming as any).timezoneOffset || (incoming as any).timezone_offset;
      const candOffset = (candidate as any).timezoneOffset || (candidate as any).timezone_offset;

      // Direct match (both same format)
      if (inTz === candTz) {
        score += 15;
        details.timezoneMatch = true;
        details.timezoneScore = 15;
      }
      // Offset-based fallback: if either side sent an offset, compare those
      else if (inOffset && candOffset && inOffset === candOffset) {
        score += 15;
        details.timezoneMatch = true;
        details.timezoneScore = 15;
      }
      // Partial match: same UTC offset (convert known IANA names to offset)
      else {
        try {
          const inDate = new Date().toLocaleString('en-US', { timeZone: inTz });
          const candDate = new Date().toLocaleString('en-US', { timeZone: candTz });
          // If we can resolve both to valid dates and they produce same local time,
          // they're in the same timezone
          if (inDate && candDate && inDate === candDate) {
            score += 12;
            details.timezoneMatch = true;
            details.timezoneScore = 12;
          }
        } catch {
          // One of the timezone names is not a valid IANA name (e.g., abbreviation)
          // No points awarded
        }
      }
    }

    // ── Language/locale match: 10 points ──
    // Device language persists between browser and app
    if (incoming.language && candidate.language) {
      // Normalize: "en-US" and "en_US" should match, "en" prefix match is partial
      const inLang = incoming.language.toLowerCase().replace('_', '-');
      const candLang = candidate.language.toLowerCase().replace('_', '-');

      if (inLang === candLang) {
        score += 10;
        details.languageMatch = true;
        details.languageScore = 10;
      } else if (inLang.split('-')[0] === candLang.split('-')[0]) {
        // Partial match (same base language, e.g., "en" vs "en-US")
        score += 5;
        details.languageMatch = true;
        details.languageScore = 5;
      }
    }

    // ── Time proximity: up to 15 points ──
    // More recent clicks are more likely to be the same user
    const createdAt = candidate.createdAt instanceof Date
      ? candidate.createdAt.getTime()
      : new Date(candidate.createdAt).getTime();
    const minutesSince = (Date.now() - createdAt) / (1000 * 60);

    let proximityScore = 0;
    if (minutesSince <= 10) {
      proximityScore = 15;       // Within 10 minutes: full points
    } else if (minutesSince <= 30) {
      proximityScore = 12;       // Within 30 minutes: high confidence
    } else if (minutesSince <= 60) {
      proximityScore = 10;       // Within 1 hour: good
    } else if (minutesSince <= 360) {
      proximityScore = 8;        // Within 6 hours: moderate
    } else if (minutesSince <= 1440) {
      proximityScore = 4;        // Within 24 hours: low
    } else if (minutesSince <= 2880) {
      proximityScore = 2;        // Within 48 hours: very low
    } else {
      proximityScore = 1;        // Beyond 48 hours: minimal
    }
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
