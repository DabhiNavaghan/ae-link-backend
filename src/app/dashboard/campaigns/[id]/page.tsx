'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatDate, formatRelativeTime } from '@/lib/utils/slug';
import { AeLinkApi } from '@/lib/api';

const api = new AeLinkApi();

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
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    fetchData();
  }, [campaignId]);

  async function fetchData() {
    try {
      setLoading(true);
      const [campaignData, analyticsData] = await Promise.all([
        api.getCampaign(campaignId),
        api.getCampaignAnalytics(campaignId),
      ]);

      const typedCampaignData = campaignData as unknown as Campaign;
      setCampaign(typedCampaignData);
      setEditName(typedCampaignData.name);
      setEditDescription(typedCampaignData.description || '');

      // Transform analytics data
      setAnalytics({
        totalClicks: analyticsData.totalClicks || 0,
        totalConversions: analyticsData.totalConversions || 0,
        conversionRate: analyticsData.conversionRate || 0,
        deferredMatches: 0,
      });

      // Fetch links in this campaign
      const linksData = await api.listLinks({ campaignId });
      setLinks((linksData.links || []) as unknown as LinkItem[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign');
    } finally {
      setLoading(false);
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
      setCampaign(updated as unknown as Campaign);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-base p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600">Loading campaign...</p>
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
            className="text-primary-600 hover:text-primary-700 font-medium mb-4"
          >
            ← Back
          </button>
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-6 text-danger-800">
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
          className="text-primary-600 hover:text-primary-700 font-medium mb-4"
        >
          ← Back
        </button>

        {/* Error Message */}
        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 mb-6 text-danger-800">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="bg-card rounded-lg shadow-sm p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              {editingName ? (
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg"
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
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                  {campaign.name}
                </h1>
              )}
              <p className="text-slate-500 font-mono text-sm">
                Slug: /{campaign.slug}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Badge status={campaign.status}>
                {campaign.status.charAt(0).toUpperCase() +
                  campaign.status.slice(1)}
              </Badge>

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
                className="w-full px-4 py-2 border border-slate-200 rounded-lg mb-2"
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
              className="cursor-pointer hover:bg-slate-50 rounded p-2 -m-2 transition"
            >
              {campaign.description ? (
                <p className="text-slate-700">{campaign.description}</p>
              ) : (
                <p className="text-slate-400">Add a description...</p>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-lg shadow-sm p-4">
            <p className="text-sm text-slate-600 mb-1">Total Links</p>
            <p className="text-2xl font-bold text-slate-900">
              {links.length}
            </p>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-4">
            <p className="text-sm text-slate-600 mb-1">Total Clicks</p>
            <p className="text-2xl font-bold text-slate-900">
              {analytics?.totalClicks || 0}
            </p>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-4">
            <p className="text-sm text-slate-600 mb-1">Conversions</p>
            <p className="text-2xl font-bold text-slate-900">
              {analytics?.totalConversions || 0}
            </p>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-4">
            <p className="text-sm text-slate-600 mb-1">Conv. Rate</p>
            <p className="text-2xl font-bold text-slate-900">
              {(analytics?.conversionRate || 0).toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Campaign Metadata */}
        {campaign.metadata && Object.keys(campaign.metadata).length > 0 && (
          <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Metadata
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(campaign.metadata).map(([key, value]) => (
                <div key={key} className="bg-slate-50 rounded p-3">
                  <p className="text-sm font-medium text-slate-900">{key}</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {String(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dates */}
        {(campaign.startDate || campaign.endDate) && (
          <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Duration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaign.startDate && (
                <div>
                  <p className="text-sm text-slate-600">Start Date</p>
                  <p className="text-slate-900 font-medium">
                    {formatDate(campaign.startDate)}
                  </p>
                </div>
              )}
              {campaign.endDate && (
                <div>
                  <p className="text-sm text-slate-600">End Date</p>
                  <p className="text-slate-900 font-medium">
                    {formatDate(campaign.endDate)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Links in Campaign */}
        <div className="bg-card rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Links ({links.length})
            </h3>
            <Link
              href={`/dashboard/links/create?campaignId=${campaignId}`}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              + Add Link
            </Link>
          </div>

          {links.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-600 mb-4">
                No links created for this campaign yet
              </p>
              <Link
                href={`/dashboard/links/create?campaignId=${campaignId}`}
                className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
              >
                Create First Link
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-t border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                      Short Code
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                      Destination
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
                          className="text-primary-600 hover:text-primary-700 font-medium font-mono"
                        >
                          {link.shortCode}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <Badge status="active" size="sm">
                          {link.linkType}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <span
                          title={link.destinationUrl}
                          className="truncate block max-w-xs"
                        >
                          {link.destinationUrl}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-medium">
                        {link.clickCount}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatRelativeTime(link.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/links/${link._id}`}
                          className="text-primary-600 hover:text-primary-700 text-sm"
                        >
                          View
                        </Link>
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
    </div>
  );
}
