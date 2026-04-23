'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AeLinkApi } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatDate, formatRelativeTime } from '@/lib/utils/slug';

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
  createdAt: string;
  updatedAt: string;
}

const api = new AeLinkApi();

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'paused' | 'archived'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const itemsPerPage = 10;

  useEffect(() => {
    fetchCampaigns();
  }, [statusFilter, searchQuery, page]);

  async function fetchCampaigns() {
    try {
      setLoading(true);
      const data = await api.listCampaigns({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery,
        limit: itemsPerPage,
        offset: (page - 1) * itemsPerPage,
      });

      setCampaigns(data.campaigns as unknown as Campaign[]);
      const total = data.total || 0;
      setTotalPages(Math.ceil(total / itemsPerPage));
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading campaigns');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      await api.updateCampaign(id, {
        status: newStatus as 'active' | 'paused' | 'archived',
      });

      setCampaigns(
        campaigns.map((c) =>
          c._id === id ? { ...c, status: newStatus as 'active' | 'paused' | 'archived' } : c
        )
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update campaign');
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await api.deleteCampaign(id);
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
    <div className="min-h-screen bg-base p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-slate-600 mt-2">
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

      {/* Filters */}
      <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Status Filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Campaigns</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Search
            </label>
            <input
              type="text"
              placeholder="Search by name..."
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

      {/* Campaigns Table */}
      {loading ? (
        <div className="bg-card rounded-lg shadow-sm p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          <p className="text-slate-600 mt-4">Loading campaigns...</p>
        </div>
      ) : campaigns.length === 0 ? (
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
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No campaigns yet
          </h3>
          <p className="text-slate-600 mb-6">
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
        <div className="bg-card rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Campaign
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Links
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Dates
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
                {campaigns.map((campaign, idx) => (
                  <tr
                    key={campaign._id}
                    className={`border-t border-slate-200 hover:bg-slate-50 transition ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/campaigns/${campaign._id}`}
                        className="text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {campaign.name}
                      </Link>
                      <p className="text-sm text-slate-500 mt-1">
                        /{campaign.slug}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={campaign.status}>
                        {campaign.status.charAt(0).toUpperCase() +
                          campaign.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-900">
                      {campaign.linkCount || 0} link
                      {campaign.linkCount !== 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {campaign.startDate && campaign.endDate ? (
                        <span>
                          {formatDate(campaign.startDate)} to{' '}
                          {formatDate(campaign.endDate)}
                        </span>
                      ) : campaign.startDate ? (
                        <span>From {formatDate(campaign.startDate)}</span>
                      ) : (
                        <span className="text-slate-400">No dates set</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatRelativeTime(campaign.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/campaigns/${campaign._id}`}
                          className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded transition"
                        >
                          View
                        </Link>

                        {campaign.status === 'active' ? (
                          <button
                            onClick={() =>
                              handleStatusChange(campaign._id, 'paused')
                            }
                            className="px-3 py-1 text-sm text-warning-600 hover:bg-warning-50 rounded transition"
                          >
                            Pause
                          </button>
                        ) : campaign.status === 'paused' ? (
                          <button
                            onClick={() =>
                              handleStatusChange(campaign._id, 'active')
                            }
                            className="px-3 py-1 text-sm text-success-600 hover:bg-success-50 rounded transition"
                          >
                            Resume
                          </button>
                        ) : null}

                        <button
                          onClick={() => setDeleteConfirm(campaign._id)}
                          className="px-2 py-1 text-sm text-danger-500 hover:bg-danger-50 hover:text-danger-700 rounded transition"
                          title="Delete campaign"
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
                Delete Campaign?
              </h3>
            </div>
            <p className="text-slate-600 mb-6 text-sm">
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
