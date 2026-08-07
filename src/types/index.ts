import { Document, Types } from 'mongoose';

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

// ============================================================================
// Tenant Types
// ============================================================================

export interface IAppConfig {
  android?: {
    package: string;
    sha256: string;
    storeUrl: string;
  };
  ios?: {
    bundleId: string;
    teamId: string;
    appId: string;
    storeUrl: string;
  };
}

export interface ITenantSettings {
  fingerprintTtlHours: number;
  matchThreshold: number;
  defaultFallbackUrl?: string;
  enableDeferredDeepLink?: boolean;

  // ── Event tracking policy (see lib/utils/event-validation.ts for defaults) ──
  /** Last-touch lookback window for event attribution, in days. */
  attributionWindowDays?: number;
  /** How long raw events live before the TTL index removes them. Rollups are kept. */
  eventRetentionDays?: number;
  /** Trait keys this tenant is permitted to store. Unset falls back to a conservative default. */
  allowedTraitKeys?: string[];
  /**
   * Store the plaintext email on Identity in addition to the hash.
   * Off by default — turning it on needs a stated purpose and a retention limit.
   */
  storePlaintextEmail?: boolean;
  /** Ceiling on distinct event names. Unbounded names make the dataset unqueryable. */
  maxEventNames?: number;
  /**
   * Require an HMAC signature on every event carrying a monetary value.
   * Turn this on when revenue drives billing or partner payouts — a client key
   * lives inside a distributable app and cannot be trusted with money.
   */
  requireSignedRevenue?: boolean;
}

