'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { copyToClipboard } from '@/lib/utils/slug';
import { SmartLinkApi } from '@/lib/api';
import { useDashboard } from '@/lib/context/DashboardContext';

const api = new SmartLinkApi();

interface LinkItem {
  _id: string;
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
  const { selectedAppId, isContextReady } = useDashboard();
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

  useEffect(() => {
    if (!isContextReady) return;
    fetchCampaigns();
  }, [selectedAppId, isContextReady]);

  useEffect(() => {
    if (!isContextReady) return;
    fetchLinks();
  }, [campaignFilter, linkTypeFilter, searchQuery, page, selectedAppId, isContextReady]);

  async function fetchCampaigns() {
    try {
      const data = await api.listCampaigns({ appId: selectedAppId || undefined, limit: 100 });
      setCampaigns((data.campaigns || []) as unknown as Campaign[]);
    } catch (err) {
      console.error('Failed to load campaigns', err);
    }
  }

  async function fetchLinks() {
    try {
      setLoading(true);
      const data = await api.listLinks({
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
        linkList.map((l) => api.getLinkAnalytics(l._id))
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
      await api.deleteLink(id);
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
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
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

      {/* Filters */}
      <div className="bg-card shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Campaign Filter */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Campaign
            </label>
            <select
              value={campaignFilter}
              onChange={(e) => {
                setCampaignFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            >
              <option value="">All Campaigns</option>
              {campaigns.map((camp) => (
                <option key={camp._id} value={camp._id}>
                  {camp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Link Type Filter */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Link Type
            </label>
            <select
              value={linkTypeFilter}
              onChange={(e) => {
                setLinkTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            >
              <option value="">All Types</option>
              {linkTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Search short code or URL..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            />
          </div>
        </div>
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
                        className="font-mono font-semibold"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {link.shortCode}
                      </Link>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
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
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleCopyLink(link.shortCode)}
                          className="px-3 py-1 text-sm rounded transition"
                          style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-hover)' }}
                          title="Copy link"
                        >
                          {copiedCode === link.shortCode ? '✓' : '📋'}
                        </button>
                        <Link
                          href={`/dashboard/links/${link._id}/edit`}
                          className="px-3 py-1 text-sm rounded transition"
                          style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-hover)' }}
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => setDeleteConfirm(link._id)}
                          className="px-2 py-1 text-sm rounded transition"
                          style={{ color: 'var(--color-accent)' }}
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
