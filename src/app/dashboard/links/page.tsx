'use client';

import Button from '@/components/ui/Button';
import { smartLinkApi } from '@/lib/api';
import { useDashboard } from '@/lib/context/DashboardContext';
import { copyToClipboard } from '@/lib/utils/slug';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface LinkItem {
  _id: string;
  title?: string;
  shortCode: string;
  destinationUrl: string;
  linkType: string;
  campaignId?: string;
  campaignName?: string;
  clickCount: number;
  conversionCount?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Campaign {
  _id: string;
  name: string;
}

export default function LinksPage() {
  const router = useRouter();
  const { selectedAppId, isContextReady, can } = useDashboard();
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaignFilter, setCampaignFilter] = useState('');
  const [linkTypeFilter, setLinkTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const itemsPerPage = 10;
  const linkTypes = ['event', 'ticket', 'profile', 'category', 'custom'];

  // Permission gate: redirect if no link access
  useEffect(() => {
    if (isContextReady && !can('manage:links')) {
      router.replace('/dashboard');
    }
  }, [isContextReady, can, router]);

  useEffect(() => {
    if (!isContextReady || !can('manage:links')) return;
    fetchCampaigns();
  }, [selectedAppId, isContextReady]);

  useEffect(() => {
    if (!isContextReady || !can('manage:links')) return;
    fetchLinks();
  }, [campaignFilter, linkTypeFilter, searchQuery, page, selectedAppId, isContextReady]);

  async function fetchCampaigns() {
    try {
      const data = await smartLinkApi.listCampaigns({ appId: selectedAppId || undefined, limit: 100 });
      setCampaigns((data.campaigns || []) as unknown as Campaign[]);
    } catch (err) {
      console.error('Failed to load campaigns', err);
    }
  }

  async function fetchLinks() {
    try {
      setLoading(true);
      const data = await smartLinkApi.listLinks({
        campaignId: campaignFilter || undefined,
        appId: selectedAppId || undefined,
        linkType: linkTypeFilter || undefined,
        search: searchQuery || undefined,
        limit: itemsPerPage,
        offset: (page - 1) * itemsPerPage,
      });

      const linkList = (data.links || []) as unknown as LinkItem[];
      setLinks(linkList);
      const total = data.total || 0;
      setTotalPages(Math.ceil(total / itemsPerPage));

      // Fetch analytics for each link in parallel (background)
      setAnalyticsLoading(true);
      Promise.allSettled(
        linkList.map((l) => smartLinkApi.getLinkAnalytics(l._id))
      ).then((results) => {
        setLinks((prev) =>
          prev.map((l, i) => {
            const result = results[i];
            if (result.status === 'fulfilled') {
              return { ...l, conversionCount: result.value.conversions?.total ?? 0 };
            }
            return l;
          })
        );
        setAnalyticsLoading(false);
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load links');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await smartLinkApi.deleteLink(id);
      setLinks(links.filter((l) => l._id !== id));
      setDeleteConfirm(null);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete link');
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
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

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="dashboard-header-flex mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
            Links
          </h1>
          <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            {links.length} link{links.length !== 1 ? 's' : ''} shown
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => router.push('/dashboard/links/create')}
        >
          + Create Link
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="border p-4 mb-6"
          style={{
            backgroundColor: 'rgba(255, 61, 138, 0.1)',
            borderColor: 'var(--color-accent)',
            color: 'var(--color-accent)',
          }}
        >
          {error}
        </div>
      )}

      {/* Links Table */}
      {loading && links.length === 0 ? (
        <div className="bg-card shadow-sm p-12 text-center" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <div
            className="inline-block w-8 h-8 border-4 rounded-full animate-spin"
            style={{
              borderColor: 'var(--color-primary)',
              borderTopColor: 'var(--color-bg)',
            }}
          ></div>
          <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>
            Loading links...
          </p>
        </div>
      ) : !loading && links.length === 0 ? (
        <div className="bg-card shadow-sm p-12 text-center" style={{ backgroundColor: 'var(--color-bg-card)' }}>
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
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
            No links yet
          </h3>
          <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            Create your first link to get started
          </p>
          <Button
            variant="primary"
            onClick={() => router.push('/dashboard/links/create')}
          >
            Create Link
          </Button>
        </div>
      ) : (
        <div className="bg-card shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottomColor: 'var(--color-border)' }} className="border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Short Code
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Destination
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Campaign
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
                      backgroundColor: idx % 2 === 0 ? 'var(--color-bg-card)' : 'var(--color-bg-secondary)',
                    }}
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/links/${link._id}`}
                        className="font-semibold"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {link.title || link.shortCode}
                      </Link>
                      {link.title && (
                        <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                          {link.shortCode}
                        </p>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                        {(typeof window !== 'undefined' ? window.location.host : 'smartlink.vercel.app')}/{link.shortCode}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={link.destinationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm truncate block max-w-xs"
                        style={{ color: 'var(--color-primary)' }}
                        title={link.destinationUrl}
                      >
                        {link.destinationUrl}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {link.campaignId ? (() => {
                        const camp = campaigns.find(c => c._id === link.campaignId);
                        return camp ? (
                          <Link
                            href={`/dashboard/campaigns/${link.campaignId}`}
                            style={{ color: 'var(--color-primary)' }}
                          >
                            {camp.name}
                          </Link>
                        ) : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
                      })() : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                    </td>
                    <td className="px-6 py-4 font-medium" style={{ color: 'var(--color-text)' }}>
                      {analyticsLoading ? (
                        <div className="h-4 w-10 rounded animate-pulse" style={{ backgroundColor: 'var(--color-bg-hover)' }} />
                      ) : (
                        link.clickCount.toLocaleString()
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium" style={{ color: 'var(--color-text)' }}>
                      {analyticsLoading ? (
                        <div className="h-4 w-10 rounded animate-pulse" style={{ backgroundColor: 'var(--color-bg-hover)' }} />
                      ) : (
                        (link.conversionCount ?? 0).toLocaleString()
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Copy link */}
                        <button
                          onClick={() => handleCopyLink(link.shortCode)}
                          className="p-1.5 transition-colors hover-bg-secondary"
                          style={{ color: copiedCode === link.shortCode ? 'var(--color-success)' : 'var(--color-text-secondary)' }}
                          title="Copy link"
                        >
                          {copiedCode === link.shortCode ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                          )}
                        </button>
                        {/* Edit link */}
                        <Link
                          href={`/dashboard/links/${link._id}/edit`}
                          className="p-1.5 transition-colors hover-bg-secondary inline-flex"
                          style={{ color: 'var(--color-text-secondary)' }}
                          title="Edit link"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </Link>
                        {/* Delete link */}
                        <button
                          onClick={() => setDeleteConfirm(link._id)}
                          className="p-1.5 transition-colors hover-bg-secondary"
                          style={{ color: 'var(--color-danger)' }}
                          title="Delete link"
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
            <div
              className="border-t px-6 py-4 flex items-center justify-between"
              style={{ backgroundColor: 'var(--color-bg-secondary)', borderTopColor: 'var(--color-border)' }}
            >
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 text-sm border disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-bg-hover)',
                    color: 'var(--color-text)',
                  }}
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-2 text-sm border disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-bg-hover)',
                    color: 'var(--color-text)',
                  }}
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
          <div className="bg-card shadow-xl p-6 max-w-sm mx-4" style={{ backgroundColor: 'var(--color-bg-card)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 61, 138, 0.2)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-accent)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                Delete Link?
              </h3>
            </div>
            <p className="mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              This action cannot be undone. The link will become inactive but
              historical data will be preserved.
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
