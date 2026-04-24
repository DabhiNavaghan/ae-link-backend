'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatRelativeTime, copyToClipboard } from '@/lib/utils/slug';
import { AeLinkApi } from '@/lib/api';

const api = new AeLinkApi();

interface LinkItem {
  _id: string;
  shortCode: string;
  destinationUrl: string;
  linkType: string;
  campaignId?: string;
  campaignName?: string;
  clickCount: number;
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
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const itemsPerPage = 10;
  const linkTypes = ['event', 'ticket', 'profile', 'category', 'custom'];

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [campaignFilter, linkTypeFilter, searchQuery, page]);

  async function fetchCampaigns() {
    try {
      const data = await api.listCampaigns({ limit: 100 });
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
        linkType: linkTypeFilter || undefined,
        search: searchQuery || undefined,
        limit: itemsPerPage,
        offset: (page - 1) * itemsPerPage,
      });

      setLinks((data.links || []) as unknown as LinkItem[]);
      const total = data.total || 0;
      setTotalPages(Math.ceil(total / itemsPerPage));
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
      const domain = typeof window !== 'undefined' ? window.location.origin : 'https://aelink.vercel.app';
      await copyToClipboard(`${domain}/${shortCode}`);
      setCopiedCode(shortCode);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }

  return (
    <div className="min-h-screen bg-base p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Links</h1>
          <p className="text-slate-600 mt-2">
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
      <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Campaign Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Campaign
            </label>
            <select
              value={campaignFilter}
              onChange={(e) => {
                setCampaignFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Link Type
            </label>
            <select
              value={linkTypeFilter}
              onChange={(e) => {
                setLinkTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            <label className="block text-sm font-medium text-slate-700 mb-2">
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
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 mb-6 text-danger-800">
          {error}
        </div>
      )}

      {/* Links Table */}
      {loading ? (
        <div className="bg-card rounded-lg shadow-sm p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          <p className="text-slate-600 mt-4">Loading links...</p>
        </div>
      ) : links.length === 0 ? (
        <div className="bg-card rounded-lg shadow-sm p-12 text-center">
          <svg
            className="mx-auto w-12 h-12 text-slate-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No links yet
          </h3>
          <p className="text-slate-600 mb-6">Create your first link to get started</p>
          <Button
            variant="primary"
            onClick={() => router.push('/dashboard/links/create')}
          >
            Create Link
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Short Code
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Destination
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Campaign
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Clicks
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Created
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {links.map((link, idx) => (
                  <tr
                    key={link._id}
                    className={`border-t border-slate-200 hover:bg-slate-50 transition ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/links/${link._id}`}
                        className="text-primary-600 hover:text-primary-700 font-mono font-semibold"
                      >
                        {link.shortCode}
                      </Link>
                      <p className="text-xs text-slate-500 mt-1">
                        {(typeof window !== 'undefined' ? window.location.host : 'smartlink.vercel.app')}/{link.shortCode}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={link.destinationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 text-sm truncate block max-w-xs"
                        title={link.destinationUrl}
                      >
                        {link.destinationUrl}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <Badge status="active" size="sm">
                        {link.linkType}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {link.campaignName ? (
                        <Link
                          href={`/dashboard/campaigns/${link.campaignId}`}
                          className="text-primary-600 hover:text-primary-700"
                        >
                          {link.campaignName}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-medium">
                      {link.clickCount}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatRelativeTime(link.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleCopyLink(link.shortCode)}
                          className="px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded transition"
                          title="Copy link"
                        >
                          {copiedCode === link.shortCode ? '✓' : '📋'}
                        </button>
                        <Link
                          href={`/dashboard/links/${link._id}`}
                          className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded transition"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => setDeleteConfirm(link._id)}
                          className="px-2 py-1 text-sm text-danger-500 hover:bg-danger-50 hover:text-danger-700 rounded transition"
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
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-card rounded-xl shadow-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-danger-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Delete Link?
              </h3>
            </div>
            <p className="text-slate-600 mb-6 text-sm">
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
