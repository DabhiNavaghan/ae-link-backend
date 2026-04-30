'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { smartLinkApi } from '@/lib/api';
import { useDashboard } from '@/lib/context/DashboardContext';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface Campaign {
  _id: string;
  name: string;
  slug: string;
  status: 'active' | 'paused' | 'archived';
  description?: string;
  fallbackUrl?: string;
  startDate?: string;
  endDate?: string;
  linkCount?: number;
  totalClicks?: number;
  totalConversions?: number;
  createdAt: string;
  updatedAt: string;
}

export default function CampaignsPage() {
  const router = useRouter();
  const { isContextReady, can, selectedAppId } = useDashboard();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const itemsPerPage = 10;

  // Permission gate: redirect if no campaign access
  useEffect(() => {
    if (isContextReady && !can('manage:campaigns')) {
      router.replace('/dashboard');
    }
  }, [isContextReady, can, router]);

  // Track previous selectedAppId so we can reset page when the app filter changes
  const prevAppIdRef = useRef(selectedAppId);

  useEffect(() => {
    if (!isContextReady || !can('manage:campaigns')) return;

    // When the app filter changes, reset to page 1 and re-run
    if (prevAppIdRef.current !== selectedAppId) {
      prevAppIdRef.current = selectedAppId;
      setPage(1);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const params: Record<string, any> = {
          limit: itemsPerPage,
          offset: (page - 1) * itemsPerPage,
        };
        if (selectedAppId) params.appId = selectedAppId;

        const data = await smartLinkApi.listCampaigns(params);
        if (cancelled) return;

        const campaignList = data.campaigns as unknown as Campaign[];
        setCampaigns(campaignList);
        setTotalPages(Math.ceil((data.total || 0) / itemsPerPage));

        setAnalyticsLoading(true);
        const analyticsResults = await Promise.allSettled(
          campaignList.map((c) => smartLinkApi.getCampaignAnalytics(c._id))
        );
        if (cancelled) return;

        setCampaigns(campaignList.map((c, i) => {
          const r = analyticsResults[i];
          if (r.status === 'fulfilled') {
            return {
              ...c,
              linkCount: r.value.totalLinks ?? c.linkCount,
              totalClicks: r.value.totalClicks ?? 0,
              totalConversions: r.value.totalConversions ?? 0,
            };
          }
          return c;
        }));
        setAnalyticsLoading(false);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'An error occurred while loading campaigns');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isContextReady, selectedAppId, page]);

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await smartLinkApi.deleteCampaign(id);
      setCampaigns(campaigns.filter((c) => c._id !== id));
      setDeleteConfirm(null);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete campaign');
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      {/* Header */}
      <div className="dashboard-header-flex mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text)' }}>Campaigns</h1>
          <p className="mt-2 text-sm md:text-base" style={{ color: 'var(--color-text-secondary)' }}>
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => router.push('/dashboard/campaigns/create')}
        >
          + New Campaign
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="border p-4 mb-6" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      {/* Campaigns Table */}
      {loading && campaigns.length === 0 ? (
        <div className="shadow-sm p-12 text-center" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <div className="inline-block w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary-light)', borderTopColor: 'var(--color-primary)' }}></div>
          <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>Loading campaigns...</p>
        </div>
      ) : !loading && campaigns.length === 0 ? (
        <div className="shadow-sm p-12 text-center" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <svg
            className="mx-auto w-12 h-12 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
            No campaigns yet
          </h3>
          <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            Create your first campaign to get started
          </p>
          <Button
            variant="primary"
            onClick={() => router.push('/dashboard/campaigns/create')}
          >
            Create Campaign
          </Button>
        </div>
      ) : (
        <div className="shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <div className="dashboard-table-wrapper">
            <table className="w-full">
              <thead style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottomColor: 'var(--color-border)', borderBottomWidth: '1px' }}>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Campaign
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Links
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
                {campaigns.map((campaign, idx) => (
                  <tr
                    key={campaign._id}
                    className="transition"
                    style={{
                      borderTopColor: 'var(--color-border)',
                      borderTopWidth: '1px',
                      backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)',
                      '--hover-bg': 'var(--color-bg-secondary)'
                    } as any}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)'}
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/campaigns/${campaign._id}`}
                        className="font-medium"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {campaign.name}
                      </Link>
                      <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        /{campaign.slug}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={campaign.status}>
                        {campaign.status.charAt(0).toUpperCase() +
                          campaign.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4" style={{ color: 'var(--color-text)' }}>
                      {analyticsLoading ? (
                        <div className="h-4 w-8 animate-pulse" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
                      ) : (
                        campaign.linkCount ?? 0
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium" style={{ color: 'var(--color-text)' }}>
                      {analyticsLoading ? (
                        <div className="h-4 w-10 animate-pulse" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
                      ) : (
                        (campaign.totalClicks ?? 0).toLocaleString()
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium" style={{ color: 'var(--color-text)' }}>
                      {analyticsLoading ? (
                        <div className="h-4 w-10 animate-pulse" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
                      ) : (
                        (campaign.totalConversions ?? 0).toLocaleString()
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Edit campaign */}
                        <Link
                          href={`/dashboard/campaigns/${campaign._id}/edit`}
                          className="p-1.5 transition-colors hover-bg-secondary inline-flex"
                          style={{ color: 'var(--color-text-secondary)' }}
                          title="Edit campaign"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </Link>
                        {/* Delete campaign */}
                        <button
                          onClick={() => setDeleteConfirm(campaign._id)}
                          className="p-1.5 transition-colors hover-bg-secondary"
                          style={{ color: 'var(--color-danger)' }}
                          title="Delete campaign"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--color-bg-secondary)', borderTopColor: 'var(--color-border)', borderTopWidth: '1px' }}>
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 text-sm border disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderColor: 'var(--color-border)', borderWidth: '1px', color: 'var(--color-text-secondary)' }}
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-2 text-sm border disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderColor: 'var(--color-border)', borderWidth: '1px', color: 'var(--color-text-secondary)' }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => !deleting && setDeleteConfirm(null)}>
          <div className="shadow-xl p-6 max-w-sm mx-4" style={{ backgroundColor: 'var(--color-bg-card)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 flex items-center justify-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-danger)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                Delete Campaign?
              </h3>
            </div>
            <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              This action cannot be undone. All associated links will be marked
              inactive.
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                fullWidth
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