export interface ITenant extends Document {
  name: string;
  domain: string;
  apiKey: string;
  apiSecret: string;
  clerkUserId?: string;
  app: IAppConfig;
  settings: ITenantSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// App Types
// ============================================================================

export interface IAndroidConfig {
  package: string;
  sha256: string;
  storeUrl: string;
}

export interface IIosConfig {
  bundleId: string;
  teamId: string;
  appId: string;
  storeUrl: string;
}

/**
 * Marketing copy for the app-info interstitial — the page a click lands on
 * when store navigation is off and the link has no web destination to open.
 * Everything is optional; the interstitial falls back to the app's name and
 * its store URLs when a field is blank.
 */
export interface IAppInfo {
  /** One line under the app name, e.g. "Discover Events anywhere, anytime". */
  tagline?: string;
  /** A sentence or two on why to install. */
  description?: string;
  /** Square app icon, shown at the top of the interstitial. */
  iconUrl?: string;
  /**
   * A wide brand shot of the app — device mockups, a hero image, whatever the
   * marketing page uses. Shown beside the download options so the page sells
   * the app rather than just linking to it.
   */
  screenshotUrl?: string;
  /** The app's own landing page, linked as "learn more". */
  marketingUrl?: string;
}

/** The app-owned images served through the asset proxy. */
export type AppAssetKind = 'icon' | 'screenshot';

/** Where a store-page visitor was sent, if anywhere. */
export type StoreSentTo = 'ios' | 'android' | 'none';

/**
 * A visit to an app's public store page (/apps/:slug/store).
 *
 * Kept apart from Click on purpose: a store page belongs to an app, not to a
 * link, and Click.linkId is required. Folding these in would have made every
 * per-link and per-tenant click figure include visits that were never link
 * clicks, quietly shifting numbers people already rely on.
 */
export interface IAppVisit extends Document {
  appId: Types.ObjectId;
  tenantId: Types.ObjectId;
  ipAddress: string;
  userAgent: string;
  referer?: string;
  device: IDeviceInfo;
  geo?: IGeoInfo;
  /** Which store the page handed the visitor off to, if any. */
  sentTo: StoreSentTo;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  createdAt: Date;
}

export interface AppVisitAnalytics {
  appId: string;
  totalVisits: number;
  uniqueVisits: number;
  byOS: { android: number; ios: number; other: number };
  sentTo: { android: number; ios: number; none: number };
  topSources: Array<{ source: string; visits: number }>;
  topCountries: Array<{ country: string; visits: number }>;
  trend: Array<{ date: string; visits: number }>;
}

export interface IApp extends Document {
  tenantId: Types.ObjectId;
  name: string;
  slug?: string;
  apiKey: string;
  android?: IAndroidConfig;
  ios?: IIosConfig;
  info?: IAppInfo;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppDto {
  name: string;
  android?: Partial<IAndroidConfig>;
  ios?: Partial<IIosConfig>;
  info?: IAppInfo;
}

export interface UpdateAppDto {
  name?: string;
  slug?: string;
  android?: Partial<IAndroidConfig>;
  ios?: Partial<IIosConfig>;
  info?: IAppInfo;
  isActive?: boolean;
}

// ============================================================================
// Created By (embedded author info)
// ============================================================================

export interface ICreatedBy {
  name: string;
  email: string;
  avatarUrl?: string;
}

// Campaign Types
// ============================================================================

export interface ICampaign extends Document {
  tenantId: Types.ObjectId;
  appId?: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  status: 'active' | 'paused' | 'archived';
  fallbackUrl?: string;
  startDate?: Date;
  endDate?: Date;
  metadata?: Record<string, any>;
  createdBy?: ICreatedBy;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Link Types
// ============================================================================

export type LinkType = 'event' | 'ticket' | 'profile' | 'category' | 'custom';

export interface ILinkParams {
  eventId?: string;
  action?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  ct?: string;
  pt?: string;
  mt?: string;
  userEmail?: string;
  userId?: string;
  couponCode?: string;
  referralCode?: string;
  custom?: Record<string, any>;
}

/**
 * Whether a click may end at the app store when the app is not installed,
 * controlled separately for phones and for desktop browsers.
 *
 * Off means "never send this click to the store". The redirect resolves to the
 * link's own web destination instead — the dynamic `deepLink` param when the
 * click carries one, otherwise the stored destination, otherwise the static
 * web override. With no web destination of any kind the click lands on the
 * app-info interstitial rather than a dead end.
 *
 * Only ever consulted after the app declined the link, so a device that has
 * the app installed opens natively regardless of these flags.
 */
export interface IStoreRedirect {
  /** Android + iOS. Off → phones without the app stay on the web. */
  mobile: boolean;
  /** Desktop browsers. Off → no store listing hand-off; show the app info page. */
  web: boolean;
}

/** The two audiences the store toggle is resolved for. */
export type StorePlatform = 'mobile' | 'web';

export interface IPlatformOverrides {
  android?: {
    url: string;
    fallback?: string;
  };
  ios?: {
    url: string;
    fallback?: string;
  };
  web?: {
    url: string;
  };
}

export interface ILink extends Document {
  tenantId: Types.ObjectId;
  campaignId?: Types.ObjectId;
  appId?: Types.ObjectId;
  title?: string;
  shortCode: string;
  destinationUrl: string;
  linkType: LinkType;
  params: ILinkParams;
  platformOverrides: IPlatformOverrides;
  storeRedirect: IStoreRedirect;
  isActive: boolean;
  expiresAt?: Date;
  clickCount: number;
  createdBy?: ICreatedBy;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Click Types
// ============================================================================

export type DeviceOS = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'other';
export type DeviceType = 'mobile' | 'tablet' | 'desktop';
/**
 * How a click ended.
 *
 * `web_fallback` means the visitor was sent to a web URL; `app_info` means
 * they were shown the app info page because there was nothing to send them to
 * and the store was switched off. The two were once recorded identically,
 * which made it impossible to tell a working redirect from a dead end.
 */
export type ActionTaken =
  | 'app_opened'
  | 'app_installed'
  | 'store_redirect'
  | 'web_fallback'
  | 'app_info';
export type ClickChannel = 'whatsapp' | 'email' | 'qr' | 'instagram' | 'sms' | 'push' | 'web' | 'direct' | 'app_link' | 'facebook' | 'twitter' | 'tiktok' | 'youtube' | 'other';

export interface IDeviceInfo {
  os: DeviceOS;
  type: DeviceType;
  browser?: string;
  model?: string;
}

export interface IGeoInfo {
  /** Full English country name, e.g. "India" — analytics groups on this. */
  country?: string;
  /** ISO 3166-1 alpha-2, e.g. "IN". */
  countryCode?: string;
  city?: string;
  region?: string;
  /** ISO 3166-2 subdivision, e.g. "GJ". */
  regionCode?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  /** IANA zone, e.g. "Asia/Kolkata". */
  timezone?: string;
  /** Two-letter continent, e.g. "AS". */
  continent?: string;
  /** Which source produced this row — for auditing data quality. */
  source?: 'cloudflare' | 'ipapi' | 'none';
}

export interface IClick extends Document {
  linkId: Types.ObjectId;
  tenantId: Types.ObjectId;
  ipAddress: string;
  userAgent: string;
  referer?: string;
  channel: ClickChannel;
  device: IDeviceInfo;
  geo: IGeoInfo;
  isAppInstalled: boolean;
  actionTaken: ActionTaken;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ============================================================================
// Fingerprint Types
// ============================================================================

export interface IScreenInfo {
  width: number;
  height: number;
}

export interface IFingerprint extends Document {
  clickId?: Types.ObjectId;
  linkId: Types.ObjectId;
  tenantId: Types.ObjectId;
  ipAddress: string;
  userAgent?: string;
  userAgentHash: string;
  screen: IScreenInfo;
  /**
   * Screen size in PHYSICAL device pixels. Unlike CSS/logical pixels this is
   * invariant across the browser's device-scale-factor and Flutter's
   * devicePixelRatio, so it is the reliable cross-context screen signal.
   */
  physicalScreen?: IScreenInfo;
  language?: string;
  timezone?: string;
  timezoneOffset?: string;
  deviceMemory?: number;
  connectionType?: string;
  platform?: string;
  vendor?: string;
  hardwareConcurrency?: number;
  touchSupport?: boolean;
  colorDepth?: number;
  pixelRatio?: number;
  fingerprintHash: string;
  rawData?: Record<string, any>;
  source: 'browser' | 'app';
  status: 'pending' | 'matched' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}

export interface FingerprintData {
  ipAddress: string;
  userAgent: string;
  screen: { width: number; height: number };
  /** Screen size in physical device pixels (logical × pixelRatio). */
  physicalScreen?: { width: number; height: number };
  language?: string;
  timezone?: string;
  timezoneOffset?: string;
  deviceMemory?: number;
  connectionType?: string;
  platform?: string;
  vendor?: string;
  hardwareConcurrency?: number;
  touchSupport?: boolean;
  colorDepth?: number;
  pixelRatio?: number;
}

// ============================================================================
// Deferred Link Types
// ============================================================================

export type DeferredLinkStatus =
  | 'pending'
  | 'matched'
  | 'confirmed'
  | 'expired'
  | 'failed';

/**
 * Per-signal result of a fingerprint comparison.
 *
 * `possible` is 0 when the signal could not be evaluated because one side
 * didn't report it — those signals are excluded from the confidence
 * denominator so a missing value never counts as a mismatch.
 */
export interface IMatchSignal {
  /** Signal key: 'ip' | 'screen' | 'timezone' | 'language' | 'proximity' */
  key: string;
  /** Points earned. */
  earned: number;
  /** Points that were available for this signal (0 = not evaluable). */
  possible: number;
  /** How the two values compared, e.g. 'exact' | 'subnet_24' | 'none'. */
  matchType: string;
  /** Raw value seen on the app (install) side. */
  appValue?: string | number | null;
  /** Raw value seen on the web (click) side. */
  webValue?: string | number | null;
}

export interface IMatchDetails {
  ipMatch?: boolean;
  ipScore?: number;
  ipMatchType?: string;
  uaHashMatch?: boolean;
  uaHashScore?: number;
  screenMatch?: boolean;
  screenScore?: number;
  screenMatchType?: string;
  languageMatch?: boolean;
  languageScore?: number;
  timezoneMatch?: boolean;
  timezoneScore?: number;
  proximityScore?: number;
  /** Raw points earned across all signals. */
  totalScore?: number;
  /** Points that were available given which signals both sides reported. */
  possibleScore?: number;
  /** `totalScore / possibleScore * 100`, rounded — the headline percentage. */
  confidence?: number;
  /** Per-signal breakdown, for the admin match-analysis view. */
  signals?: IMatchSignal[];
  /** Set when the candidate was rejected outright (platform/no-evidence). */
  rejectedReason?: string;
  [key: string]: any;
}

export interface IDeferredLink extends Document {
  fingerprintId: Types.ObjectId;
  linkId: Types.ObjectId;
  tenantId: Types.ObjectId;
  params: ILinkParams;
  destinationUrl: string;
  status: DeferredLinkStatus;
  matchedAt?: Date;
  confirmedAt?: Date;
  deviceId?: string;
  matchScore: number;
  matchDetails: IMatchDetails;
  expiresAt: Date;
  createdAt: Date;
}

// ============================================================================
// Conversion Types
// ============================================================================

export type ConversionType =
  | 'app_open'
  | 'registration'
  | 'ticket_purchase'
  | 'event_view'
  | 'custom';

export interface IConversion extends Document {
  linkId: Types.ObjectId;
  clickId?: Types.ObjectId;
  tenantId: Types.ObjectId;
  deferredLinkId?: Types.ObjectId;
  conversionType: ConversionType;
  deviceId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ============================================================================
// Request/Response DTOs
// ============================================================================

export interface CreateLinkDto {
  campaignId?: string;
  appId: string;
  title: string;
  destinationUrl?: string;
  linkType?: LinkType;
  params?: ILinkParams;
  platformOverrides?: IPlatformOverrides;
  /** Both sides default to true. See IStoreRedirect. */
  storeRedirect?: Partial<IStoreRedirect>;
  expiresAt?: string;
  shortCode?: string;
  createdBy?: ICreatedBy;
}

export interface UpdateLinkDto {
  title?: string;
  destinationUrl?: string;
  params?: ILinkParams;
  platformOverrides?: IPlatformOverrides;
  storeRedirect?: Partial<IStoreRedirect>;
  isActive?: boolean;
  expiresAt?: string;
}

export interface CreateCampaignDto {
  name: string;
  slug: string;
  appId?: string;
  description?: string;
  fallbackUrl?: string;
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, any>;
  createdBy?: ICreatedBy;
}

export interface UpdateCampaignDto {
  name?: string;
  slug?: string;
  appId?: string;
  description?: string;
  status?: 'active' | 'paused' | 'archived';
  fallbackUrl?: string;
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, any>;
}

export interface RegisterTenantDto {
  name: string;
  domain: string;
  app: IAppConfig;
  settings?: Partial<ITenantSettings>;
}

export interface FingerprintMatchDto {
  tenantId: string;
  fingerprint: FingerprintData;
}

export interface DeferredLinkConfirmDto {
  deferredLinkId: string;
  deviceId: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface LinkAnalytics {
  linkId: string;
  shortCode: string;
  totalClicks: number;
  clicks: {
    unique?: number;
    web?: number;
    android?: number;
    ios?: number;
    other?: number;
  };
  devices: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  actions: {
    appOpened: number;
    appInstalled: number;
    storeRedirect: number;
    webFallback: number;
    /** Shown the app info page — nothing to open, store off limits. */
    appInfo: number;
  };
  /** App info page views split by whether the click carried a deep link. */
  appInfoViews: {
    total: number;
    withDeepLink: number;
    withoutDeepLink: number;
  };
  conversions: {
    total: number;
    appOpen?: number;
    registration?: number;
    purchase?: number;
    view?: number;
  };
  installs: {
    total: number;
    android: number;
    ios: number;
  };
  deferredMatches: number;
  deferredMatchRate: number;
  channels: Array<{ channel: string; clicks: number }>;
  topCountries: Array<{ country: string; clicks: number }>;
  topBrowsers: Array<{ browser: string; clicks: number }>;
  topReferrers: Array<{ referrer: string; clicks: number }>;
  topDeepLinks: Array<{ url: string; clicks: number; appOpened: number; installs: number }>;
  topRefParams: Array<{ ref: string; clicks: number; appOpened: number; installs: number }>;
  topUtmSources: Array<{ source: string; clicks: number; appOpened: number; installs: number }>;
  topUtmMediums: Array<{ medium: string; clicks: number; appOpened: number; installs: number }>;
  topUtmCampaigns: Array<{ campaign: string; clicks: number; appOpened: number; installs: number }>;
  customParams: Array<{ key: string; value: string; clicks: number; appOpened: number; installs: number }>;
  clicksTrend?: Array<{ date: string; clicks: number }>;
  installsTrend?: Array<{ date: string; installs: number }>;
  createdAt?: Date;
  lastClicked?: Date;
}

export interface CampaignAnalytics {
  campaignId: string;
  campaignName: string;
  totalLinks: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  deferredMatchRate: number;
  byLinkType: Record<LinkType, { clicks: number; conversions: number }>;
  topLinks: Array<{
    shortCode: string;
    clicks: number;
    conversions: number;
  }>;
  topReferrers: Array<{ referrer: string; clicks: number }>;
}

export interface DashboardOverview {
  totalClicks: number;
  totalInstalls: number;
  totalOpens: number;
  totalConversions: number;
  conversionRate: number;
  installRate: number;
  totalLinks: number;
  activeCampaigns: number;
  deferredLinksMatched: number;
  // SDK install metrics
  newInstalls: number;
  totalDevices: number;
  totalAppLaunches: number;
  topLinks: Array<{
    linkId: string;
    title?: string;
    shortCode: string;
    destinationUrl: string;
    campaignName?: string;
    clicks: number;
    conversions: number;
  }>;
  topReferrers: Array<{
    referrer: string;
    clicks: number;
    percentage: number;
  }>;
  topCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    channels: string;
    linkCount: number;
    clicks: number;
    conversions: number;
    conversionRate: number;
  }>;
  clicksTrend: Array<{
    date: string;
    clicks: number;
    conversions: number;
    opens: number;
    installs: number;
    appLaunches: number;
  }>;
  channelBreakdown: Array<{
    channel: string;
    clicks: number;
    percentage: number;
  }>;
  platformBreakdown: {
    android: number;
    ios: number;
    web: number;
  };
  recentClicks: Array<{
    time: string;
    platform: string;
    campaign: string;
    action: string;
    channel: string;
  }>;
}

// ============================================================================
// Team Member Types
// ============================================================================

export type TeamRole = 'administrator' | 'admin' | 'editor' | 'analyst';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface ITeamMember extends Document {
  tenantId: Types.ObjectId;
  email: string;
  name?: string;
  role: TeamRole;
  status: InviteStatus;
  clerkUserId?: string;
  allowedApps: Types.ObjectId[]; // empty = all apps; otherwise only these app IDs
  invitedBy: string;
  inviteToken: string;
  invitedAt: Date;
  acceptedAt?: Date;
  expiresAt: Date;
}

// ============================================================================
// Request Context (for middleware)
// ============================================================================

export interface AuthenticatedRequest {
  tenantId?: string;
  apiKey?: string;
  isAuthenticated: boolean;
}
