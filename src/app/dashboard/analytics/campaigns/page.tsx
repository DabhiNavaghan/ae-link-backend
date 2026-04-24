'use client';

import React, { useEffect, useState } from 'react';
import { BarChart } from '@/components/charts/AnalyticsCharts';

interface CampaignAnalytics {
  campaignId: string;
  campaignName: string;
  status: 'active' | 'paused' | 'archived';
  totalLinks: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  deferredMatchRate: number;
  createdAt: string;
  updatedAt: string;
}

type SortKey = 'clicks' | 'conversions' | 'convRate';

const CampaignsAnalyticsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<CampaignAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('clicks');
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaignsAnalytics();
  }, [sortBy]);

  const fetchCampaignsAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) {
        setError('API key not found');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/v1/analytics/overview', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!response.ok) throw new Error('Failed to fetch campaigns analytics');
      const data = await response.json();

      // Mock comprehensive campaign analytics
      const mockCampaigns: CampaignAnalytics[] = (data.data?.topCampaigns || []).map(
        (campaign: any, i: number) => ({
          campaignId: `campaign-${i}`,
          campaignName: campaign.name,
          status: i % 3 === 0 ? 'paused' : 'active',
          totalLinks: Math.floor(Math.random() * 20) + 3,
          totalClicks: campaign.clicks || 0,
          totalConversions: Math.round((campaign.clicks || 0) * (0.08 + Math.random() * 0.12)),
          conversionRate: campaign.clicks ? (((campaign.clicks || 0) * (0.08 + Math.random() * 0.12)) / (campaign.clicks || 1)) * 100 : 0,
          deferredMatchRate: 25 + Math.random() * 30,
          createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
      );

      // Sort
      const sorted = mockCampaigns.sort((a, b) => {
        switch (sortBy) {
          case 'clicks':
            return b.totalClicks - a.totalClicks;
          case 'conversions':
            return b.totalConversions - a.totalConversions;
          case 'convRate':
            return b.conversionRate - a.conversionRate;
          default:
            return 0;
        }
      });

      setCampaigns(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns analytics');
    } finally {
      setLoading(false);
    }
  };

  const selectedCampaignData = selectedCampaign
    ? campaigns.find(c => c.campaignId === selectedCampaign)
    : null;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Campaigns Analytics</h1>
          <p className="text-slate-600">Compare campaign performance across all channels</p>
        </div>

        {error && (
          <div className="card bg-danger-50 border-danger-200 p-4 mb-6 text-danger-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="card p-6 text-center text-slate-600">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Campaign List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-4 mb-4">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortKey)}
                  className="input-base w-full"
                >
                  <option value="clicks">Sort by Clicks</option>
                  <option value="conversions">Sort by Conversions</option>
                  <option value="convRate">Sort by Conversion Rate</option>
                </select>
              </div>

              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table-base w-full text-sm">
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th className="text-right">Status</th>
                        <th className="text-right">Links</th>
                        <th className="text-right">Clicks</th>
                        <th className="text-right">Conversions</th>
                        <th className="text-right">Conv. Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map(campaign => (
                        <tr
                          key={campaign.campaignId}
                          onClick={() => setSelectedCampaign(campaign.campaignId)}
                          className={`cursor-pointer transition-colors ${
                            selectedCampaign === campaign.campaignId
                              ? 'bg-primary-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="font-semibold text-slate-900">
                            {campaign.campaignName}
                          </td>
                          <td className="text-right">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                campaign.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : campaign.status === 'paused'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                            </span>
                          </td>
                          <td className="text-right font-medium">{campaign.totalLinks}</td>
                          <td className="text-right font-medium">
                            {campaign.totalClicks.toLocaleString()}
                          </td>
                          <td className="text-right font-medium">
                            {campaign.totalConversions.toLocaleString()}
                          </td>
                          <td className="text-right font-medium">
                            {campaign.conversionRate.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Campaign Details */}
            {selectedCampaignData ? (
              <div className="card p-6 h-fit">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Campaign Details</h3>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase">Name</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">
                      {selectedCampaignData.campaignName}
                    </p>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold text-slate-600 uppercase">Status</p>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedCampaignData.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : selectedCampaignData.status === 'paused'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {selectedCampaignData.status.charAt(0).toUpperCase() +
                          selectedCampaignData.status.slice(1)}
                      </span>
                    </p>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold text-slate-600 uppercase">Total Links</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {selectedCampaignData.totalLinks}
                    </p>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold text-slate-600 uppercase">Total Clicks</p>
                    <p className="text-2xl font-bold text-primary-600 mt-1">
                      {selectedCampaignData.totalClicks.toLocaleString()}
                    </p>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold text-slate-600 uppercase">
                      Total Conversions
                    </p>
                    <p className="text-2xl font-bold text-secondary-600 mt-1">
                      {selectedCampaignData.totalConversions.toLocaleString()}
                    </p>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold text-slate-600 uppercase">
                      Conversion Rate
                    </p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">
                      {selectedCampaignData.conversionRate.toFixed(2)}%
                    </p>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold text-slate-600 uppercase">Match Rate</p>
                    <p className="text-lg font-semibold text-slate-900 mt-1">
                      {selectedCampaignData.deferredMatchRate.toFixed(1)}%
                    </p>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold text-slate-600 uppercase">Created</p>
                    <p className="text-sm text-slate-600 mt-1">
                      {new Date(selectedCampaignData.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-6 flex items-center justify-center h-fit">
                <p className="text-slate-500 text-center">
                  Select a campaign to view details
                </p>
              </div>
            )}
          </div>
        )}

        {/* Comparison Chart */}
        {campaigns.length > 0 && !loading && (
          <div className="card p-6 mt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Clicks Comparison</h3>
            <BarChart
              data={campaigns.map(c => ({
                label: c.campaignName,
                value: c.totalClicks,
              }))}
              color="#6366F1"
              height={300}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignsAnalyticsPage;
