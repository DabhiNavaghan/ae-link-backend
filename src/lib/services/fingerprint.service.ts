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
    ttlHours: number = 6,
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
   * Default threshold: 75 points
   * IP exact + screen = 40+20 = 60 (needs more signals)
   * IP exact + screen + timezone = 40+20+15 = 75 (solid match)
   * IP /24 + screen + timezone + language = 30+20+15+10 = 75 (solid match)
   * IP /24 + timezone + language + proximity = 30+15+10+15 = 70 (NOT enough — prevents
   *   false positives from same-ISP users who never installed via this link)
   */
  static async findMatchingFingerprint(
    tenantId: string,
    incomingFingerprint: FingerprintData,
    matchThreshold: number = 75,
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
  /**
   * Normalize platform strings to 'ios' | 'android' | null.
   * Browser sends navigator.platform: "iPhone", "iPad", "Linux armv81", "MacIntel", etc.
   * Flutter SDK sends: "ios", "android", "iOS", "Android", etc.
   */
  private static normalizePlatformOS(platform?: string, userAgent?: string): 'ios' | 'android' | null {
    if (!platform && !userAgent) return null;

    const p = (platform || '').toLowerCase();
    const ua = (userAgent || '').toLowerCase();

    // iOS indicators
    if (
      p.includes('iphone') || p.includes('ipad') || p.includes('ipod') ||
      p === 'ios' ||
      ua.includes('iphone') || ua.includes('ipad')
    ) {
      return 'ios';
    }

    // Android indicators
    if (
      p.includes('android') || p.includes('linux arm') || p.includes('linux aarch') ||
      p === 'android' ||
      ua.includes('android')
    ) {
      return 'android';
    }

    return null;
  }

  /**
   * Expand an IPv6 address to its full 8-hextet form (lowercase, zero-padded),
   * handling `::` compression. Returns null if the string is not a parseable
   * IPv6 address. Zone IDs (`%eth0`) are stripped.
   */
  private static expandIpv6(ip: string): string[] | null {
    const bare = ip.split('%')[0];
    if (!bare.includes(':')) return null;

    const halves = bare.split('::');
    if (halves.length > 2) return null; // more than one "::" is invalid

    const head = halves[0] ? halves[0].split(':') : [];
    const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const missing = 8 - (head.length + tail.length);

    // Without "::" we need exactly 8 hextets; with "::" we need at least one gap.
    if (halves.length === 1 && head.length !== 8) return null;
    if (halves.length === 2 && missing < 1) return null;

    const middle = new Array(halves.length === 2 ? missing : 0).fill('0');
    const full = [...head, ...middle, ...tail];
    if (full.length !== 8) return null;

    return full.map((h) => h.padStart(4, '0').toLowerCase());
  }

  /**
   * Compare two client IPs and return a match score + type.
   *
   * Version-aware: IPv4 uses octet prefixes (/24, /16), IPv6 uses hextet
   * prefixes (/64, /48). IPv4-mapped IPv6 (`::ffff:1.2.3.4`) is normalized to
   * plain IPv4 first. A v4-vs-v6 pair cannot be meaningfully compared (e.g.
   * WiFi IPv4 web click vs cellular IPv6 install) and scores 0.
   *
   *   Exact:                       40
   *   Same /24 (v4) or /64 (v6):   30  (same network block)
   *   Same /16 (v4) or /48 (v6):   20  (same carrier region)
   */
  private static compareIpAddresses(
    a: string,
    b: string
  ): { score: number; matchType: string } {
    // Normalize IPv4-mapped IPv6 → plain IPv4
    const na = a.startsWith('::ffff:') ? a.slice(7) : a;
    const nb = b.startsWith('::ffff:') ? b.slice(7) : b;

    if (na === nb) return { score: 40, matchType: 'exact' };

    const aIsV6 = na.includes(':');
    const bIsV6 = nb.includes(':');

    // Different IP families — not comparable (no false-positive credit).
    if (aIsV6 !== bIsV6) return { score: 0, matchType: 'version_mismatch' };

    if (!aIsV6) {
      // IPv4 octet-prefix matching
      const ap = na.split('.');
      const bp = nb.split('.');
      if (ap.length === 4 && bp.length === 4) {
        if (ap[0] === bp[0] && ap[1] === bp[1] && ap[2] === bp[2]) {
          return { score: 30, matchType: 'subnet_24' };
        }
        if (ap[0] === bp[0] && ap[1] === bp[1]) {
          return { score: 20, matchType: 'subnet_16' };
        }
      }
      return { score: 0, matchType: 'none' };
    }

    // IPv6 hextet-prefix matching
    const ae = this.expandIpv6(na);
    const be = this.expandIpv6(nb);
    if (!ae || !be) return { score: 0, matchType: 'none' };

    if (ae.slice(0, 4).join(':') === be.slice(0, 4).join(':')) {
      return { score: 30, matchType: 'prefix_64' };
    }
    if (ae.slice(0, 3).join(':') === be.slice(0, 3).join(':')) {
      return { score: 20, matchType: 'prefix_48' };
    }
    return { score: 0, matchType: 'none' };
  }

  private static calculateMatchScore(
    incoming: FingerprintData,
    candidate: any
  ): { score: number; details: IMatchDetails } {
    let score = 0;
    const details: IMatchDetails = {};

    // ── Platform/OS match: BLOCKING condition ──
    // An iOS click must only match an iOS app, Android to Android.
    // If both sides report a platform and they disagree, reject immediately.
    const incomingOS = this.normalizePlatformOS(incoming.platform, incoming.userAgent);
    const candidateOS = this.normalizePlatformOS(candidate.platform, candidate.userAgent);

    if (incomingOS && candidateOS && incomingOS !== candidateOS) {
      details.platformMismatch = true;
      details.incomingPlatform = incomingOS;
      details.candidatePlatform = candidateOS;
      details.totalScore = 0;

      logger.debug(
        {
          incomingPlatform: `${incoming.platform} → ${incomingOS}`,
          candidatePlatform: `${candidate.platform} → ${candidateOS}`,
        },
        'Platform mismatch — rejecting candidate'
      );

      return { score: 0, details };
    }

    details.platformMatch = incomingOS === candidateOS;

    // ── IP match: up to 40 points ──
    // Mobile carriers use CGNAT with multiple exit IPs, so exact match
    // is rare. Instead, use subnet/prefix matching (IPv4 AND IPv6):
    //   Exact match:                40 points — same IP, very strong
    //   Same /24 (v4) or /64 (v6):  30 points — same network block
    //   Same /16 (v4) or /48 (v6):  20 points — same carrier region
    //
    // IMPORTANT: Cloudflare's cf-connecting-ip returns the device's real IP,
    // which on mobile is frequently IPv6. IPv6 privacy/temporary addresses
    // (RFC 4941) rotate the lower 64 bits, so exact match is rare even on the
    // same device/network — the /64 prefix is the stable "same network" signal.
    if (incoming.ipAddress && candidate.ipAddress) {
      const { score: ipScore, matchType } = this.compareIpAddresses(
        incoming.ipAddress,
        candidate.ipAddress
      );

      if (ipScore > 0) {
        score += ipScore;
        details.ipMatch = true;
        details.ipScore = ipScore;
        details.ipMatchType = matchType;
      }

      logger.debug(
        {
          incomingIp: incoming.ipAddress,
          candidateIp: candidate.ipAddress,
          ipScore: details.ipScore || 0,
          matchType: details.ipMatchType || 'none',
        },
        'IP comparison'
      );
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
        // Fuzzy screen match: within 5% tolerance (tightened from 10%)
        // Browser CSS pixels and Flutter logical pixels should be very close
        // on the same device. 5% tolerance handles minor rounding differences
        // while preventing cross-device false positives (e.g. iPhone 390×844
        // should NOT match a typical Android 412×915).
        const widthRatio = incoming.screen.width / candidate.screen.width;
        const heightRatio = incoming.screen.height / candidate.screen.height;
        if (widthRatio > 0.95 && widthRatio < 1.05 &&
            heightRatio > 0.95 && heightRatio < 1.05) {
          score += 15;
          details.screenMatch = true;
          details.screenScore = 15;
        } else {
          // Try matching with swapped dimensions (portrait vs landscape)
          const swappedWidthRatio = incoming.screen.width / candidate.screen.height;
          const swappedHeightRatio = incoming.screen.height / candidate.screen.width;
          if (swappedWidthRatio > 0.95 && swappedWidthRatio < 1.05 &&
              swappedHeightRatio > 0.95 && swappedHeightRatio < 1.05) {
            score += 15;
            details.screenMatch = true;
            details.screenScore = 15;
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
