'use client';

import React, { useEffect, useState } from 'react';

interface LinkAnalytics {
  linkId: string;
  shortCode: string;
  totalClicks: number;
  conversions: {
    total: number;
    appOpen: number;
    registration: number;
    purchase: number;
    view: number;
  };
  deferredMatches: number;
  deferredMatchRate: number;
  createdAt: string;
  lastClicked: string;
}

type SortKey = 'clicks' | 'conversions' | 'matchRate';

const LinksAnalyticsPage: React.FC = () => {
  const [links, setLinks] = useState<LinkAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('clicks');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLinksAnalytics();
  }, [sortBy]);

  const fetchLinksAnalytics = async () => {
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

      if (!response.ok) throw new Error('Failed to fetch links analytics');
      const data = await response.json();

      // Mock comprehensive link analytics
      const mockLinks: LinkAnalytics[] = (data.data?.topLinks || []).map((link: any, i: number) => ({
        linkId: `link-${i}`,
        shortCode: link.shortCode,
        totalClicks: link.clicks || 0,
        conversions: {
          total: link.conversions || 0,
          appOpen: Math.round((link.conversions || 0) * 0.6),
          registration: Math.round((link.conversions || 0) * 0.2),
          purchase: Math.round((link.conversions || 0) * 0.15),
          view: Math.round((link.conversions || 0) * 0.05),
        },
        deferredMatches: Math.round((link.clicks || 0) * 0.3),
        deferredMatchRate: 30,
        createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
        lastClicked: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));

      // Sort
      const sorted = mockLinks.sort((a, b) => {
        switch (sortBy) {
          case 'clicks':
            return b.totalClicks - a.totalClicks;
          case 'conversions':
            return b.conversions.total - a.conversions.total;
          case 'matchRate':
            return b.deferredMatchRate - a.deferredMatchRate;
          default:
            return 0;
        }
      });

      setLinks(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load links analytics');
    } finally {
      setLoading(false);
    }
  };

  // Filter by search term
  const filteredLinks = links.filter(
    link =>
      link.shortCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.linkId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const conversionRate = (clicks: number, conversions: number) =>
    clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) : '0.00';

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Links Analytics</h1>
          <p className="text-slate-600">Individual link performance metrics</p>
        </div>

        {/* Controls */}
        <div className="card p-4 mb-6 flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Search by short code..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input-base flex-1 min-w-xs"
          />

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="input-base max-w-xs"
          >
            <option value="clicks">Sort by Clicks</option>
            <option value="conversions">Sort by Conversions</option>
            <option value="matchRate">Sort by Match Rate</option>
          </select>
        </div>

        {error && (
          <div className="card bg-danger-50 border-danger-200 p-4 mb-6 text-danger-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="card p-6 text-center text-slate-600">Loading...</div>
        ) : filteredLinks.length === 0 ? (
          <div className="card p-6 text-center text-slate-600">No links found</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-base w-full text-sm">
              <thead>
                <tr>
                  <th>Short Code</th>
                  <th className="text-right">Clicks</th>
                  <th className="text-right">Conversions</th>
                  <th className="text-right">Conv. Rate</th>
                  <th className="text-right">Deferred Match</th>
                  <th className="text-right">Match Rate</th>
                  <th className="text-right">Created</th>
                  <th className="text-right">Last Clicked</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.map(link => (
                  <tr key={link.linkId}>
                    <td className="font-mono font-semibold text-primary-600">
                      {link.shortCode}
                    </td>
                    <td className="text-right font-medium">
                      {link.totalClicks.toLocaleString()}
                    </td>
                    <td className="text-right font-medium">
                      {link.conversions.total.toLocaleString()}
                    </td>
                    <td className="text-right">
                      {conversionRate(link.totalClicks, link.conversions.total)}%
                    </td>
                    <td className="text-right">
                      {link.deferredMatches.toLocaleString()}
                    </td>
                    <td className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        {link.deferredMatchRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right text-slate-500">
                      {new Date(link.createdAt).toLocaleDateString()}
                    </td>
                    <td className="text-right text-slate-500">
                      {new Date(link.lastClicked).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinksAnalyticsPage;
