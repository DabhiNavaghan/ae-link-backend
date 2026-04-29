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
  description: string;
  fallbackUrl: string;
  utmCampaign: string;
  startDate: string;
  endDate: string;
  metadata: Record<string, string>;
}

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

export default function EditCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;
  const { apps, can, isContextReady } = useDashboard();

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    slug: '',
    appId: '',
    description: '',
    fallbackUrl: '',
    utmCampaign: '',
    startDate: '',
    endDate: '',
    metadata: {},
  });
  const [metadataKey, setMetadataKey] = useState('');
  const [metadataValue, setMetadataValue] = useState('');

  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  useEffect(() => {
    if (isContextReady && !can('manage:campaigns')) {
      router.replace('/dashboard');
    }
  }, [isContextReady, can, router]);

  async function fetchCampaign() {
    try {
      const campaign = await smartLinkApi.getCampaign(campaignId);
      const c = campaign as any;
      // Extract utmCampaign from metadata if present
      const meta = { ...(c.metadata || {}) };
      const utmCampaign = meta.utmCampaign || '';
      delete meta.utmCampaign;

      setFormData({
        name: c.name || '',
        slug: c.slug || '',
        appId: c.appId || '',
        description: c.description || '',
        fallbackUrl: c.fallbackUrl || '',
        utmCampaign,
        startDate: c.startDate ? new Date(c.startDate).toISOString().split('T')[0] : '',
        endDate: c.endDate ? new Date(c.endDate).toISOString().split('T')[0] : '',
        metadata: meta,
      });
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

  const handleSlugChange = (value: string) => {
    const slug = generateSlug(value);
    setFormData((prev) => ({ ...prev, slug, utmCampaign: slug }));
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
    if (!formData.appId) { setError('App is required'); return; }
    if (!formData.name.trim()) { setError('Campaign name is required'); return; }
    if (!formData.slug.trim()) { setError('Slug is required'); return; }

    try {
      setLoading(true);
      setError(null);
      const payload: any = { name: formData.name, slug: formData.slug };
      if (formData.appId) payload.appId = formData.appId;
      if (formData.description) payload.description = formData.description;
      if (formData.fallbackUrl) payload.fallbackUrl = formData.fallbackUrl;
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

  const sectionHeader = (num: string, label: string) => (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
        <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>{num}</span>
        // {label}
      </span>
    </div>
  );

  if (pageLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>loading campaign...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <button onClick={() => router.back()} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>← back</button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>edit campaign</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>update your campaign details and metadata</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Basic Info */}
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
              {sectionHeader('01', 'basic info')}
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* App */}
                <div>
                  <label style={labelStyle}>app *</label>
                  <select
                    value={formData.appId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, appId: e.target.value }))}
                    style={inputStyle}
                    required
                  >
                    <option value="">Select an app</option>
                    {apps.map((app) => (<option key={app.id} value={app.id}>{app.name}</option>))}
                  </select>
                </div>

                {/* Name */}
                <div>
                  <label style={labelStyle}>campaign name *</label>
                  <input type="text" value={formData.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g., Summer Festival 2024" style={inputStyle} />
                </div>

                {/* Slug */}
                <div>
                  <label style={labelStyle}>slug *</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)', padding: '10px 12px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRight: 'none', whiteSpace: 'nowrap' }}>/c/</span>
                    <input type="text" value={formData.slug} onChange={(e) => handleSlugChange(e.target.value)} placeholder="summer-festival-2024" style={{ ...inputStyle }} />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={labelStyle}>description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} placeholder="campaign details..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                {/* Fallback URL */}
                <div>
                  <label style={labelStyle}>fallback url</label>
                  <input type="url" value={formData.fallbackUrl} onChange={(e) => setFormData((prev) => ({ ...prev, fallbackUrl: e.target.value }))} placeholder="https://allevents.in" style={inputStyle} />
                </div>

                {/* UTM Campaign */}
                <div>
                  <label style={labelStyle}>utm campaign</label>
                  <input type="text" value={formData.utmCampaign} onChange={(e) => setFormData((prev) => ({ ...prev, utmCampaign: e.target.value }))} placeholder="auto-filled from slug" style={inputStyle} />
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>auto-filled from campaign slug. links in this campaign will inherit this value.</div>
                </div>
              </div>
            </div>

            {/* Duration */}
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
              {sectionHeader('02', 'duration')}
              <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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

            {/* Metadata */}
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
              {sectionHeader('03', 'metadata')}
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

            {/* Error */}
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-warning)', padding: '12px 16px', marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-warning)' }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => router.back()} disabled={loading} className="btn-dashboard" style={{ flex: 1, padding: '12px 0' }}>cancel</button>
              <button type="submit" disabled={loading} className="btn-dashboard btn-dashboard-primary" style={{ flex: 1, padding: '12px 0' }}>
                {loading ? 'saving...' : 'save changes'}
              </button>
            </div>
          </form>

          {/* Preview */}
          <div style={{ position: 'sticky', top: 32, alignSelf: 'start' }}>
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
                  // preview
                </span>
              </div>
              <div style={{ padding: 20 }}>
                {formData.name ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>name</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{formData.name}</div>
                    </div>

                    {formData.appId && (
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>app</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)' }}>{apps.find((a) => a.id === formData.appId)?.name || formData.appId}</div>
                      </div>
                    )}

                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>url</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary)', wordBreak: 'break-all' }}>
                        {typeof window !== 'undefined' ? window.location.host : 'smartlink.vercel.app'}/c/{formData.slug || 'slug'}
                      </div>
                    </div>

                    {formData.description && (
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>description</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>{formData.description}</div>
                      </div>
                    )}

                    {formData.utmCampaign && (
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>utm_campaign</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-accent)' }}>{formData.utmCampaign}</div>
                      </div>
                    )}

                    {(formData.startDate || formData.endDate) && (
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>duration</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                          {formData.startDate && new Date(formData.startDate).toLocaleDateString()} → {formData.endDate && new Date(formData.endDate).toLocaleDateString()}
                        </div>
                      </div>
                    )}

                    {Object.keys(formData.metadata).length > 0 && (
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>metadata</div>
                        {Object.entries(formData.metadata).map(([k, v]) => (
                          <div key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>{k}: {v}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '40px 0' }}>
                    fill in details to see preview
                  </div>
                )}
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px dashed var(--color-border)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                editing: <span style={{ color: 'var(--color-secondary)' }}>{campaignId}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
