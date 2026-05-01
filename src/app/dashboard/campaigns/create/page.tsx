'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { generateSlug } from '@/lib/utils/slug';
import { smartLinkApi } from '@/lib/api';
import { useDashboard } from '@/lib/context/DashboardContext';

interface FormData {
  name: string;
  appId: string;
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

export default function CreateCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get('duplicate');
  const { apps, selectedAppId, can, isContextReady, tenant } = useDashboard();

  // Permission gate
  useEffect(() => {
    if (isContextReady && !can('manage:campaigns')) {
      router.replace('/dashboard');
    }
  }, [isContextReady, can, router]);

  const [loading, setLoading] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(!!duplicateId);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; name: string } | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [metadataKey, setMetadataKey] = useState('');
  const [metadataValue, setMetadataValue] = useState('');

  const [formData, setFormData] = useState<FormData>({
    name: '',
    appId: selectedAppId || '',
    description: '',
    utmCampaign: '',
    startDate: '',
    endDate: '',
    metadata: {},
  });

  // Sync selectedAppId
  useEffect(() => {
    if (selectedAppId) {
      setFormData((prev) => prev.appId ? prev : { ...prev, appId: selectedAppId });
    }
  }, [selectedAppId]);

  // Auto-generate slug from name + app/org (internal, not shown to user)
  const buildSlug = (name: string, appId: string): string => {
    const appName = apps.find((a) => a.id === appId)?.name || '';
    const orgName = tenant?.name || '';
    const prefix = appName || orgName;
    const combined = prefix ? `${prefix} ${name}` : name;
    return generateSlug(combined);
  };

  // Duplicate pre-fill
  useEffect(() => {
    if (!duplicateId) return;
    (async () => {
      try {
        setDuplicateLoading(true);
        const source = await smartLinkApi.getCampaign(duplicateId);
        setFormData({
          name: `Copy of ${source.name}`,
          appId: (source as any).appId || selectedAppId || '',
          description: (source as any).description || '',
          utmCampaign: generateSlug(source.name + ' copy'),
          startDate: (source as any).startDate ? new Date((source as any).startDate).toISOString().split('T')[0] : '',
          endDate: (source as any).endDate ? new Date((source as any).endDate).toISOString().split('T')[0] : '',
          metadata: { ...((source as any).metadata || {}) },
        });
        const hasAdvanced = (source as any).description ||
          (source as any).startDate || (source as any).endDate ||
          ((source as any).metadata && Object.keys((source as any).metadata).length > 0);
        if (hasAdvanced) setShowMore(true);
      } catch {
        setError('Failed to load source campaign for duplication');
      } finally {
        setDuplicateLoading(false);
      }
    })();
  }, [duplicateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNameChange = (value: string) => {
    const slug = generateSlug(value);
    setFormData((prev) => ({ ...prev, name: value, utmCampaign: slug }));
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
    const name = formData.name.trim();
    if (!name) { setError('Campaign name is required'); return; }

    // Auto-generate slug from name + app/org
    const slug = buildSlug(name, formData.appId);

    try {
      setLoading(true);
      setError(null);
      const payload: any = { name, slug };
      if (formData.appId) payload.appId = formData.appId;
      if (formData.description) payload.description = formData.description;
      if (formData.startDate) payload.startDate = formData.startDate;
      if (formData.endDate) payload.endDate = formData.endDate;
      const metaWithUtm = { ...formData.metadata };
      if (formData.utmCampaign) metaWithUtm.utmCampaign = formData.utmCampaign;
      if (Object.keys(metaWithUtm).length > 0) payload.metadata = metaWithUtm;

      const campaign = await smartLinkApi.createCampaign(payload);
      setSuccess({ id: String(campaign._id), name: campaign.name });
    } catch (err: any) {
      setError(err.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

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
            Campaign created!
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 24 }}>
            {success.name} is ready — start adding links
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                setSuccess(null);
                setFormData((prev) => ({ ...prev, name: '', description: '', utmCampaign: '' }));
              }}
              className="btn-dashboard"
              style={{ flex: 1, padding: '12px 0' }}
            >
              + create another
            </button>
            <button
              onClick={() => router.push(`/dashboard/campaigns/${success.id}`)}
              className="btn-dashboard btn-dashboard-primary"
              style={{ flex: 1, padding: '12px 0' }}
            >
              view details →
            </button>
          </div>
          <button
            onClick={() => router.push(`/dashboard/links/create?campaignId=${success.id}`)}
            className="btn-dashboard"
            style={{ width: '100%', padding: '12px 0', marginTop: 8 }}
          >
            + add a link to this campaign
          </button>
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
            {duplicateId ? 'duplicate campaign' : 'create campaign'}
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            group your links under a campaign for tracking
          </p>
        </div>

        {duplicateLoading && (
          <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
            loading source campaign...
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
              {/* Name — the only required field */}
              <div>
                <label style={labelStyle}>campaign name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Diwali Festival 2024"
                  style={{ ...inputStyle, fontSize: 14, padding: '14px 16px' }}
                  autoFocus
                />
              </div>

              {/* App selector */}
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
            </div>
          </div>

          {/* ─── Create button (primary action — always visible) ─── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" onClick={() => router.back()} disabled={loading} className="btn-dashboard" style={{ flex: 0, padding: '12px 20px' }}>cancel</button>
            <button type="submit" disabled={loading || !formData.name.trim()} className="btn-dashboard btn-dashboard-primary" style={{ flex: 1, padding: '12px 0', opacity: formData.name.trim() ? 1 : 0.5 }}>
              {loading ? 'creating...' : 'create campaign →'}
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
