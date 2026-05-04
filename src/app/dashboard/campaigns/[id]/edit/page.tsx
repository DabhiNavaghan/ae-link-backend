'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { generateSlug } from '@/lib/utils/slug';
import { smartLinkApi } from '@/lib/api';
import { useDashboard } from '@/lib/context/DashboardContext';

interface FormData {
  name: string;
  slug: string;
  appId: string;
  status: string;
  description: string;
  utmCampaign: string;
  startDate: string;
  endDate: string;
  metadata: Record<string, string>;
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

export default function EditCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;
  const { apps, can, isContextReady } = useDashboard();

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [metadataKey, setMetadataKey] = useState('');
  const [metadataValue, setMetadataValue] = useState('');

  const [formData, setFormData] = useState<FormData>({
    name: '',
    slug: '',
    appId: '',
    status: 'active',
    description: '',
    utmCampaign: '',
    startDate: '',
    endDate: '',
    metadata: {},
  });

  useEffect(() => {
    if (isContextReady) {
      fetchCampaign();
    }
  }, [campaignId, isContextReady]);

  useEffect(() => {
    if (isContextReady && !can('manage:campaigns')) {
      router.replace('/dashboard');
    }
  }, [isContextReady, can, router]);

  async function fetchCampaign() {
    try {
      const campaign = await smartLinkApi.getCampaign(campaignId);
      const c = campaign as any;
      const meta = { ...(c.metadata || {}) };
      const utmCampaign = meta.utmCampaign || '';
      delete meta.utmCampaign;

      setFormData({
        name: c.name || '',
        slug: c.slug || '',
        appId: c.appId ? c.appId.toString() : '',
        status: c.status || 'active',
        description: c.description || '',
        utmCampaign,
        startDate: c.startDate ? new Date(c.startDate).toISOString().split('T')[0] : '',
        endDate: c.endDate ? new Date(c.endDate).toISOString().split('T')[0] : '',
        metadata: meta,
      });

      // Auto-expand more options if there's data
      const hasAdvanced = c.description ||
        c.startDate || c.endDate || utmCampaign ||
        (Object.keys(meta).length > 0);
      if (hasAdvanced) setShowMore(true);
    } catch (err) {
      console.error('Failed to load campaign', err);
      setError('Failed to load campaign');
    } finally {
      setPageLoading(false);
    }
  }

  const handleNameChange = (value: string) => {
    const slug = generateSlug(value);
    setFormData((prev) => ({ ...prev, name: value, slug, utmCampaign: slug }));
  };

  const addMetadata = () => {
    if (metadataKey.trim()) {
      setFormData((prev) => ({ ...prev, metadata: { ...prev.metadata, [metadataKey]: metadataValue } }));
      setMetadataKey('');
      setMetadataValue('');
    }
  };

  const removeMetadata = (key: string) => {
    setFormData((prev) => ({ ...prev, metadata: Object.fromEntries(Object.entries(prev.metadata).filter(([k]) => k !== key)) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { setError('Campaign name is required'); return; }
    if (!formData.slug.trim()) { setError('Slug is required'); return; }

    try {
      setLoading(true);
      setError(null);
      const payload: any = { name: formData.name, slug: formData.slug, status: formData.status };
      if (formData.appId) payload.appId = formData.appId;
      if (formData.description) payload.description = formData.description;
      if (formData.startDate) payload.startDate = formData.startDate;
      if (formData.endDate) payload.endDate = formData.endDate;
      const metaWithUtm = { ...formData.metadata };
      if (formData.utmCampaign) metaWithUtm.utmCampaign = formData.utmCampaign;
      if (Object.keys(metaWithUtm).length > 0) payload.metadata = metaWithUtm;

      await smartLinkApi.updateCampaign(campaignId, payload);
      router.push(`/dashboard/campaigns/${campaignId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update campaign');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>loading campaign...</div>
      </div>
    );
  }

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
            edit campaign
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            update campaign details and settings
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-warning)', padding: '12px 16px', marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-warning)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ─── Main Section ─── */}
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <label style={labelStyle}>campaign name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Diwali Festival 2024"
                  style={{ ...inputStyle, fontSize: 14, padding: '14px 16px' }}
                />
              </div>

              {/* App + Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>app</label>
                  <select
                    value={formData.appId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, appId: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">No app</option>
                    {apps.map((app) => (<option key={app.id} value={app.id}>{app.name}</option>))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Save button (primary action — always visible) ─── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" onClick={() => router.back()} disabled={loading} className="btn-dashboard" style={{ flex: 0, padding: '12px 20px' }}>cancel</button>
            <button type="submit" disabled={loading || !formData.name.trim()} className="btn-dashboard btn-dashboard-primary" style={{ flex: 1, padding: '12px 0', opacity: formData.name.trim() ? 1 : 0.5 }}>
              {loading ? 'saving...' : 'save changes →'}
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
              justifyContent: 'space-between',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              marginBottom: showMore ? 16 : 0,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {showMore ? '− less options' : '+ more options'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
              description, dates, utm, metadata
            </span>
          </button>

          {showMore && (
            <>
              {/* Description */}
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>details</span>
                </div>
                <div style={{ padding: 20 }}>
                  <label style={labelStyle}>description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="what's this campaign about?"
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* UTM + Duration */}
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>tracking & duration</span>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>utm campaign</label>
                    <input
                      type="text"
                      value={formData.utmCampaign}
                      onChange={(e) => setFormData((prev) => ({ ...prev, utmCampaign: e.target.value }))}
                      placeholder="auto-filled from name"
                      style={inputStyle}
                    />
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>links in this campaign inherit this utm_campaign value</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>start date</label>
                      <input type="date" value={formData.startDate} onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>end date</label>
                      <input type="date" value={formData.endDate} onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>custom metadata</span>
                </div>
                <div style={{ padding: 20 }}>
                  {Object.entries(formData.metadata).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text)', flex: 1 }}>{key}: <span style={{ color: 'var(--color-text-secondary)' }}>{value}</span></span>
                      <button type="button" onClick={() => removeMetadata(key)} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-warning)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" value={metadataKey} onChange={(e) => setMetadataKey(e.target.value)} placeholder="key" style={{ ...inputStyle, flex: 1 }} />
                    <input type="text" value={metadataValue} onChange={(e) => setMetadataValue(e.target.value)} placeholder="value" style={{ ...inputStyle, flex: 1 }} />
                    <button type="button" onClick={addMetadata} className="btn-dashboard btn-dashboard-sm" style={{ whiteSpace: 'nowrap' }}>+ add</button>
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
