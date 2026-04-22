'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import { generateQRCodeSVG, generateQRCodeViaAPI } from '@/lib/utils/qr-code';
import { AeLinkApi } from '@/lib/api';

const api = new AeLinkApi();

interface Campaign {
  _id: string;
  name: string;
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

export default function CreateLinkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignIdFromUrl = searchParams.get('campaignId');

  const [loading, setLoading] = useState(false);
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
    campaignId: campaignIdFromUrl || '',
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
    fetchCampaigns();
    fetchApps();
  }, []);

  useEffect(() => {
    generateQRCode();
  }, [formData.destinationUrl]);

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
        ...(formData.shortCode && { shortCode: formData.shortCode }),
        ...(formData.expiryDate && { expiresAt: formData.expiryDate }),
      };

      const link = await api.createLink(payload);
      router.push(`/dashboard/links/${link._id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-primary-600 hover:text-primary-700 font-medium mb-4"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Create Link</h1>
          <p className="text-slate-600 mt-2">
            Build a deep link with parameters and platform overrides
          </p>
        </div>

        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 mb-6 text-danger-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 space-y-4">
            {/* Campaign & Destination */}
            <div className="bg-card rounded-lg shadow-sm p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Campaign
                  </label>
                  <select
                    value={formData.campaignId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        campaignId: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">No App (Optional)</option>
                    {apps.map((app) => (
                      <option key={app._id} value={app._id}>
                        {app.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Select an app to use its store URLs for mobile redirects
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    The base URL where the link will redirect
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            <div className="bg-card rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Event/Content Data
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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

            {/* Collapsible Sections */}

            {/* UTM Parameters */}
            <div className="bg-card rounded-lg shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('utm')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition border-b border-slate-200"
              >
                <h3 className="text-lg font-semibold text-slate-900">
                  UTM Parameters
                </h3>
                <svg
                  className={`w-5 h-5 text-slate-600 transform transition ${
                    expandedSections.utm ? 'rotate-180' : ''
                  }`}
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
                <div className="p-6 space-y-4 border-t border-slate-200">
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              )}
            </div>

            {/* User Attribution */}
            <div className="bg-card rounded-lg shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('user')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition border-b border-slate-200"
              >
                <h3 className="text-lg font-semibold text-slate-900">
                  User Attribution
                </h3>
                <svg
                  className={`w-5 h-5 text-slate-600 transform transition ${
                    expandedSections.user ? 'rotate-180' : ''
                  }`}
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
                <div className="p-6 space-y-4 border-t border-slate-200">
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
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
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              )}
            </div>

            {/* Custom Parameters */}
            <div className="bg-card rounded-lg shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('custom')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition border-b border-slate-200"
              >
                <h3 className="text-lg font-semibold text-slate-900">
                  Custom Parameters
                </h3>
                <svg
                  className={`w-5 h-5 text-slate-600 transform transition ${
                    expandedSections.custom ? 'rotate-180' : ''
                  }`}
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
                <div className="p-6 space-y-4 border-t border-slate-200">
                  {Object.entries(formData.customParams).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex gap-2 items-start bg-slate-50 p-3 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {key}
                        </p>
                        <p className="text-xs text-slate-600">{value}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomParam(key)}
                        className="text-sm text-danger-600 hover:text-danger-700"
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
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={customParamValue}
                      onChange={(e) => setCustomParamValue(e.target.value)}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={addCustomParam}
                      className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-200 transition whitespace-nowrap"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Platform Overrides */}
            <div className="bg-card rounded-lg shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('platform')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition border-b border-slate-200"
              >
                <h3 className="text-lg font-semibold text-slate-900">
                  Platform Overrides
                </h3>
                <svg
                  className={`w-5 h-5 text-slate-600 transform transition ${
                    expandedSections.platform ? 'rotate-180' : ''
                  }`}
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
                <div className="p-6 space-y-6 border-t border-slate-200">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">
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
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
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
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">
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
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
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
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">
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
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Advanced */}
            <div className="bg-card rounded-lg shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('advanced')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition border-b border-slate-200"
              >
                <h3 className="text-lg font-semibold text-slate-900">
                  Advanced
                </h3>
                <svg
                  className={`w-5 h-5 text-slate-600 transform transition ${
                    expandedSections.advanced ? 'rotate-180' : ''
                  }`}
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
                <div className="p-6 space-y-4 border-t border-slate-200">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Custom Short Code
                    </label>
                    <input
                      type="text"
                      placeholder="Leave empty for auto-generated"
                      value={formData.shortCode}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          shortCode: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Only letters and numbers
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
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
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
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
                Create Link
              </Button>
            </div>
          </div>

          {/* Right Column - Live Preview */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-lg shadow-sm p-6 sticky top-8 space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Live Preview
              </h3>

              {formData.destinationUrl ? (
                <>
                  {/* Deep Link */}
                  <div>
                    <p className="text-xs text-slate-500 font-semibold mb-2">
                      DEEP LINK
                    </p>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <p className="text-sm font-mono text-primary-600 break-all">
                        {typeof window !== 'undefined' ? window.location.host : 'aelink.vercel.app'}/{formData.shortCode || '<auto>'}
                      </p>
                    </div>
                  </div>

                  {/* QR Code */}
                  {qrCodeUrl && (
                    <div>
                      <p className="text-xs text-slate-500 font-semibold mb-2">
                        QR CODE
                      </p>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 flex justify-center">
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
                    <p className="text-xs text-slate-500 font-semibold mb-2">
                      APP RECEIVES
                    </p>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <pre className="text-xs text-slate-700 overflow-auto max-h-48">
                        {JSON.stringify(getAppReceives(), null, 2) || '{}'}
                      </pre>
                    </div>
                  </div>

                  {/* Full URL */}
                  <div>
                    <p className="text-xs text-slate-500 font-semibold mb-2">
                      FULL URL
                    </p>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <p className="text-xs text-slate-700 break-all font-mono">
                        {getPreviewDeepLink()}
                      </p>
                    </div>
                  </div>

                  {/* Platform Breakdown */}
                  {(formData.androidUrl ||
                    formData.iosUrl ||
                    formData.webUrl) && (
                    <div>
                      <p className="text-xs text-slate-500 font-semibold mb-2">
                        PLATFORM ROUTES
                      </p>
                      <div className="space-y-2">
                        {formData.androidUrl && (
                          <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2">
                            <p className="font-medium text-blue-900">
                              Android
                            </p>
                            <p className="text-blue-700 truncate">
                              {formData.androidUrl}
                            </p>
                          </div>
                        )}
                        {formData.iosUrl && (
                          <div className="text-xs bg-purple-50 border border-purple-200 rounded p-2">
                            <p className="font-medium text-purple-900">iOS</p>
                            <p className="text-purple-700 truncate">
                              {formData.iosUrl}
                            </p>
                          </div>
                        )}
                        {formData.webUrl && (
                          <div className="text-xs bg-slate-100 border border-slate-300 rounded p-2">
                            <p className="font-medium text-slate-900">Web</p>
                            <p className="text-slate-700 truncate">
                              {formData.webUrl}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500 text-center py-12">
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
