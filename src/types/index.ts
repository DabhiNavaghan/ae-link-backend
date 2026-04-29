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

export interface IApp extends Document {
  tenantId: Types.ObjectId;
  name: string;
  android?: IAndroidConfig;
  ios?: IIosConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppDto {
  name: string;
  android?: Partial<IAndroidConfig>;
  ios?: Partial<IIosConfig>;
}

export interface UpdateAppDto {
  name?: string;
  android?: Partial<IAndroidConfig>;
  ios?: Partial<IIosConfig>;
  isActive?: boolean;
}

// ============================================================================
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
  userEmail?: string;
  userId?: string;
  couponCode?: string;
  referralCode?: string;
  custom?: Record<string, any>;
}

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
  shortCode: string;
  destinationUrl: string;
  linkType: LinkType;
  params: ILinkParams;
  platformOverrides: IPlatformOverrides;
  isActive: boolean;
  expiresAt?: Date;
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Click Types
// ============================================================================

export type DeviceOS = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'other';
export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type ActionTaken = 'app_opened' | 'store_redirect' | 'web_fallback';
export type ClickChannel = 'whatsapp' | 'email' | 'qr' | 'instagram' | 'sms' | 'push' | 'web' | 'direct' | 'facebook' | 'twitter' | 'tiktok' | 'youtube' | 'other';

export interface IDeviceInfo {
  os: DeviceOS;
  type: DeviceType;
  browser?: string;
  model?: string;
}

export interface IGeoInfo {
  country?: string;
  city?: string;
  region?: string;
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

export interface IMatchDetails {
  ipMatch?: boolean;
  ipScore?: number;
  uaHashMatch?: boolean;
  uaHashScore?: number;
  screenMatch?: boolean;
  screenScore?: number;
  languageMatch?: boolean;
  languageScore?: number;
  timezoneMatch?: boolean;
  timezoneScore?: number;
  proximityScore?: number;
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
  appId?: string;
  destinationUrl: string;
  linkType: LinkType;
  params?: ILinkParams;
  platformOverrides?: IPlatformOverrides;
  expiresAt?: string;
  shortCode?: string;
}

export interface UpdateLinkDto {
  destinationUrl?: string;
  params?: ILinkParams;
  platformOverrides?: IPlatformOverrides;
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
  conversions: {
    total: number;
    appOpen?: number;
    registration?: number;
    purchase?: number;
    view?: number;
  };
  deferredMatches: number;
  deferredMatchRate: number;
  topCountries: Array<{ country: string; clicks: number }>;
  topBrowsers: Array<{ browser: string; clicks: number }>;
  topReferrers: Array<{ referrer: string; clicks: number }>;
  clicksTrend?: Array<{ date: string; clicks: number }>;
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
  totalConversions: number;
  conversionRate: number;
  totalLinks: number;
  activeCampaigns: number;
  deferredLinksMatched: number;
  topLinks: Array<{
    linkId: string;
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
// Request Context (for middleware)
// ============================================================================

export interface AuthenticatedRequest {
  tenantId?: string;
  apiKey?: string;
  isAuthenticated: boolean;
}
