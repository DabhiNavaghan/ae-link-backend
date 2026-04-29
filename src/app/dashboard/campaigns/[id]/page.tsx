'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDate, formatRelativeTime, copyToClipboard } from '@/lib/utils/slug';
import { SmartLinkApi } from '@/lib/api';

const api = new SmartLinkApi();

// Module-level cache — survives client-side navigation, cleared on hard refresh
const pageCache = new Map<string, {
  campaign: Campaign;
  links: LinkItem[];
  analytics: Analytics;
}>();

interface Campaign {
  _id: string;
  name: string;
  slug: string;
  status: 'active' | 'paused' | 'archived';
  description?: string;
  fallbackUrl?: string;
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface LinkItem {
  _id: string;
  shortCode: string;
  destinationUrl: string;
  linkType: string;
  clickCount: number;
  conversionCount?: number;
  createdAt: string;
}

interface Analytics {
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  deferredMatches: number;
  topReferrers: Array<{ referrer: string; clicks: number }>;
}

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [linkAnalyticsLoading, setLinkAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [linkDeleteConfirm, setLinkDeleteConfirm] = useState<string | null>(null);
  const [linkDeleting, setLinkDeleting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [campaignId]);

  async function fetchData() {
    const cached = pageCache.get(campaignId);

    if (cached) {
      // Serve cached data immediately — no spinner
      setCampaign(cached.campaign);
      setEditName(cached.campaign.name);
      setEditDescription(cached.campaign.description || '');
      setLinks(cached.links);
      setAnalytics(cached.analytics);
      setLoading(false);
      // Silently refresh analytics in background
      setAnalyticsLoading(true);
      api.getCampaignAnalytics(campaignId)
        .then((analyticsData) => {
          const fresh: Analytics = {
            totalClicks: analyticsData.totalClicks || 0,
            totalConversions: analyticsData.totalConversions || 0,
            conversionRate: analyticsData.conversionRate || 0,
            deferredMatches: 0,
            topReferrers: analyticsData.topReferrers || [],
          };
          setAnalytics(fresh);
          pageCache.set(campaignId, { ...cached, analytics: fresh });
        })
        .catch(() => {})
        .finally(() => setAnalyticsLoading(false));
      return;
    }

    // First visit — show full loading state
    try {
      setLoading(true);
      setAnalyticsLoading(true);

      const [campaignData, linksData] = await Promise.all([
        api.getCampaign(campaignId),
        api.listLinks({ campaignId }),
      ]);

      const typedCampaign = campaignData as unknown as Campaign;
      const typedLinks = (linksData.links || []) as unknown as LinkItem[];

      setCampaign(typedCampaign);
      setEditName(typedCampaign.name);
      setEditDescription(typedCampaign.description || '');
      setLinks(typedLinks);
      setLoading(false);

      // Fetch link analytics in background for conversion counts
      setLinkAnalyticsLoading(true);
      Promise.allSettled(typedLinks.map((l) => api.getLinkAnalytics(l._id)))
        .then((results) => {
          setLinks((prev) =>
            prev.map((l, i) => {
              const r = results[i];
              return r.status === 'fulfilled'
                ? { ...l, conversionCount: r.value.conversions?.total ?? 0 }
                : l;
            })
          );
        })
        .finally(() => setLinkAnalyticsLoading(false));

      api.getCampaignAnalytics(campaignId)
        .then((analyticsData) => {
          const fresh: Analytics = {
            totalClicks: analyticsData.totalClicks || 0,
            totalConversions: analyticsData.totalConversions || 0,
            conversionRate: analyticsData.conversionRate || 0,
            deferredMatches: 0,
            topReferrers: analyticsData.topReferrers || [],
          };
          setAnalytics(fresh);
          pageCache.set(campaignId, { campaign: typedCampaign, links: typedLinks, analytics: fresh });
        })
        .catch(() => {
          setAnalytics({ totalClicks: 0, totalConversions: 0, conversionRate: 0, deferredMatches: 0, topReferrers: [] });
        })
        .finally(() => setAnalyticsLoading(false));
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign');
      setLoading(false);
      setAnalyticsLoading(false);
    }
  }

  async function handleUpdateName() {
    if (!editName.trim()) {
      setEditingName(false);
      return;
    }

    try {
      const updated = await api.updateCampaign(campaignId, {
        name: editName,
      });
      const updatedCampaign = updated as unknown as Campaign;
      setCampaign(updatedCampaign);
      pageCache.delete(campaignId);
      setEditingName(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update campaign');
    }
  }

  async function handleUpdateDescription() {
    try {
      const updated = await api.updateCampaign(campaignId, {
        description: editDescription,
      });
      setCampaign(updated as unknown as Campaign);
      pageCache.delete(campaignId);
      setEditingDescription(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update campaign');
    }
  }

  async function handleStatusChange(newStatus: string) {
    try {
      const updated = await api.updateCampaign(campaignId, {
        status: newStatus as 'active' | 'paused' | 'archived',
      });
      setCampaign(updated as unknown as Campaign);
    } catch (err: any) {
      setError(err.message || 'Failed to update campaign');
    }
  }

  async function handleDeleteLink(linkId: string) {
    setLinkDeleting(true);
    try {
      await api.deleteLink(linkId);
      setLinks((prev) => prev.filter((l) => l._id !== linkId));
      pageCache.delete(campaignId);
      setLinkDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete link');
      setLinkDeleteConfirm(null);
    } finally {
      setLinkDeleting(false);
    }
  }

  async function handleCopyLink(shortCode: string) {
    try {
      const domain = typeof window !== 'undefined' ? window.location.origin : '';
      await copyToClipboard(`${domain}/${shortCode}`);
      setCopiedCode(shortCode);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // ignore
    }
  }

  const sectionHeader = (num: string, label: string) => (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
      <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>{num}</span>
      // {label}
    </span>
  );

  const statBox = (label: string, value: string | number, accent = false) => (
    <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 20 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>{label}</div>
      {analyticsLoading ? (
        <div style={{ height: 32, width: 60, background: 'var(--color-bg-secondary)' }} />
      ) : (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: accent ? 'var(--color-primary)' : 'var(--color-text)', letterSpacing: '-0.02em' }}>{value}</div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>loading campaign...</div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <button onClick={() => router.back()} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>← back</button>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-warning)', padding: 20, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-warning)' }}>
            {error || 'Campaign not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <button onClick={() => router.back()} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>← back</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => router.push(`/dashboard/campaigns/create?duplicate=${campaignId}`)} className="btn-dashboard btn-dashboard-sm">duplicate</button>
            {campaign.status === 'active' ? (
              <button onClick={() => handleStatusChange('paused')} className="btn-dashboard btn-dashboard-sm">pause</button>
            ) : campaign.status === 'paused' ? (
              <button onClick={() => handleStatusChange('active')} className="btn-dashboard btn-dashboard-sm btn-dashboard-primary">resume</button>
            ) : null}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-warning)', padding: '12px 16px', marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-warning)' }}>
            {error}
          </div>
        )}

        {/* 01 Header */}
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {sectionHeader('01', 'campaign')}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '3px 10px',
              border: '1px solid',
              color: campaign.status === 'active' ? 'var(--color-primary)' : campaign.status === 'paused' ? 'var(--color-warning)' : 'var(--color-text-tertiary)',
              borderColor: campaign.status === 'active' ? 'var(--color-primary)' : campaign.status === 'paused' ? 'var(--color-warning)' : 'var(--color-text-tertiary)',
            }}>
              {campaign.status}
            </span>
          </div>
          <div style={{ padding: 20 }}>
            {editingName ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 14, padding: '8px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
                <button onClick={handleUpdateName} className="btn-dashboard btn-dashboard-sm btn-dashboard-primary">save</button>
                <button onClick={() => setEditingName(false)} className="btn-dashboard btn-dashboard-sm">cancel</button>
              </div>
            ) : (
              <h1
                onClick={() => { setEditingName(true); }}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--color-text)', cursor: 'pointer', marginBottom: 8 }}
              >
                {campaign.name}
              </h1>
            )}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
              slug: <span style={{ color: 'var(--color-secondary)' }}>/{campaign.slug}</span>
            </div>
            {editingDescription ? (
              <div>
                <textarea
                  value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} autoFocus
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '8px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', marginBottom: 8, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleUpdateDescription} className="btn-dashboard btn-dashboard-sm btn-dashboard-primary">save</button>
                  <button onClick={() => setEditingDescription(false)} className="btn-dashboard btn-dashboard-sm">cancel</button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingDescription(true)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: campaign.description ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)', cursor: 'pointer', padding: '4px 0' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = campaign.description ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)'; }}
              >
                {campaign.description || '+ add description'}
              </div>
            )}
          </div>
        </div>

        {/* 02 Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {statBox('links', links.length)}
          {statBox('clicks', analytics?.totalClicks || 0, true)}
          {statBox('conversions', analytics?.totalConversions || 0)}
          {statBox('cvr', `${(analytics?.conversionRate || 0).toFixed(2)}%`)}
        </div>

        {/* Duration */}
        {(campaign.startDate || campaign.endDate) && (
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24, padding: 20 }}>
            <div style={{ marginBottom: 12 }}>{sectionHeader('03', 'duration')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {campaign.startDate && (
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>start</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text)' }}>{formatDate(campaign.startDate)}</div>
                </div>
              )}
              {campaign.endDate && (
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>end</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text)' }}>{formatDate(campaign.endDate)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        {campaign.metadata && Object.keys(campaign.metadata).length > 0 && (
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24, padding: 20 }}>
            <div style={{ marginBottom: 12 }}>{sectionHeader('04', 'metadata')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {Object.entries(campaign.metadata).map(([key, value]) => (
                <div key={key} style={{ background: 'var(--color-bg)', padding: 12, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{key}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text)' }}>{String(value)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Referrers */}
        {(analytics?.topReferrers || []).length > 0 && (
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {sectionHeader('05', 'top referrers')}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <thead>
                <tr>
                  {['referrer', 'clicks'].map((h) => (
                    <th key={h} style={{ textAlign: h === 'clicks' ? 'right' : 'left', padding: '12px 16px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', fontWeight: 500, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(analytics?.topReferrers || []).map((ref, idx) => {
                  let displayRef = ref.referrer;
                  try { const u = new URL(ref.referrer); displayRef = u.hostname + (u.pathname !== '/' ? u.pathname : ''); } catch {}
                  return (
                    <tr key={idx} style={{ transition: 'background 0.15s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }} title={ref.referrer}>{displayRef}</td>
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: 'var(--color-primary)' }}>{ref.clicks.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Links Table */}
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {sectionHeader('06', `links (${links.length})`)}
            <Link href={`/dashboard/links/create?campaignId=${campaignId}`}>
              <button className="btn-dashboard btn-dashboard-sm btn-dashboard-primary">+ new link</button>
            </Link>
          </div>

          {links.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <p style={{ marginBottom: 16 }}>No links created yet</p>
              <Link href={`/dashboard/links/create?campaignId=${campaignId}`}>
                <button className="btn-dashboard btn-dashboard-primary">create first link</button>
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['slug', 'destination', 'clicks', 'conversions', ''].map((h) => (
                      <th key={h} style={{ textAlign: h === 'clicks' || h === 'conversions' ? 'right' : 'left', padding: '12px 16px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', fontWeight: 500, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link._id} style={{ transition: 'background 0.15s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
                        <Link href={`/dashboard/links/${link._id}`} style={{ textDecoration: 'none' }}>
                          <span style={{ color: 'var(--color-primary)', cursor: 'pointer' }}>{link.shortCode}</span>
                        </Link>
                      </td>
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-secondary)', fontSize: 11, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={link.destinationUrl}>
                        {link.destinationUrl}
                      </td>
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: 'var(--color-primary)' }}>
                        {linkAnalyticsLoading ? <span style={{ color: 'var(--color-text-tertiary)' }}>...</span> : link.clickCount.toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: 'var(--color-text)' }}>
                        {linkAnalyticsLoading ? <span style={{ color: 'var(--color-text-tertiary)' }}>...</span> : (link.conversionCount ?? 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', position: 'relative' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button onClick={() => handleCopyLink(link.shortCode)} className="btn-dashboard btn-dashboard-sm" style={{ fontSize: 10, padding: '3px 8px' }}>
                            {copiedCode === link.shortCode ? 'copied' : 'copy'}
                          </button>
                          <button onClick={() => setLinkDeleteConfirm(link._id)} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 8px', color: 'var(--color-warning)', background: 'transparent', border: '1px solid var(--color-warning)', cursor: 'pointer' }}>
                            del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', padding: '12px 0', borderTop: '1px dashed var(--color-border)', display: 'flex', gap: 24 }}>
          <span>created {formatRelativeTime(campaign.createdAt)}</span>
          <span>updated {formatRelativeTime(campaign.updatedAt)}</span>
        </div>
      </div>

      {/* Delete Modal */}
      {linkDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => !linkDeleting && setLinkDeleteConfirm(null)}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 24, maxWidth: 400, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>delete link?</div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
              this action cannot be undone. historical data will be preserved.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setLinkDeleteConfirm(null)} disabled={linkDeleting} className="btn-dashboard" style={{ flex: 1 }}>cancel</button>
              <button onClick={() => handleDeleteLink(linkDeleteConfirm)} disabled={linkDeleting} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, padding: '8px 16px', background: 'var(--color-warning)', color: 'var(--color-bg)', border: 'none', cursor: linkDeleting ? 'not-allowed' : 'pointer' }}>
                {linkDeleting ? 'deleting...' : 'delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
