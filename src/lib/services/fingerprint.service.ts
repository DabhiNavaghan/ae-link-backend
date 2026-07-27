import { Logger } from '@/lib/logger';
import FingerprintModel from '@/lib/models/Fingerprint';
import { IFingerprint, FingerprintData, IMatchDetails, IMatchSignal } from '@/types';
import crypto from 'crypto';

const logger = Logger.child({ service: 'FingerprintService' });

/**
 * Maximum points each signal can contribute. Signals that neither side
 * reported are dropped from the denominator (see `IMatchSignal.possible`),
 * so the final confidence is "how much of the evidence we could actually
 * check agreed", not "how much of a fixed 100 we hit".
 */
const WEIGHTS = {
  // IP is deliberately weighted BELOW screen: on mobile the network routinely
  // changes between the browser click (often WiFi) and the app install (often
  // cellular), so a mismatched IP is weak evidence of "different person". Screen
  // physical resolution is more device-specific, so it carries equal top weight.
  ip: 25,
  screen: 25,
  timezone: 15,
  language: 10,
  proximity: 10,
} as const;

/** A scored candidate, richest-first. */
export interface ScoredCandidate {
  fingerprint: IFingerprint;
  /** Raw points earned. */
  score: number;
  /** Points available across evaluable signals. */
  possible: number;
  /** `score / possible * 100`, rounded. This is what the threshold compares. */
  confidence: number;
  details: IMatchDetails;
}

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
      physicalScreen: this.derivePhysicalScreen(fingerprint),
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
   * Score every live fingerprint for a tenant against the incoming app
   * fingerprint and return them ranked best-first.
   *
   * IMPORTANT: In deferred deep linking, the browser UA (Chrome/Safari)
   * will NEVER match the app UA (Dart HTTP client). So UA is excluded
   * from scoring. Instead we weight signals that persist across
   * web-click → app-install:
   *
   *   IP match:              40 points  (same network = strong signal)
   *   Screen resolution:     25 points  (physical pixels — DPR-invariant)
   *   Timezone match:        15 points  (geographic signal)
   *   Language/locale match: 10 points  (device locale persists)
   *   Time proximity:        10 points  (closer = more likely same user)
   *
   * The threshold is compared against `confidence` (earned ÷ available × 100),
   * NOT the raw sum. A device that reports no timezone therefore isn't
   * punished for it — the timezone weight leaves the denominator instead.
   *
   * A candidate is rejected outright when it has no hard device evidence
   * (neither IP nor screen agreed); locale + timezone + recency alone would
   * otherwise match any co-located stranger.
   *
   * Callers get the full ranked list so they can fall through to the next
   * candidate when the best one has no pending DeferredLink attached.
   */
  static async rankCandidates(
    tenantId: string,
    incomingFingerprint: FingerprintData,
    linkId?: string,
    candidateLimit: number = 300
  ): Promise<ScoredCandidate[]> {
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
      .limit(candidateLimit)
      .lean();

    if (!candidates.length) {
      logger.info(
        { tenantId, linkId, ip: incomingFingerprint.ipAddress },
        'No candidate fingerprints found'
      );
      return [];
    }

    logger.info(
      {
        tenantId,
        linkId,
        candidateCount: candidates.length,
        incomingIp: incomingFingerprint.ipAddress,
        incomingScreen: incomingFingerprint.screen,
        incomingPhysicalScreen: incomingFingerprint.physicalScreen,
        incomingLanguage: incomingFingerprint.language,
        incomingTimezone: incomingFingerprint.timezone,
        incomingTimezoneOffset: incomingFingerprint.timezoneOffset,
      },
      '🔍 Evaluating fingerprint candidates — APP data'
    );

    const scored: ScoredCandidate[] = candidates.map((candidate) => {
      const { score, possible, confidence, details } = this.calculateMatchScore(
        incomingFingerprint,
        candidate
      );

      return {
        fingerprint: candidate as unknown as IFingerprint,
        score,
        possible,
        confidence,
        details,
      };
    });

    scored.sort((a, b) => b.confidence - a.confidence || b.score - a.score);

    for (const c of scored.slice(0, 10)) {
      logger.info(
        {
          candidateId: c.fingerprint._id,
          candidateIp: c.fingerprint.ipAddress,
          candidateScreen: c.fingerprint.screen,
          candidateLanguage: c.fingerprint.language,
          candidateTimezone: c.fingerprint.timezone,
          score: c.score,
          possible: c.possible,
          confidence: c.confidence,
          details: c.details,
        },
        `📊 Candidate comparison: ${c.confidence}% (${c.score}/${c.possible})`
      );
    }

    return scored;
  }

  /**
   * Find the single best matching fingerprint above `matchThreshold`.
   *
   * Kept for callers that only need the winner. Prefer `rankCandidates`
   * when you need to fall through to lower-ranked candidates.
   */
  static async findMatchingFingerprint(
    tenantId: string,
    incomingFingerprint: FingerprintData,
    matchThreshold: number = 68,
    linkId?: string
  ): Promise<{
    fingerprint: IFingerprint | null;
    matchScore: number;
    matchDetails: IMatchDetails;
  }> {
    const ranked = await this.rankCandidates(
      tenantId,
      incomingFingerprint,
      linkId
    );

    const best = ranked[0];
    if (!best) {
      return { fingerprint: null, matchScore: 0, matchDetails: {} };
    }

    if (best.confidence >= matchThreshold) {
      logger.info(
        {
          fingerprintId: best.fingerprint._id,
          confidence: best.confidence,
          details: best.details,
          threshold: matchThreshold,
        },
        'Fingerprint matched successfully'
      );

      return {
        fingerprint: best.fingerprint,
        matchScore: best.confidence,
        matchDetails: best.details,
      };
    }

    logger.info(
      {
        tenantId,
        bestConfidence: best.confidence,
        threshold: matchThreshold,
        bestDetails: best.details,
      },
      'No fingerprint met threshold'
    );

    return {
      fingerprint: null,
      matchScore: best.confidence,
      matchDetails: best.details,
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
    // Sub-scores are derived from WEIGHTS.ip so they never drift out of sync
    // when the weight is retuned: exact = full, same /24|/64 = 72%, /16|/48 = 48%.
    const IP_EXACT = WEIGHTS.ip;
    const IP_NEAR = Math.round(WEIGHTS.ip * 0.72); // same subnet / /64 prefix
    const IP_WIDE = Math.round(WEIGHTS.ip * 0.48); // same carrier region / /48

    // Normalize IPv4-mapped IPv6 → plain IPv4
    const na = a.startsWith('::ffff:') ? a.slice(7) : a;
    const nb = b.startsWith('::ffff:') ? b.slice(7) : b;

    if (na === nb) return { score: IP_EXACT, matchType: 'exact' };

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
          return { score: IP_NEAR, matchType: 'subnet_24' };
        }
        if (ap[0] === bp[0] && ap[1] === bp[1]) {
          return { score: IP_WIDE, matchType: 'subnet_16' };
        }
      }
      return { score: 0, matchType: 'none' };
    }

    // IPv6 hextet-prefix matching
    const ae = this.expandIpv6(na);
    const be = this.expandIpv6(nb);
    if (!ae || !be) return { score: 0, matchType: 'none' };

    if (ae.slice(0, 4).join(':') === be.slice(0, 4).join(':')) {
      return { score: IP_NEAR, matchType: 'prefix_64' };
    }
    if (ae.slice(0, 3).join(':') === be.slice(0, 3).join(':')) {
      return { score: IP_WIDE, matchType: 'prefix_48' };
    }
    return { score: 0, matchType: 'none' };
  }

  /**
   * Derive physical (device) pixels from a fingerprint.
   *
   * Physical pixels are the only screen figure that survives the trip from
   * browser to app: the browser reports CSS pixels at Chrome's device-scale-
   * factor while Flutter reports logical pixels at its own devicePixelRatio,
   * and on most Android devices those two ratios differ. Multiplying each
   * side back out by its own ratio lands both on the panel's real resolution.
   */
  private static derivePhysicalScreen(
    fp: Partial<FingerprintData> & { physicalScreen?: { width?: number; height?: number } }
  ): { width: number; height: number } | undefined {
    const explicit = fp.physicalScreen;
    if (explicit?.width && explicit?.height) {
      return { width: Math.round(explicit.width), height: Math.round(explicit.height) };
    }

    const ratio = fp.pixelRatio;
    if (fp.screen?.width && fp.screen?.height && ratio && ratio > 0) {
      return {
        width: Math.round(fp.screen.width * ratio),
        height: Math.round(fp.screen.height * ratio),
      };
    }

    return undefined;
  }

  /** Orientation-independent [short, long] pair. */
  private static normalizeDims(w: number, h: number): [number, number] {
    return w <= h ? [w, h] : [h, w];
  }

  /**
   * Compare two screen sizes and return a score out of `WEIGHTS.screen`.
   *
   * Prefers physical pixels; falls back to logical pixels with a wider
   * tolerance because the two sides measure them with different scale
   * factors. Height gets more slack than width: on Android the browser
   * reports the full panel height while a non-edge-to-edge Flutter view
   * excludes the status and navigation bars, a difference of up to ~12%.
   */
  private static compareScreens(
    incoming: FingerprintData,
    candidate: any
  ): { score: number; matchType: string; appValue: string | null; webValue: string | null } {
    const inPhys = this.derivePhysicalScreen(incoming);
    const candPhys = this.derivePhysicalScreen(candidate);

    const usePhysical = Boolean(inPhys && candPhys);
    const a = usePhysical ? inPhys! : incoming.screen;
    const b = usePhysical ? candPhys! : candidate.screen;

    if (!a?.width || !a?.height || !b?.width || !b?.height) {
      return { score: 0, matchType: 'unavailable', appValue: null, webValue: null };
    }

    const suffix = usePhysical ? 'px' : 'dp';
    const appValue = `${Math.round(a.width)}×${Math.round(a.height)}${suffix}`;
    const webValue = `${Math.round(b.width)}×${Math.round(b.height)}${suffix}`;

    const [aShort, aLong] = this.normalizeDims(a.width, a.height);
    const [bShort, bLong] = this.normalizeDims(b.width, b.height);

    const widthDelta = Math.abs(aShort - bShort) / bShort;
    const heightDelta = Math.abs(aLong - bLong) / bLong;

    // Width tolerance is tight — the short edge is never cropped by system UI.
    const widthTolerance = usePhysical ? 0.02 : 0.06;
    // Height tolerance absorbs status/navigation bar differences.
    const heightTolerance = usePhysical ? 0.03 : 0.14;

    if (aShort === bShort && aLong === bLong) {
      return { score: WEIGHTS.screen, matchType: 'exact', appValue, webValue };
    }

    if (widthDelta <= widthTolerance && heightDelta <= heightTolerance) {
      // Near-exact: same panel, minor rounding or system-UI difference.
      const matchType = heightDelta <= widthTolerance ? 'near_exact' : 'system_ui_offset';
      return { score: Math.round(WEIGHTS.screen * 0.9), matchType, appValue, webValue };
    }

    // Aspect-ratio fallback: same width but a materially different height
    // still points at the same device more often than not, but it is weak
    // evidence on its own so it earns well under half the weight.
    if (widthDelta <= widthTolerance) {
      return {
        score: Math.round(WEIGHTS.screen * 0.4),
        matchType: 'width_only',
        appValue,
        webValue,
      };
    }

    return { score: 0, matchType: 'none', appValue, webValue };
  }

  /**
   * Compare timezones across the browser/Flutter format gap.
   *
   * The browser sends an IANA name ("Asia/Kolkata") plus a numeric UTC offset;
   * Flutter's `DateTime.timeZoneName` often yields an abbreviation ("IST").
   * The numeric offset is the only value both sides reliably agree on, so it
   * is checked first — and, critically, the comparison runs whenever EITHER
   * side has a usable value, rather than requiring both to have a name.
   */
  private static compareTimezones(
    incoming: FingerprintData,
    candidate: any
  ): { score: number; matchType: string; appValue: string | null; webValue: string | null } {
    const inTz = incoming.timezone || '';
    const candTz = candidate.timezone || '';
    const inOffset = incoming.timezoneOffset || (incoming as any).timezone_offset || '';
    const candOffset = candidate.timezoneOffset || (candidate as any).timezone_offset || '';

    const appValue = inTz || inOffset || null;
    const webValue = candTz || candOffset || null;

    const hasIncoming = Boolean(inTz || inOffset);
    const hasCandidate = Boolean(candTz || candOffset);
    if (!hasIncoming || !hasCandidate) {
      return { score: 0, matchType: 'unavailable', appValue, webValue };
    }

    // Numeric UTC offset — the format-independent comparison.
    if (inOffset && candOffset) {
      if (this.normalizeOffset(inOffset) === this.normalizeOffset(candOffset)) {
        return { score: WEIGHTS.timezone, matchType: 'offset', appValue, webValue };
      }
      // Both sides gave an offset and they disagree — a genuine mismatch.
      return { score: 0, matchType: 'offset_mismatch', appValue, webValue };
    }

    // Identical strings (both IANA names, or both abbreviations).
    if (inTz && candTz && inTz === candTz) {
      return { score: WEIGHTS.timezone, matchType: 'name', appValue, webValue };
    }

    // One side has a name, the other only an offset: resolve the name to an
    // offset and compare numerically.
    const resolvedIn = inOffset || this.ianaToOffset(inTz);
    const resolvedCand = candOffset || this.ianaToOffset(candTz);
    if (resolvedIn && resolvedCand) {
      if (this.normalizeOffset(resolvedIn) === this.normalizeOffset(resolvedCand)) {
        return { score: WEIGHTS.timezone, matchType: 'resolved_offset', appValue, webValue };
      }
      return { score: 0, matchType: 'offset_mismatch', appValue, webValue };
    }

    return { score: 0, matchType: 'none', appValue, webValue };
  }

  /** "+5:30" / "+0530" / "+05:30" → "+05:30". Returns '' if unparseable. */
  private static normalizeOffset(offset: string): string {
    const m = /^([+-]?)(\d{1,2}):?(\d{2})$/.exec(offset.trim());
    if (!m) return '';
    const sign = m[1] === '-' ? '-' : '+';
    return `${sign}${m[2].padStart(2, '0')}:${m[3]}`;
  }

  /** Current UTC offset for an IANA zone name, e.g. "Asia/Kolkata" → "+05:30". */
  private static ianaToOffset(timezone: string): string {
    if (!timezone) return '';
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset',
      }).formatToParts(new Date());
      const name = parts.find((p) => p.type === 'timeZoneName')?.value || '';
      // "GMT+05:30" → "+05:30"; plain "GMT" means UTC.
      const m = /GMT([+-]\d{1,2}:?\d{2})/.exec(name);
      if (m) return this.normalizeOffset(m[1]);
      return name === 'GMT' ? '+00:00' : '';
    } catch {
      // Not a valid IANA name (e.g. the abbreviation "IST").
      return '';
    }
  }

  /** "en_US" / "en-US" / "en-null" / "en-" → "en-us" / "en". */
  private static normalizeLocale(locale: string): string {
    const cleaned = locale.trim().toLowerCase().replace(/_/g, '-');
    const [lang, region] = cleaned.split('-');
    if (!region || region === 'null' || region === 'undefined') return lang || '';
    return `${lang}-${region}`;
  }

  private static calculateMatchScore(
    incoming: FingerprintData,
    candidate: any
  ): { score: number; possible: number; confidence: number; details: IMatchDetails } {
    const signals: IMatchSignal[] = [];
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
      details.possibleScore = 0;
      details.confidence = 0;
      details.signals = [];
      details.rejectedReason = `platform_mismatch:${incomingOS}_vs_${candidateOS}`;

      logger.debug(
        {
          incomingPlatform: `${incoming.platform} → ${incomingOS}`,
          candidatePlatform: `${candidate.platform} → ${candidateOS}`,
        },
        'Platform mismatch — rejecting candidate'
      );

      return { score: 0, possible: 0, confidence: 0, details };
    }

    details.platformMatch = incomingOS === candidateOS;
    details.incomingPlatform = incomingOS || undefined;
    details.candidatePlatform = candidateOS || undefined;

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

      details.ipMatch = ipScore > 0;
      details.ipScore = ipScore;
      details.ipMatchType = matchType;

      signals.push({
        key: 'ip',
        earned: ipScore,
        // A v4-vs-v6 pair can't be compared at all (WiFi click on IPv4, then
        // a cellular install on IPv6). Treating that as a 0/40 mismatch would
        // sink an otherwise perfect match, so it leaves the denominator.
        possible: matchType === 'version_mismatch' ? 0 : WEIGHTS.ip,
        matchType,
        appValue: incoming.ipAddress,
        webValue: candidate.ipAddress,
      });
    } else {
      signals.push({
        key: 'ip',
        earned: 0,
        possible: 0,
        matchType: 'unavailable',
        appValue: incoming.ipAddress || null,
        webValue: candidate.ipAddress || null,
      });
    }

    // ── Screen resolution: up to 25 points ──
    const screen = this.compareScreens(incoming, candidate);
    details.screenMatch = screen.score > 0;
    details.screenScore = screen.score;
    details.screenMatchType = screen.matchType;
    signals.push({
      key: 'screen',
      earned: screen.score,
      possible: screen.matchType === 'unavailable' ? 0 : WEIGHTS.screen,
      matchType: screen.matchType,
      appValue: screen.appValue,
      webValue: screen.webValue,
    });

    // ── Timezone: up to 15 points ──
    const tz = this.compareTimezones(incoming, candidate);
    details.timezoneMatch = tz.score > 0;
    details.timezoneScore = tz.score;
    signals.push({
      key: 'timezone',
      earned: tz.score,
      possible: tz.matchType === 'unavailable' ? 0 : WEIGHTS.timezone,
      matchType: tz.matchType,
      appValue: tz.appValue,
      webValue: tz.webValue,
    });

    // ── Language/locale: up to 10 points ──
    // Device language persists between browser and app.
    if (incoming.language && candidate.language) {
      const inLang = this.normalizeLocale(incoming.language);
      const candLang = this.normalizeLocale(candidate.language);

      let langScore = 0;
      let langType = 'none';
      if (inLang && inLang === candLang) {
        langScore = WEIGHTS.language;
        langType = 'exact';
      } else if (inLang.split('-')[0] === candLang.split('-')[0]) {
        // Same base language, one side lacked a region ("en" vs "en-US").
        langScore = Math.round(WEIGHTS.language * 0.7);
        langType = 'base_language';
      }

      details.languageMatch = langScore > 0;
      details.languageScore = langScore;
      signals.push({
        key: 'language',
        earned: langScore,
        possible: WEIGHTS.language,
        matchType: langType,
        appValue: incoming.language,
        webValue: candidate.language,
      });
    } else {
      signals.push({
        key: 'language',
        earned: 0,
        possible: 0,
        matchType: 'unavailable',
        appValue: incoming.language || null,
        webValue: candidate.language || null,
      });
    }

    // ── Time proximity: up to 10 points ──
    // More recent clicks are more likely to be the same user.
    const createdAt = candidate.createdAt instanceof Date
      ? candidate.createdAt.getTime()
      : new Date(candidate.createdAt).getTime();
    const minutesSince = (Date.now() - createdAt) / (1000 * 60);

    let proximityScore: number;
    if (minutesSince <= 30) {
      proximityScore = WEIGHTS.proximity;           // Within 30 min: full points
    } else if (minutesSince <= 120) {
      proximityScore = 8;                            // Within 2 hours
    } else if (minutesSince <= 360) {
      proximityScore = 6;                            // Within 6 hours
    } else if (minutesSince <= 1440) {
      proximityScore = 4;                            // Within 24 hours
    } else if (minutesSince <= 2880) {
      proximityScore = 2;                            // Within 48 hours
    } else {
      proximityScore = 1;                            // Beyond 48 hours
    }

    details.proximityScore = proximityScore;
    signals.push({
      key: 'proximity',
      earned: proximityScore,
      possible: WEIGHTS.proximity,
      matchType: `${Math.round(minutesSince)}m_ago`,
      appValue: null,
      webValue: new Date(createdAt).toISOString(),
    });

    const score = signals.reduce((sum, s) => sum + s.earned, 0);
    const possible = signals.reduce((sum, s) => sum + s.possible, 0);
    const confidence = possible > 0 ? Math.round((score / possible) * 100) : 0;

    details.signals = signals;
    details.totalScore = score;
    details.possibleScore = possible;
    details.confidence = confidence;

    // ── Hard-evidence guard ──
    // Locale + timezone + recency describe a city, not a device. Without at
    // least one of IP or screen agreeing, any co-located stranger who happens
    // to install the app would score 100%. Reject those outright.
    if ((details.ipScore || 0) === 0 && (details.screenScore || 0) === 0) {
      details.rejectedReason = 'no_hard_evidence';
      details.confidence = 0;
      return { score, possible, confidence: 0, details };
    }

    return { score, possible, confidence, details };
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
