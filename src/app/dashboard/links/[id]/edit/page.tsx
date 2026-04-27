'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import { generateQRCodeSVG } from '@/lib/utils/qr-code';
import { SmartLinkApi } from '@/lib/api';

const api = new SmartLinkApi();

interface Campaign {
  _id: string;
  name: string;
  slug: string;
  metadata?: Record<string, string>;
}

interface AppOption {
  _id: string;
  name: string;
}

interface FormData {
  appId: string;
  campaignId: string;
  destinationUrl: string;
  linkType: 'event' | 'ticket' | 'profile' | 'category' | 'custom';
  eventId: string;
  action: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  userEmail: string;
  userId: string;
  couponCode: string;
  referralCode: string;
  customParams: Record<string, string>;
  androidUrl: string;
  androidFallback: string;
  iosUrl: string;
  iosFallback: string;
  webUrl: string;
  shortCode: string;
  expiryDate: string;
}

const LINK_TYPES = ['event', 'ticket', 'profile', 'category', 'custom'];
const ACTIONS = [
  'view_event',
  'view_ticket',
  'buy_ticket',
  'view_profile',
  'view_category',
  'custom',
];

export default function EditLinkPage() {
  const router = useRouter();
  const params = useParams();
  const linkId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [customParamKey, setCustomParamKey] = useState('');
  const [customParamValue, setCustomParamValue] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    utm: false,
    user: false,
    custom: false,
    platform: false,
    advanced: false,
  });

  const [formData, setFormData] = useState<FormData>({
    appId: '',
    campaignId: '',
    destinationUrl: '',
    linkType: 'event',
    eventId: '',
    action: 'view_event',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    utmTerm: '',
    utmContent: '',
    userEmail: '',
    userId: '',
    couponCode: '',
    referralCode: '',
    customParams: {},
    androidUrl: '',
    androidFallback: '',
    iosUrl: '',
    iosFallback: '',
    webUrl: '',
    shortCode: '',
    expiryDate: '',
  });

  useEffect(() => {
    Promise.all([fetchLink(), fetchCampaigns(), fetchApps()]).finally(() => {
      setPageLoading(false);
    });
  }, [linkId]);

  useEffect(() => {
    generateQRCode();
  }, [formData.destinationUrl]);

  async function fetchLink() {
    try {
      const link = await api.getLink(linkId);
      const typedLink = link as any;

      setFormData({
        appId: typedLink.appId || '',
        campaignId: typedLink.campaignId || '',
        destinationUrl: typedLink.destinationUrl || '',
        linkType: typedLink.linkType || 'event',
        eventId: typedLink.params?.eventId || '',
        action: typedLink.params?.action || 'view_event',
        utmSource: typedLink.params?.utmSource || '',
        utmMedium: typedLink.params?.utmMedium || '',
        utmCampaign: typedLink.params?.utmCampaign || '',
        utmTerm: typedLink.params?.utmTerm || '',
        utmContent: typedLink.params?.utmContent || '',
        userEmail: typedLink.params?.userEmail || '',
        userId: typedLink.params?.userId || '',
        couponCode: typedLink.params?.couponCode || '',
        referralCode: typedLink.params?.referralCode || '',
        customParams: typedLink.params?.custom || {},
        androidUrl: typedLink.platformOverrides?.android?.url || '',
        androidFallback: typedLink.platformOverrides?.android?.fallback || '',
        iosUrl: typedLink.platformOverrides?.ios?.url || '',
        iosFallback: typedLink.platformOverrides?.ios?.fallback || '',
        webUrl: typedLink.platformOverrides?.web?.url || '',
        shortCode: typedLink.shortCode || '',
        expiryDate: typedLink.expiresAt ? typedLink.expiresAt.split('T')[0] : '',
      });
    } catch (err) {
      console.error('Failed to load link', err);
      setError('Failed to load link');
    }
  }

  async function fetchCampaigns() {
    try {
      const data = await api.listCampaigns({ limit: 100 });
      setCampaigns((data.campaigns || []) as unknown as Campaign[]);
    } catch (err) {
      console.error('Failed to load campaigns', err);
    }
  }

  async function fetchApps() {
    try {
      const data = await api.listApps();
      setApps((data.apps || []) as unknown as AppOption[]);
    } catch (err) {
      console.error('Failed to load apps', err);
    }
  }

  async function generateQRCode() {
    if (!formData.destinationUrl) {
      setQrCodeUrl('');
      return;
    }

    try {
      const svg = generateQRCodeSVG(formData.destinationUrl, 200);
      setQrCodeUrl(`data:image/svg+xml;base64,${btoa(svg)}`);
    } catch (err) {
      console.error('Failed to generate QR code', err);
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const addCustomParam = () => {
    if (customParamKey.trim()) {
      setFormData((prev) => ({
        ...prev,
        customParams: {
          ...prev.customParams,
          [customParamKey]: customParamValue,
        },
      }));
      setCustomParamKey('');
      setCustomParamValue('');
    }
  };

  const removeCustomParam = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      customParams: Object.fromEntries(
        Object.entries(prev.customParams).filter(([k]) => k !== key)
      ),
    }));
  };

  const getPreviewDeepLink = () => {
    const url = new URL(formData.destinationUrl || 'https://allevents.in');
    const params = new URLSearchParams();

    if (formData.eventId) params.append('eventId', formData.eventId);
    if (formData.action) params.append('action', formData.action);
    if (formData.utmSource) params.append('utm_source', formData.utmSource);
    if (formData.utmMedium) params.append('utm_medium', formData.utmMedium);
    if (formData.utmCampaign)
      params.append('utm_campaign', formData.utmCampaign);
    if (formData.utmTerm) params.append('utm_term', formData.utmTerm);
    if (formData.utmContent) params.append('utm_content', formData.utmContent);
    if (formData.userEmail) params.append('userEmail', formData.userEmail);
    if (formData.userId) params.append('userId', formData.userId);
    if (formData.couponCode) params.append('couponCode', formData.couponCode);
    if (formData.referralCode)
      params.append('referralCode', formData.referralCode);

    Object.entries(formData.customParams).forEach(([key, value]) => {
      params.append(key, value);
    });

    const query = params.toString();
    return `${url.toString()}${query ? '?' + query : ''}`;
  };

  const getAppReceives = () => {
    const data: Record<string, any> = {};

    if (formData.eventId) data.eventId = formData.eventId;
    if (formData.action) data.action = formData.action;
    if (formData.utmSource) data.utm_source = formData.utmSource;
    if (formData.utmMedium) data.utm_medium = formData.utmMedium;
    if (formData.utmCampaign) data.utm_campaign = formData.utmCampaign;
    if (formData.utmTerm) data.utm_term = formData.utmTerm;
    if (formData.utmContent) data.utm_content = formData.utmContent;
    if (formData.userEmail) data.userEmail = formData.userEmail;
    if (formData.userId) data.userId = formData.userId;
    if (formData.couponCode) data.couponCode = formData.couponCode;
    if (formData.referralCode) data.referralCode = formData.referralCode;

    Object.entries(formData.customParams).forEach(([key, value]) => {
      data[key] = value;
    });

    return data;
  };

  const handleCampaignChange = (campaignId: string) => {
    const selectedCampaign = campaigns.find(c => c._id === campaignId);

    const updates: any = { campaignId };

    // Auto-fill utmCampaign if not already set
    if (selectedCampaign?.slug && !formData.utmCampaign) {
      updates.utmCampaign = selectedCampaign.slug;
    }

    // Auto-fill utmSource from metadata if available
    if (selectedCampaign?.metadata?.utmSource && !formData.utmSource) {
      updates.utmSource = selectedCampaign.metadata.utmSource;
    }

    // Auto-fill utmMedium from metadata if available
    if (selectedCampaign?.metadata?.utmMedium && !formData.utmMedium) {
      updates.utmMedium = selectedCampaign.metadata.utmMedium;
    }

    // Expand UTM section if any values were auto-filled
    if (Object.keys(updates).length > 1) {
      setExpandedSections((prev) => ({
        ...prev,
        utm: true,
      }));
    }

    setFormData((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.destinationUrl.trim()) {
      setError('Destination URL is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload: any = {
        destinationUrl: formData.destinationUrl,
        linkType: formData.linkType,
        params: {
          ...(formData.eventId && { eventId: formData.eventId }),
          ...(formData.action && { action: formData.action }),
          ...(formData.utmSource && { utmSource: formData.utmSource }),
          ...(formData.utmMedium && { utmMedium: formData.utmMedium }),
          ...(formData.utmCampaign && { utmCampaign: formData.utmCampaign }),
          ...(formData.utmTerm && { utmTerm: formData.utmTerm }),
          ...(formData.utmContent && { utmContent: formData.utmContent }),
          ...(formData.userEmail && { userEmail: formData.userEmail }),
          ...(formData.userId && { userId: formData.userId }),
          ...(formData.couponCode && { couponCode: formData.couponCode }),
          ...(formData.referralCode && {
            referralCode: formData.referralCode,
          }),
          ...(Object.keys(formData.customParams).length > 0 && {
            custom: formData.customParams,
          }),
        },
        platformOverrides: {
          ...(formData.androidUrl && {
            android: {
              url: formData.androidUrl,
              ...(formData.androidFallback && { fallback: formData.androidFallback }),
            },
          }),
          ...(formData.iosUrl && {
            ios: {
              url: formData.iosUrl,
              ...(formData.iosFallback && { fallback: formData.iosFallback }),
            },
          }),
          ...(formData.webUrl && { web: { url: formData.webUrl } }),
        },
        ...(formData.appId && { appId: formData.appId }),
        ...(formData.campaignId && { campaignId: formData.campaignId }),
        ...(formData.expiryDate && { expiresAt: formData.expiryDate }),
      };

      await api.updateLink(linkId, payload);
      router.push(`/dashboard/links/${linkId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update link');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-base p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 rounded-full animate-spin mb-4" style={{ borderColor: 'var(--color-primary-light)', borderTopColor: 'var(--color-primary)' }}></div>
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading link...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="font-medium mb-4"
            style={{ color: 'var(--color-primary)' }}
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>Edit Link</h1>
          <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            Update your deep link parameters and platform overrides
          </p>
        </div>

        {error && (
          <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--color-danger)', borderWidth: '1px', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 space-y-4">
            {/* Campaign & Destination */}
            <div className="rounded-lg shadow-sm p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    Campaign
                  </label>
                  <select
                    value={formData.campaignId}
                    onChange={(e) => handleCampaignChange(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px', '--tw-ring-color': 'var(--color-primary)' } as any}
                  >
                    <option value="">No Campaign (Optional)</option>
                    {campaigns.map((camp) => (
                      <option key={camp._id} value={camp._id}>
                        {camp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    App
                  </label>
                  <select
                    value={formData.appId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        appId: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px', '--tw-ring-color': 'var(--color-primary)' } as any}
                  >
                    <option value="">No App (Optional)</option>
                    {apps.map((app) => (
                      <option key={app._id} value={app._id}>
                        {app.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    Destination URL *
                  </label>
                  <input
                    type="url"
                    value={formData.destinationUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        destinationUrl: e.target.value,
                      }))
                    }
                    placeholder="https://allevents.in"
                    className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px', '--tw-ring-color': 'var(--color-primary)' } as any}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    Link Type
                  </label>
                  <select
                    value={formData.linkType}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        linkType: e.target.value as any,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px', '--tw-ring-color': 'var(--color-primary)' } as any}
                  >
                    {LINK_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Event/Content Data */}
            <div className="rounded-lg shadow-sm p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                Event/Content Data
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    Event ID
                  </label>
                  <input
                    type="text"
                    value={formData.eventId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        eventId: e.target.value,
                      }))
                    }
                    placeholder="evt_123456"
                    className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px', '--tw-ring-color': 'var(--color-primary)' } as any}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    Action
                  </label>
                  <select
                    value={formData.action}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        action: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px', '--tw-ring-color': 'var(--color-primary)' } as any}
                  >
                    {ACTIONS.map((action) => (
                      <option key={action} value={action}>
                        {action.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* UTM Parameters */}
            <div className="rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <button
                type="button"
                onClick={() => toggleSection('utm')}
                className="w-full px-6 py-4 flex items-center justify-between transition"
                style={{ borderBottomColor: 'var(--color-border)', borderBottomWidth: '1px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                  UTM Parameters
                </h3>
                <svg
                  className={`w-5 h-5 transform transition ${
                    expandedSections.utm ? 'rotate-180' : ''
                  }`}
                  style={{ color: 'var(--color-text-secondary)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </button>
              {expandedSections.utm && (
                <div className="p-6 space-y-4" style={{ borderTopColor: 'var(--color-border)', borderTopWidth: '1px' }}>
                  <input
                    type="text"
                    placeholder="UTM Source (e.g., facebook)"
                    value={formData.utmSource}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        utmSource: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                  />
                  <input
                    type="text"
                    placeholder="UTM Medium (e.g., cpc)"
                    value={formData.utmMedium}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        utmMedium: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                  />
                  <input
                    type="text"
                    placeholder="UTM Campaign"
                    value={formData.utmCampaign}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        utmCampaign: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                  />
                  <input
                    type="text"
                    placeholder="UTM Term"
                    value={formData.utmTerm}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        utmTerm: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                  />
                  <input
                    type="text"
                    placeholder="UTM Content"
                    value={formData.utmContent}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        utmContent: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                  />
                </div>
              )}
            </div>

            {/* User Attribution */}
            <div className="rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <button
                type="button"
                onClick={() => toggleSection('user')}
                className="w-full px-6 py-4 flex items-center justify-between transition"
                style={{ borderBottomColor: 'var(--color-border)', borderBottomWidth: '1px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                  User Attribution
                </h3>
                <svg
                  className={`w-5 h-5 transform transition ${
                    expandedSections.user ? 'rotate-180' : ''
                  }`}
                  style={{ color: 'var(--color-text-secondary)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </button>
              {expandedSections.user && (
                <div className="p-6 space-y-4" style={{ borderTopColor: 'var(--color-border)', borderTopWidth: '1px' }}>
                  <input
                    type="email"
                    placeholder="User Email"
                    value={formData.userEmail}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        userEmail: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                  />
                  <input
                    type="text"
                    placeholder="User ID"
                    value={formData.userId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        userId: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                  />
                  <input
                    type="text"
                    placeholder="Coupon Code"
                    value={formData.couponCode}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        couponCode: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                  />
                  <input
                    type="text"
                    placeholder="Referral Code"
                    value={formData.referralCode}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        referralCode: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                  />
                </div>
              )}
            </div>

            {/* Custom Parameters */}
            <div className="rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <button
                type="button"
                onClick={() => toggleSection('custom')}
                className="w-full px-6 py-4 flex items-center justify-between transition"
                style={{ borderBottomColor: 'var(--color-border)', borderBottomWidth: '1px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                  Custom Parameters
                </h3>
                <svg
                  className={`w-5 h-5 transform transition ${
                    expandedSections.custom ? 'rotate-180' : ''
                  }`}
                  style={{ color: 'var(--color-text-secondary)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </button>
              {expandedSections.custom && (
                <div className="p-6 space-y-4" style={{ borderTopColor: 'var(--color-border)', borderTopWidth: '1px' }}>
                  {Object.entries(formData.customParams).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex gap-2 items-start p-3 rounded-lg"
                      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {key}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{value}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomParam(key)}
                        className="text-sm"
                        style={{ color: 'var(--color-danger)' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Key"
                      value={customParamKey}
                      onChange={(e) => setCustomParamKey(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-lg text-sm"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={customParamValue}
                      onChange={(e) => setCustomParamValue(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-lg text-sm"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                    />
                    <button
                      type="button"
                      onClick={addCustomParam}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap"
                      style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Platform Overrides */}
            <div className="rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <button
                type="button"
                onClick={() => toggleSection('platform')}
                className="w-full px-6 py-4 flex items-center justify-between transition"
                style={{ borderBottomColor: 'var(--color-border)', borderBottomWidth: '1px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                  Platform Overrides
                </h3>
                <svg
                  className={`w-5 h-5 transform transition ${
                    expandedSections.platform ? 'rotate-180' : ''
                  }`}
                  style={{ color: 'var(--color-text-secondary)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </button>
              {expandedSections.platform && (
                <div className="p-6 space-y-6" style={{ borderTopColor: 'var(--color-border)', borderTopWidth: '1px' }}>
                  <div>
                    <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                      Android
                    </h4>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Android App URL"
                        value={formData.androidUrl}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            androidUrl: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 rounded-lg text-sm"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                      />
                      <input
                        type="text"
                        placeholder="Android Store Fallback"
                        value={formData.androidFallback}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            androidFallback: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 rounded-lg text-sm"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                      iOS
                    </h4>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="iOS App URL"
                        value={formData.iosUrl}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            iosUrl: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 rounded-lg text-sm"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                      />
                      <input
                        type="text"
                        placeholder="iOS Store Fallback"
                        value={formData.iosFallback}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            iosFallback: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 rounded-lg text-sm"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                      Web
                    </h4>
                    <input
                      type="text"
                      placeholder="Web URL (overrides destination URL)"
                      value={formData.webUrl}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          webUrl: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 rounded-lg text-sm"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Advanced */}
            <div className="rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <button
                type="button"
                onClick={() => toggleSection('advanced')}
                className="w-full px-6 py-4 flex items-center justify-between transition"
                style={{ borderBottomColor: 'var(--color-border)', borderBottomWidth: '1px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                  Advanced
                </h3>
                <svg
                  className={`w-5 h-5 transform transition ${
                    expandedSections.advanced ? 'rotate-180' : ''
                  }`}
                  style={{ color: 'var(--color-text-secondary)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </button>
              {expandedSections.advanced && (
                <div className="p-6 space-y-4" style={{ borderTopColor: 'var(--color-border)', borderTopWidth: '1px' }}>
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          expiryDate: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 rounded-lg text-sm"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)', borderWidth: '1px' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="lg"
                fullWidth
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                type="submit"
                isLoading={loading}
                disabled={loading}
              >
                Update Link
              </Button>
            </div>
          </div>

          {/* Right Column - Live Preview */}
          <div className="lg:col-span-1">
            <div className="rounded-lg shadow-sm p-6 sticky top-8 space-y-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                Live Preview
              </h3>

              {formData.destinationUrl ? (
                <>
                  {/* Deep Link */}
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                      DEEP LINK
                    </p>
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderWidth: '1px' }}>
                      <p className="text-sm font-mono break-all" style={{ color: 'var(--color-primary)' }}>
                        {typeof window !== 'undefined' ? window.location.host : 'smartlink.vercel.app'}/{formData.shortCode}
                      </p>
                    </div>
                  </div>

                  {/* QR Code */}
                  {qrCodeUrl && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                        QR CODE
                      </p>
                      <div className="rounded-lg p-4 flex justify-center" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderWidth: '1px' }}>
                        <img
                          src={qrCodeUrl}
                          alt="QR Code"
                          className="w-32 h-32"
                        />
                      </div>
                    </div>
                  )}

                  {/* App Receives */}
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                      APP RECEIVES
                    </p>
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderWidth: '1px' }}>
                      <pre className="text-xs overflow-auto max-h-48" style={{ color: 'var(--color-text-secondary)' }}>
                        {JSON.stringify(getAppReceives(), null, 2) || '{}'}
                      </pre>
                    </div>
                  </div>

                  {/* Full URL */}
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                      FULL URL
                    </p>
                    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderWidth: '1px' }}>
                      <p className="text-xs break-all font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                        {getPreviewDeepLink()}
                      </p>
                    </div>
                  </div>

                  {/* Platform Breakdown */}
                  {(formData.androidUrl ||
                    formData.iosUrl ||
                    formData.webUrl) && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                        PLATFORM ROUTES
                      </p>
                      <div className="space-y-2">
                        {formData.androidUrl && (
                          <div className="text-xs rounded p-2" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)', borderWidth: '1px' }}>
                            <p className="font-medium" style={{ color: 'rgba(59, 130, 246, 1)' }}>
                              Android
                            </p>
                            <p className="truncate" style={{ color: 'rgba(59, 130, 246, 0.8)' }}>
                              {formData.androidUrl}
                            </p>
                          </div>
                        )}
                        {formData.iosUrl && (
                          <div className="text-xs rounded p-2" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.3)', borderWidth: '1px' }}>
                            <p className="font-medium" style={{ color: 'rgba(168, 85, 247, 1)' }}>iOS</p>
                            <p className="truncate" style={{ color: 'rgba(168, 85, 247, 0.8)' }}>
                              {formData.iosUrl}
                            </p>
                          </div>
                        )}
                        {formData.webUrl && (
                          <div className="text-xs rounded p-2" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderWidth: '1px' }}>
                            <p className="font-medium" style={{ color: 'var(--color-text)' }}>Web</p>
                            <p className="truncate" style={{ color: 'var(--color-text-secondary)' }}>
                              {formData.webUrl}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
                  Enter a destination URL to see preview
                </p>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
