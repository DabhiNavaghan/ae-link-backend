'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { generateQRCodeSVG } from '@/lib/utils/qr-code';
import { smartLinkApi } from '@/lib/api';
import { useDashboard } from '@/lib/context/DashboardContext';

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
  title: string;
  appId: string;
  campaignId: string;
  destinationUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  ct: string;
  pt: string;
  mt: string;
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  padding: '12px 14px',
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
  outline: 'none',
  transition: 'border-color 0.15s',
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

/* ─── Smart URL parsing ─── */
function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname
      .split('/')
      .filter(Boolean)
      .filter((s) => !/^[a-f0-9]{8,}$/i.test(s)); // skip IDs/hashes

    if (segments.length === 0) {
      // Just the domain
      return u.hostname.replace(/^www\./, '').split('.')[0];
    }

    // Take the last meaningful segment(s)
    const meaningful = segments.slice(-2);
    return meaningful
      .map((s) =>
        s
          .replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
      )
      .reverse() // "mumbai/diwali-fest" → "Diwali Fest - Mumbai"
      .join(' - ');
  } catch {
    return '';
  }
}

export default function CreateLinkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignIdFromUrl = searchParams.get('campaignId');
  const duplicateId = searchParams.get('duplicate');
  const { can, isContextReady, selectedAppId } = useDashboard();

  // Permission gate
  useEffect(() => {
    if (isContextReady && !can('manage:links')) {
      router.replace('/dashboard');
    }
  }, [isContextReady, can, router]);

  const [loading, setLoading] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(!!duplicateId);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ shortCode: string; id: string } | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showMore, setShowMore] = useState(false);
  const [customParamKey, setCustomParamKey] = useState('');
  const [customParamValue, setCustomParamValue] = useState('');
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    appId: selectedAppId || '',
    campaignId: campaignIdFromUrl || '',
    destinationUrl: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    utmTerm: '',
    utmContent: '',
    ct: '',
    pt: '',
    mt: '',
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

  // Sync app from dashboard context
  useEffect(() => {
    if (selectedAppId && !formData.appId) {
      setFormData((prev) => ({ ...prev, appId: selectedAppId }));
    }
  }, [selectedAppId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchCampaigns(); fetchApps(); }, []);
  useEffect(() => { generateQRCode(); }, [formData.destinationUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smart URL parsing — auto-generate title when URL changes
  const handleUrlChange = useCallback((url: string) => {
    setFormData((prev) => {
      const updates: Partial<FormData> = { destinationUrl: url };
      if (!titleManuallyEdited && url) {
        updates.title = titleFromUrl(url);
      }
      return { ...prev, ...updates };
    });
  }, [titleManuallyEdited]);

  // Duplicate pre-fill
  useEffect(() => {
    if (!duplicateId) return;
    (async () => {
      try {
        setDuplicateLoading(true);
        const source = await smartLinkApi.getLink(duplicateId);
        const params = (source as any).params || {};
        const platformOverrides = (source as any).platformOverrides || {};
        setFormData({
          title: (source as any).title || '',
          appId: (source as any).appId || '',
          campaignId: (source as any).campaignId || '',
          destinationUrl: (source as any).destinationUrl || '',
          utmSource: params.utmSource || '',
          utmMedium: params.utmMedium || '',
          utmCampaign: params.utmCampaign || '',
          utmTerm: params.utmTerm || '',
          utmContent: params.utmContent || '',
          ct: params.ct || '',
          pt: params.pt || '',
          mt: params.mt || '',
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
          shortCode: '',
          expiryDate: (source as any).expiresAt ? new Date((source as any).expiresAt).toISOString().split('T')[0] : '',
        });
        setTitleManuallyEdited(true);
        // Show advanced if there's data
        const hasAdvanced = params.utmSource || params.utmMedium || params.utmCampaign ||
          params.userEmail || params.userId || params.couponCode || params.referralCode ||
          platformOverrides.android || platformOverrides.ios || platformOverrides.web ||
          (params.custom && Object.keys(params.custom).length > 0);
        if (hasAdvanced) setShowMore(true);
      } catch {
        setError('Failed to load source link for duplication');
      } finally {
        setDuplicateLoading(false);
      }
    })();
  }, [duplicateId]);

  async function fetchCampaigns() {
    try {
      const data = await smartLinkApi.listCampaigns({ limit: 100 });
      setCampaigns((data.campaigns || []) as unknown as Campaign[]);
    } catch (err) { console.error('Failed to load campaigns', err); }
  }

  async function fetchApps() {
    try {
      const data = await smartLinkApi.listApps();
      setApps((data.apps || []) as unknown as AppOption[]);
    } catch (err) { console.error('Failed to load apps', err); }
  }

  async function generateQRCode() {
    if (!formData.destinationUrl) { setQrCodeUrl(''); return; }
    try {
      const svg = generateQRCodeSVG(formData.destinationUrl, 200);
      setQrCodeUrl(`data:image/svg+xml;base64,${btoa(svg)}`);
    } catch { setQrCodeUrl(''); }
  }

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
    if (!appId) {
      updates.androidUrl = '';
      updates.androidFallback = '';
      updates.iosUrl = '';
      updates.iosFallback = '';
    }
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Auto-generate title if empty
    const title = formData.title.trim() || (formData.destinationUrl ? titleFromUrl(formData.destinationUrl) : '') || 'App Link';

    try {
      setLoading(true); setError(null);
      const payload: any = {
        title,
        ...(formData.destinationUrl && { destinationUrl: formData.destinationUrl }),
        params: {
          ...(formData.utmSource && { utmSource: formData.utmSource }),
          ...(formData.utmMedium && { utmMedium: formData.utmMedium }),
          ...(formData.utmCampaign && { utmCampaign: formData.utmCampaign }),
          ...(formData.utmTerm && { utmTerm: formData.utmTerm }),
          ...(formData.utmContent && { utmContent: formData.utmContent }),
          ...(formData.ct && { ct: formData.ct }),
          ...(formData.pt && { pt: formData.pt }),
          ...(formData.mt && { mt: formData.mt }),
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

      const link = await smartLinkApi.createLink(payload);
      setSuccess({ shortCode: (link as any).shortCode, id: (link as any)._id });
    } catch (err: any) {
      setError(err.message || 'Failed to create link');
    } finally {
      setLoading(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const smartLinkUrl = success ? `${origin}/${success.shortCode}` : '';

  // ── Success screen ──
  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          {/* Checkmark */}
          <div style={{ width: 64, height: 64, margin: '0 auto 24px', background: 'rgba(74, 222, 128, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
            Link created!
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 24 }}>
            your smart link is ready to share
          </p>

          {/* Link display + copy */}
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--color-primary)', wordBreak: 'break-all', marginBottom: 12 }}>
              {smartLinkUrl}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(smartLinkUrl); }}
              style={{ width: '100%', padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--color-primary)', color: '#000', border: 'none', cursor: 'pointer' }}
            >
              copy link
            </button>
          </div>

          {/* QR */}
          {qrCodeUrl && (
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 20, marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
              <img src={qrCodeUrl} alt="QR Code" style={{ width: 140, height: 140 }} />
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                setSuccess(null);
                setFormData((prev) => ({ ...prev, title: '', destinationUrl: '', shortCode: '' }));
                setTitleManuallyEdited(false);
              }}
              className="btn-dashboard"
              style={{ flex: 1, padding: '12px 0' }}
            >
              + create another
            </button>
            <button
              onClick={() => router.push(`/dashboard/links/${success.id}`)}
              className="btn-dashboard btn-dashboard-primary"
              style={{ flex: 1, padding: '12px 0' }}
            >
              view details →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Create form ──
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Nav */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => router.back()} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>← back</button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
            {duplicateId ? 'duplicate link' : 'create link'}
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            paste a URL or create an app-open link
          </p>
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

        <form onSubmit={handleSubmit}>
          {/* ─── Quick Create Section ─── */}
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* URL — the star of the show */}
              <div>
                <label style={labelStyle}>destination url</label>
                <input
                  type="url"
                  value={formData.destinationUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="paste a URL or leave empty to just open your app"
                  style={{ ...inputStyle, fontSize: 14, padding: '14px 16px' }}
                  autoFocus
                />
              </div>

              {/* Auto-generated title */}
              <div>
                <label style={labelStyle}>link name</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => {
                    setTitleManuallyEdited(true);
                    setFormData((prev) => ({ ...prev, title: e.target.value }));
                  }}
                  placeholder="auto-generated from URL"
                  style={inputStyle}
                />
                {!titleManuallyEdited && formData.title && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-primary)', marginTop: 4 }}>
                    ✓ auto-generated from URL
                  </div>
                )}
              </div>

              {/* App + Campaign in a row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>app</label>
                  <select
                    value={formData.appId}
                    onChange={(e) => handleAppChange(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">No app</option>
                    {apps.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>campaign</label>
                  <select
                    value={formData.campaignId}
                    onChange={(e) => handleCampaignChange(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">No campaign</option>
                    {campaigns.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Live Preview (inline) ─── */}
          {formData.destinationUrl && (
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>preview</span>
              </div>
              <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
                {/* QR */}
                {qrCodeUrl && (
                  <div style={{ flexShrink: 0, padding: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <img src={qrCodeUrl} alt="QR" style={{ width: 80, height: 80 }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>smart link</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-primary)', wordBreak: 'break-all' }}>
                    {origin}/{formData.shortCode || '‹auto›'}
                  </div>
                  {formData.title && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      {formData.title}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── Create button (primary action — always visible) ─── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" onClick={() => router.back()} disabled={loading} className="btn-dashboard" style={{ flex: 0, padding: '12px 20px' }}>cancel</button>
            <button type="submit" disabled={loading} className="btn-dashboard btn-dashboard-primary" style={{ flex: 1, padding: '12px 0' }}>
              {loading ? 'creating...' : 'create link →'}
            </button>
          </div>

          {/* ─── More options toggle ─── */}
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            style={{
              width: '100%',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'transparent',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--color-text-secondary)',
              marginBottom: showMore ? 16 : 0,
            }}
          >
            {showMore ? '− hide options' : '+ more options'}
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>utm, platform, custom params</span>
          </button>

          {/* ─── Advanced Options (hidden by default) ─── */}
          {showMore && (
            <>
              {/* UTM */}
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 8 }}>01</span>
                    utm tracking
                  </span>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>utm_source</label>
                      <input type="text" value={formData.utmSource} onChange={(e) => setFormData((prev) => ({ ...prev, utmSource: e.target.value }))} placeholder="e.g. email, whatsapp" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>utm_medium</label>
                      <input type="text" value={formData.utmMedium} onChange={(e) => setFormData((prev) => ({ ...prev, utmMedium: e.target.value }))} placeholder="e.g. newsletter, banner" style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>utm_campaign</label>
                    <input type="text" value={formData.utmCampaign} onChange={(e) => setFormData((prev) => ({ ...prev, utmCampaign: e.target.value }))} placeholder="e.g. summer-sale" style={inputStyle} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>utm_term</label>
                      <input type="text" value={formData.utmTerm} onChange={(e) => setFormData((prev) => ({ ...prev, utmTerm: e.target.value }))} placeholder="optional" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>utm_content</label>
                      <input type="text" value={formData.utmContent} onChange={(e) => setFormData((prev) => ({ ...prev, utmContent: e.target.value }))} placeholder="optional" style={inputStyle} />
                    </div>
                  </div>
                  {/* App Store params */}
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 4 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>app store tracking (ct / pt / mt)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>ct</label>
                        <input type="text" value={formData.ct} onChange={(e) => setFormData((prev) => ({ ...prev, ct: e.target.value }))} placeholder="campaign token" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>pt</label>
                        <input type="text" value={formData.pt} onChange={(e) => setFormData((prev) => ({ ...prev, pt: e.target.value }))} placeholder="provider token" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>mt</label>
                        <input type="text" value={formData.mt} onChange={(e) => setFormData((prev) => ({ ...prev, mt: e.target.value }))} placeholder="8" style={inputStyle} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Attribution */}
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 8 }}>02</span>
                    user attribution
                  </span>
                </div>
                <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>email</label>
                    <input type="email" value={formData.userEmail} onChange={(e) => setFormData((prev) => ({ ...prev, userEmail: e.target.value }))} placeholder="user@example.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>user id</label>
                    <input type="text" value={formData.userId} onChange={(e) => setFormData((prev) => ({ ...prev, userId: e.target.value }))} placeholder="usr_123" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>coupon code</label>
                    <input type="text" value={formData.couponCode} onChange={(e) => setFormData((prev) => ({ ...prev, couponCode: e.target.value }))} placeholder="SUMMER20" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>referral code</label>
                    <input type="text" value={formData.referralCode} onChange={(e) => setFormData((prev) => ({ ...prev, referralCode: e.target.value }))} placeholder="REF-ABC" style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Custom Params */}
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 8 }}>03</span>
                    custom parameters
                  </span>
                </div>
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
              </div>

              {/* Platform Overrides */}
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 8 }}>04</span>
                    platform overrides
                  </span>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-primary)', marginBottom: 8 }}>android</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input type="text" value={formData.androidUrl} onChange={(e) => setFormData((prev) => ({ ...prev, androidUrl: e.target.value }))} placeholder="deep link url" style={inputStyle} />
                      <input type="text" value={formData.androidFallback} onChange={(e) => setFormData((prev) => ({ ...prev, androidFallback: e.target.value }))} placeholder="store fallback url" style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ borderLeft: '3px solid var(--color-accent)', paddingLeft: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-accent)', marginBottom: 8 }}>ios</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input type="text" value={formData.iosUrl} onChange={(e) => setFormData((prev) => ({ ...prev, iosUrl: e.target.value }))} placeholder="deep link url" style={inputStyle} />
                      <input type="text" value={formData.iosFallback} onChange={(e) => setFormData((prev) => ({ ...prev, iosFallback: e.target.value }))} placeholder="store fallback url" style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ borderLeft: '3px solid var(--color-secondary)', paddingLeft: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-secondary)', marginBottom: 8 }}>web</div>
                    <input type="text" value={formData.webUrl} onChange={(e) => setFormData((prev) => ({ ...prev, webUrl: e.target.value }))} placeholder="override web destination" style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Advanced */}
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 8 }}>05</span>
                    advanced
                  </span>
                </div>
                <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>custom short code</label>
                    <input type="text" value={formData.shortCode} onChange={(e) => setFormData((prev) => ({ ...prev, shortCode: e.target.value }))} placeholder="auto-generated" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>expiry date</label>
                    <input type="date" value={formData.expiryDate} onChange={(e) => setFormData((prev) => ({ ...prev, expiryDate: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
