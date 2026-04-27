'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
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
          };
          setAnalytics(fresh);
          pageCache.set(campaignId, { campaign: typedCampaign, links: typedLinks, analytics: fresh });
        })
        .catch(() => {
          setAnalytics({ totalClicks: 0, totalConversions: 0, conversionRate: 0, deferredMatches: 0 });
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

  if (loading) {
    return (
      <div className="min-h-screen bg-base p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 rounded-full animate-spin mb-4" style={{ borderColor: 'var(--color-primary-light)', borderTopColor: 'var(--color-primary)' }}></div>
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading campaign...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-base p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="font-medium mb-4"
            style={{ color: 'var(--color-primary)' }}
          >
            ← Back
          </button>
          <div className="border rounded-lg p-6" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
            {error || 'Campaign not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base p-8">
      <div className="max-w-5xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="font-medium mb-4"
          style={{ color: 'var(--color-primary)' }}
        >
          ← Back
        </button>

        {/* Error Message */}
        {error && (
          <div className="border rounded-lg p-4 mb-6" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        {/* Header */}
        <div className="rounded-lg shadow-sm p-8 mb-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              {editingName ? (
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    className="flex-1 px-4 py-2 border rounded-lg"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)' }}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleUpdateName}
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingName(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
                  {campaign.name}
                </h1>
              )}
              <p className="font-mono text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                Slug: /{campaign.slug}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Badge status={campaign.status}>
                {campaign.status.charAt(0).toUpperCase() +
                  campaign.status.slice(1)}
              </Badge>

              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/dashboard/campaigns/${campaignId}/edit`)}
              >
                ✏️ Edit
              </Button>

              {campaign.status === 'active' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('paused')}
                >
                  Pause
                </Button>
              ) : campaign.status === 'paused' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('active')}
                >
                  Resume
                </Button>
              ) : null}
            </div>
          </div>

          {/* Description */}
          {editingDescription ? (
            <div className="mb-6">
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                autoFocus
                className="w-full px-4 py-2 border rounded-lg mb-2"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)', color: 'var(--color-text)' }}
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleUpdateDescription}
                >
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingDescription(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingDescription(true)}
              className="cursor-pointer rounded p-2 -m-2 transition"
              style={{ '--hover-bg': 'var(--color-bg-secondary)' } as any}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {campaign.description ? (
                <p style={{ color: 'var(--color-text-secondary)' }}>{campaign.description}</p>
              ) : (
                <p style={{ color: 'var(--color-text-tertiary)' }}>Add a description...</p>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg shadow-sm p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Total Links</p>
            {analyticsLoading ? (
              <div className="h-8 w-16 animate-pulse rounded mt-1" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
            ) : (
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{links.length}</p>
            )}
          </div>

          <div className="rounded-lg shadow-sm p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Total Clicks</p>
            {analyticsLoading ? (
              <div className="h-8 w-16 animate-pulse rounded mt-1" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
            ) : (
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{analytics?.totalClicks || 0}</p>
            )}
          </div>

          <div className="rounded-lg shadow-sm p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Conversions</p>
            {analyticsLoading ? (
              <div className="h-8 w-16 animate-pulse rounded mt-1" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
            ) : (
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{analytics?.totalConversions || 0}</p>
            )}
          </div>

          <div className="rounded-lg shadow-sm p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Conv. Rate</p>
            {analyticsLoading ? (
              <div className="h-8 w-20 animate-pulse rounded mt-1" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
            ) : (
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{(analytics?.conversionRate || 0).toFixed(2)}%</p>
            )}
          </div>
        </div>

        {/* Campaign Metadata */}
        {campaign.metadata && Object.keys(campaign.metadata).length > 0 && (
          <div className="rounded-lg shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
              Metadata
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(campaign.metadata).map(([key, value]) => (
                <div key={key} className="rounded p-3" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{key}</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {String(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dates */}
        {(campaign.startDate || campaign.endDate) && (
          <div className="rounded-lg shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
              Duration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaign.startDate && (
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Start Date</p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {formatDate(campaign.startDate)}
                  </p>
                </div>
              )}
              {campaign.endDate && (
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>End Date</p>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {formatDate(campaign.endDate)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Links in Campaign */}
        <div className="rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <div className="p-6 flex items-center justify-between" style={{ borderBottomColor: 'var(--color-border)', borderBottomWidth: '1px' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              Links ({links.length})
            </h3>
            <Link
              href={`/dashboard/links/create?campaignId=${campaignId}`}
              className="px-4 py-2 text-white rounded-lg transition"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              + Add Link
            </Link>
          </div>

          {links.length === 0 ? (
            <div className="p-12 text-center">
              <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                No links created for this campaign yet
              </p>
              <Link
                href={`/dashboard/links/create?campaignId=${campaignId}`}
                className="inline-block px-4 py-2 text-white rounded-lg transition"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Create First Link
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: 'var(--color-bg-secondary)', borderTopColor: 'var(--color-border)', borderBottomColor: 'var(--color-border)', borderTopWidth: '1px', borderBottomWidth: '1px' }}>
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      Short Code
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      Destination
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      Clicks
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      Conversions
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link, idx) => (
                    <tr
                      key={link._id}
                      className="transition"
                      style={{
                        borderTopColor: 'var(--color-border)',
                        borderTopWidth: '1px',
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)'}
                    >
                      <td className="px-6 py-4">
                        <span className="font-medium font-mono" style={{ color: 'var(--color-text)' }}>
                          {link.shortCode}
                        </span>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                          {typeof window !== 'undefined' ? window.location.host : ''}/{link.shortCode}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <span
                          title={link.destinationUrl}
                          className="truncate block max-w-xs"
                        >
                          {link.destinationUrl}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium" style={{ color: 'var(--color-text)' }}>
                        {linkAnalyticsLoading ? (
                          <div className="h-4 w-10 animate-pulse rounded" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
                        ) : (
                          link.clickCount.toLocaleString()
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium" style={{ color: 'var(--color-text)' }}>
                        {linkAnalyticsLoading ? (
                          <div className="h-4 w-10 animate-pulse rounded" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
                        ) : (
                          (link.conversionCount ?? 0).toLocaleString()
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleCopyLink(link.shortCode)}
                            className="px-3 py-1 text-sm rounded transition"
                            style={{ color: 'var(--color-text-secondary)' }}
                            title="Copy link"
                          >
                            {copiedCode === link.shortCode ? '✓' : '📋'}
                          </button>
                          <Link
                            href={`/dashboard/links/${link._id}/edit`}
                            className="px-3 py-1 text-sm rounded transition"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => setLinkDeleteConfirm(link._id)}
                            className="px-2 py-1 text-sm rounded transition"
                            style={{ color: 'var(--color-danger)' }}
                            title="Delete link"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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

        {/* Campaign Info */}
        <div className="bg-slate-50 rounded-lg p-4 mt-6 text-xs text-slate-500">
          <p>Created {formatRelativeTime(campaign.createdAt)}</p>
          <p>Last updated {formatRelativeTime(campaign.updatedAt)}</p>
        </div>
      </div>

      {/* Link Delete Confirmation Modal */}
      {linkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => !linkDeleting && setLinkDeleteConfirm(null)}>
          <div className="bg-card rounded-xl shadow-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-danger-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Delete Link?</h3>
            </div>
            <p className="text-slate-600 mb-6 text-sm">
              This action cannot be undone. Historical data will be preserved.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => setLinkDeleteConfirm(null)} disabled={linkDeleting}>
                Cancel
              </Button>
              <Button variant="danger" fullWidth onClick={() => handleDeleteLink(linkDeleteConfirm)} disabled={linkDeleting}>
                {linkDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
