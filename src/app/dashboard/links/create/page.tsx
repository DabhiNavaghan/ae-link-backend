'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  android?: { package?: string; storeUrl?: string };
  ios?: { bundleId?: string; storeUrl?: string };
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
const ACTIONS = ['view_event', 'view_ticket', 'buy_ticket', 'view_profile', 'view_category', 'custom'];

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  padding: '10px 12px',
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'var(--color-text-tertiary)',
  marginBottom: 6,
};

export default function CreateLinkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignIdFromUrl = searchParams.get('campaignId');
  const duplicateId = searchParams.get('duplicate');

  const [loading, setLoading] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(!!duplicateId);
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

  useEffect(() => { fetchCampaigns(); fetchApps(); }, []);
  useEffect(() => { generateQRCode(); }, [formData.destinationUrl]);

  // Duplicate pre-fill
  useEffect(() => {
    if (!duplicateId) return;
    (async () => {
      try {
        setDuplicateLoading(true);
        const source = await api.getLink(duplicateId);
        const params = (source as any).params || {};
        const platformOverrides = (source as any).platformOverrides || {};
        setFormData({
          appId: (source as any).appId || '',
          campaignId: (source as any).campaignId || '',
          destinationUrl: (source as any).destinationUrl || '',
          linkType: (source as any).linkType || 'event',
          eventId: params.eventId || '',
          action: params.action || 'view_event',
          utmSource: params.utmSource || '',
          utmMedium: params.utmMedium || '',
          utmCampaign: params.utmCampaign || '',
          utmTerm: params.utmTerm || '',
          utmContent: params.utmContent || '',
          userEmail: params.userEmail || '',
          userId: params.userId || '',
          couponCode: params.couponCode || '',
          referralCode: params.referralCode || '',
          customParams: params.custom || {},
          androidUrl: platformOverrides.android?.url || '',
          androidFallback: platformOverrides.android?.fallback || '',
          iosUrl: platformOverrides.ios?.url || '',
          iosFallback: platformOverrides.ios?.fallback || '',
          webUrl: platformOverrides.web?.url || '',
          shortCode: '', // leave empty for auto-generation
          expiryDate: (source as any).expiresAt ? new Date((source as any).expiresAt).toISOString().split('T')[0] : '',
        });
        // Expand sections that have data
        setExpandedSections({
          utm: !!(params.utmSource || params.utmMedium || params.utmCampaign || params.utmTerm || params.utmContent),
          user: !!(params.userEmail || params.userId || params.couponCode || params.referralCode),
          custom: !!(params.custom && Object.keys(params.custom).length > 0),
          platform: !!(platformOverrides.android || platformOverrides.ios || platformOverrides.web),
          advanced: false,
        });
      } catch (err: any) {
        setError('Failed to load source link for duplication');
      } finally {
        setDuplicateLoading(false);
      }
    })();
  }, [duplicateId]);

  async function fetchCampaigns() {
    try {
      const data = await api.listCampaigns({ limit: 100 });
      setCampaigns((data.campaigns || []) as unknown as Campaign[]);
    } catch (err) { console.error('Failed to load campaigns', err); }
  }

  async function fetchApps() {
    try {
      const data = await api.listApps();
      setApps((data.apps || []) as unknown as AppOption[]);
    } catch (err) { console.error('Failed to load apps', err); }
  }

  async function generateQRCode() {
    if (!formData.destinationUrl) { setQrCodeUrl(''); return; }
    try {
      const svg = generateQRCodeSVG(formData.destinationUrl, 200);
      setQrCodeUrl(`data:image/svg+xml;base64,${btoa(svg)}`);
    } catch (err) { console.error('Failed to generate QR code', err); }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const addCustomParam = () => {
    if (customParamKey.trim()) {
      setFormData((prev) => ({ ...prev, customParams: { ...prev.customParams, [customParamKey]: customParamValue } }));
      setCustomParamKey(''); setCustomParamValue('');
    }
  };

  const removeCustomParam = (key: string) => {
    setFormData((prev) => ({ ...prev, customParams: Object.fromEntries(Object.entries(prev.customParams).filter(([k]) => k !== key)) }));
  };

  const handleCampaignChange = (campaignId: string) => {
    const selected = campaigns.find(c => c._id === campaignId);
    const updates: any = { campaignId };
    if (selected?.metadata?.utmCampaign) {
      updates.utmCampaign = selected.metadata.utmCampaign;
    } else if (selected?.slug) {
      updates.utmCampaign = selected.slug;
    }
    if (selected?.metadata?.utmSource && !formData.utmSource) updates.utmSource = selected.metadata.utmSource;
    if (selected?.metadata?.utmMedium && !formData.utmMedium) updates.utmMedium = selected.metadata.utmMedium;
    if (Object.keys(updates).length > 1) setExpandedSections((prev) => ({ ...prev, utm: true }));
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleAppChange = (appId: string) => {
    const selected = apps.find(a => a._id === appId);
    const updates: any = { appId };
    if (selected?.android?.package) {
      updates.androidUrl = `allevents://app?package=${selected.android.package}`;
      if (selected.android.storeUrl) updates.androidFallback = selected.android.storeUrl;
    }
    if (selected?.ios?.bundleId) {
      updates.iosUrl = `allevents://app?bundleId=${selected.ios.bundleId}`;
      if (selected.ios.storeUrl) updates.iosFallback = selected.ios.storeUrl;
    }
    if (selected?.android || selected?.ios) {
      setExpandedSections((prev) => ({ ...prev, platform: true }));
    }
    if (!appId) {
      updates.androidUrl = '';
      updates.androidFallback = '';
      updates.iosUrl = '';
      updates.iosFallback = '';
    }
    setFormData((prev) => ({ ...prev, ...updates }));
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
    Object.entries(formData.customParams).forEach(([key, value]) => { data[key] = value; });
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.campaignId) { setError('Campaign is required'); return; }
    if (!formData.appId) { setError('App is required'); return; }
    if (!formData.destinationUrl.trim()) { setError('Destination URL is required'); return; }

    try {
      setLoading(true); setError(null);
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
          ...(formData.referralCode && { referralCode: formData.referralCode }),
          ...(Object.keys(formData.customParams).length > 0 && { custom: formData.customParams }),
        },
        platformOverrides: {
          ...(formData.androidUrl && { android: { url: formData.androidUrl, ...(formData.androidFallback && { fallback: formData.androidFallback }) } }),
          ...(formData.iosUrl && { ios: { url: formData.iosUrl, ...(formData.iosFallback && { fallback: formData.iosFallback }) } }),
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

  const sectionHeader = (num: string, label: string) => (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
        <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>{num}</span>
        // {label}
      </span>
    </div>
  );

  const collapsibleHeader = (label: string, section: keyof typeof expandedSections) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      style={{ width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span>{label}</span>
      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>{expandedSections[section] ? '−' : '+'}</span>
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <button onClick={() => router.back()} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>← back</button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{duplicateId ? 'duplicate link' : 'create link'}</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>{duplicateId ? 'duplicating from existing link — modify as needed' : 'build a deep link with parameters and platform overrides'}</p>
        </div>

        {duplicateLoading && (
          <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
            loading source link...
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-warning)', padding: '12px 16px', marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-warning)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* Left – Form */}
          <div>
            {/* 01 Basic */}
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
              {sectionHeader('01', 'basic info')}
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>campaign *</label>
                  <select value={formData.campaignId} onChange={(e) => handleCampaignChange(e.target.value)} style={inputStyle} required>
                    <option value="">Select a campaign</option>
                    {campaigns.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>app *</label>
                  <select value={formData.appId} onChange={(e) => handleAppChange(e.target.value)} style={inputStyle} required>
                    <option value="">Select an app</option>
                    {apps.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                  </select>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>select an app to use its store URLs for mobile redirects</div>
                </div>
                <div>
                  <label style={labelStyle}>destination url *</label>
                  <input type="url" value={formData.destinationUrl} onChange={(e) => setFormData((prev) => ({ ...prev, destinationUrl: e.target.value }))} placeholder="https://allevents.in" style={inputStyle} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>link type</label>
                    <select value={formData.linkType} onChange={(e) => setFormData((prev) => ({ ...prev, linkType: e.target.value as any }))} style={inputStyle}>
                      {LINK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>action</label>
                    <select value={formData.action} onChange={(e) => setFormData((prev) => ({ ...prev, action: e.target.value }))} style={inputStyle}>
                      {ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>event id</label>
                  <input type="text" value={formData.eventId} onChange={(e) => setFormData((prev) => ({ ...prev, eventId: e.target.value }))} placeholder="evt_123456" style={inputStyle} />
                </div>
              </div>
            </div>

            {/* UTM */}
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
              {collapsibleHeader('utm parameters', 'utm')}
              {expandedSections.utm && (
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(['utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent'] as const).map((field) => (
                    <div key={field}>
                      <label style={labelStyle}>{field.replace('utm', 'utm_').toLowerCase()}</label>
                      <input type="text" value={formData[field]} onChange={(e) => setFormData((prev) => ({ ...prev, [field]: e.target.value }))} placeholder={field.replace('utm', '')} style={inputStyle} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* User */}
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
              {collapsibleHeader('user attribution', 'user')}
              {expandedSections.user && (
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {([
                    ['userEmail', 'email', 'email'],
                    ['userId', 'user id', 'text'],
                    ['couponCode', 'coupon code', 'text'],
                    ['referralCode', 'referral code', 'text'],
                  ] as const).map(([field, label, type]) => (
                    <div key={field}>
                      <label style={labelStyle}>{label}</label>
                      <input type={type} value={formData[field]} onChange={(e) => setFormData((prev) => ({ ...prev, [field]: e.target.value }))} placeholder={label} style={inputStyle} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Params */}
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
              {collapsibleHeader('custom parameters', 'custom')}
              {expandedSections.custom && (
                <div style={{ padding: 20 }}>
                  {Object.entries(formData.customParams).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text)', flex: 1 }}>{key}: <span style={{ color: 'var(--color-text-secondary)' }}>{value}</span></span>
                      <button type="button" onClick={() => removeCustomParam(key)} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-warning)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" value={customParamKey} onChange={(e) => setCustomParamKey(e.target.value)} placeholder="key" style={{ ...inputStyle, flex: 1 }} />
                    <input type="text" value={customParamValue} onChange={(e) => setCustomParamValue(e.target.value)} placeholder="value" style={{ ...inputStyle, flex: 1 }} />
                    <button type="button" onClick={addCustomParam} className="btn-dashboard btn-dashboard-sm" style={{ whiteSpace: 'nowrap' }}>+ add</button>
                  </div>
                </div>
              )}
            </div>

            {/* Platform Overrides */}
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
              {collapsibleHeader('platform overrides', 'platform')}
              {expandedSections.platform && (
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-primary)', marginBottom: 8 }}>android</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input type="text" value={formData.androidUrl} onChange={(e) => setFormData((prev) => ({ ...prev, androidUrl: e.target.value }))} placeholder="app deep link url" style={inputStyle} />
                      <input type="text" value={formData.androidFallback} onChange={(e) => setFormData((prev) => ({ ...prev, androidFallback: e.target.value }))} placeholder="store fallback url" style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ borderLeft: '3px solid var(--color-accent)', paddingLeft: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-accent)', marginBottom: 8 }}>ios</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input type="text" value={formData.iosUrl} onChange={(e) => setFormData((prev) => ({ ...prev, iosUrl: e.target.value }))} placeholder="app deep link url" style={inputStyle} />
                      <input type="text" value={formData.iosFallback} onChange={(e) => setFormData((prev) => ({ ...prev, iosFallback: e.target.value }))} placeholder="store fallback url" style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ borderLeft: '3px solid var(--color-secondary)', paddingLeft: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-secondary)', marginBottom: 8 }}>web</div>
                    <input type="text" value={formData.webUrl} onChange={(e) => setFormData((prev) => ({ ...prev, webUrl: e.target.value }))} placeholder="override web url" style={inputStyle} />
                  </div>
                </div>
              )}
            </div>

            {/* Advanced */}
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
              {collapsibleHeader('advanced', 'advanced')}
              {expandedSections.advanced && (
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>custom short code</label>
                    <input type="text" value={formData.shortCode} onChange={(e) => setFormData((prev) => ({ ...prev, shortCode: e.target.value }))} placeholder="leave empty for auto-generated" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>expiry date</label>
                    <input type="date" value={formData.expiryDate} onChange={(e) => setFormData((prev) => ({ ...prev, expiryDate: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => router.back()} disabled={loading} className="btn-dashboard" style={{ flex: 1, padding: '12px 0' }}>cancel</button>
              <button type="submit" disabled={loading} className="btn-dashboard btn-dashboard-primary" style={{ flex: 1, padding: '12px 0' }}>
                {loading ? 'creating...' : 'create link'}
              </button>
            </div>
          </div>

          {/* Right – Preview */}
          <div style={{ position: 'sticky', top: 32, alignSelf: 'start' }}>
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>// live preview</span>
              </div>

              {formData.destinationUrl ? (
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Deep Link */}
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>short link</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary)', wordBreak: 'break-all', padding: '8px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                      {typeof window !== 'undefined' ? window.location.host : 'smartlink.vercel.app'}/{formData.shortCode || '<auto>'}
                    </div>
                  </div>

                  {/* QR */}
                  {qrCodeUrl && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 16, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                      <img src={qrCodeUrl} alt="QR Code" style={{ width: 120, height: 120 }} />
                    </div>
                  )}

                  {/* App Receives */}
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>app receives</div>
                    <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-secondary)', padding: '8px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', overflow: 'auto', maxHeight: 200, margin: 0 }}>
                      {JSON.stringify(getAppReceives(), null, 2) || '{}'}
                    </pre>
                  </div>

                  {/* Platform Routes */}
                  {(formData.androidUrl || formData.iosUrl || formData.webUrl) && (
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>platform routes</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {formData.androidUrl && (
                          <div style={{ padding: '6px 10px', borderLeft: '3px solid var(--color-primary)', background: 'var(--color-bg)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                            <span style={{ color: 'var(--color-primary)' }}>android</span>
                            <span style={{ color: 'var(--color-text-secondary)', marginLeft: 8 }}>{formData.androidUrl}</span>
                          </div>
                        )}
                        {formData.iosUrl && (
                          <div style={{ padding: '6px 10px', borderLeft: '3px solid var(--color-accent)', background: 'var(--color-bg)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                            <span style={{ color: 'var(--color-accent)' }}>ios</span>
                            <span style={{ color: 'var(--color-text-secondary)', marginLeft: 8 }}>{formData.iosUrl}</span>
                          </div>
                        )}
                        {formData.webUrl && (
                          <div style={{ padding: '6px 10px', borderLeft: '3px solid var(--color-secondary)', background: 'var(--color-bg)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                            <span style={{ color: 'var(--color-secondary)' }}>web</span>
                            <span style={{ color: 'var(--color-text-secondary)', marginLeft: 8 }}>{formData.webUrl}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                  enter a destination URL to see preview
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
