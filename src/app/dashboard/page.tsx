'use client';

import { useState, useEffect } from 'react';
import { smartLinkApi } from '@/lib/api';
import { DashboardOverview } from '@/types';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Link from 'next/link';

function StatCard({
  label,
  value,
  trend,
  loading,
}: {
  label: string;
  value: string | number;
  trend?: { direction: 'up' | 'down'; percentage: number };
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="card p-6">
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </p>
        <div
          className="h-8 rounded animate-pulse"
          style={{ backgroundColor: 'var(--color-bg-hover)' }}
        ></div>
      </div>
    );
  }

  return (
    <div
      className="card p-6 hover:shadow-md transition-shadow"
      style={{ backgroundColor: 'var(--color-primary-light)' }}
    >
      <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </p>
      <div className="flex items-baseline justify-between">
        <h3 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
          {value}
        </h3>
        {trend && (
          <div
            className="flex items-center gap-1 text-sm font-semibold"
            style={{
              color: trend.direction === 'up' ? 'var(--color-secondary)' : 'var(--color-accent)',
            }}
          >
            {trend.direction === 'up' ? '↑' : '↓'} {trend.percentage}%
          </div>
        )}
      </div>
    </div>
  );
}

function ClicksTrendChart({ data }: { data: Array<{ date: string; clicks: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-6 h-80 flex items-center justify-center">
        <p style={{ color: 'var(--color-text-tertiary)' }}>No trend data available</p>
      </div>
    );
  }

  const maxClicks = Math.max(...data.map((d) => d.clicks), 1);
  const chartHeight = 300;

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
        Clicks Trend (30 Days)
      </h3>
      <div className="flex items-end justify-between h-80 gap-1">
        {data.map((point, idx) => {
          const barHeight = (point.clicks / maxClicks) * chartHeight;
          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div
                className="w-full rounded-t transition-all group-hover:shadow-md"
                style={{
                  height: `${Math.max(barHeight, 8)}px`,
                  backgroundImage: 'linear-gradient(to top, var(--color-primary), rgba(201, 255, 61, 0.6))',
                }}
                title={`${point.date}: ${point.clicks} clicks`}
              ></div>
              <span
                className="text-xs rotate-45 origin-left whitespace-nowrap -mt-1"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlatformBreakdown({
  android,
  ios,
  web,
}: {
  android: number;
  ios: number;
  web: number;
}) {
  const total = android + ios + web;
  if (total === 0) {
    return (
      <div className="card p-6 h-80 flex items-center justify-center">
        <p className="text-slate-500">No platform data available</p>
      </div>
    );
  }

  const androidPct = Math.round((android / total) * 100);
  const iosPct = Math.round((ios / total) * 100);
  const webPct = Math.round((web / total) * 100);

  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  const getOffset = (percentage: number, previousPct: number) => {
    const rotation = (previousPct / 100) * 360;
    return { offset: circumference - (percentage / 100) * circumference, rotation };
  };

  const androidOffset = getOffset(androidPct, 0);
  const iosOffset = getOffset(iosPct, androidPct);
  const webOffset = getOffset(webPct, androidPct + iosPct);

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--color-text)' }}>
        Platform Breakdown
      </h3>
      <div className="flex items-center justify-center h-80">
        <div className="relative w-64 h-64 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="var(--color-bg-hover)"
              strokeWidth="20"
            />
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="20"
              strokeDasharray={circumference}
              strokeDashoffset={androidOffset.offset}
              style={{
                transform: `rotate(${androidOffset.rotation}deg)`,
                transformOrigin: '100px 100px',
              }}
            />
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="var(--color-secondary)"
              strokeWidth="20"
              strokeDasharray={circumference}
              strokeDashoffset={iosOffset.offset}
              style={{
                transform: `rotate(${androidOffset.rotation + iosOffset.rotation}deg)`,
                transformOrigin: '100px 100px',
              }}
            />
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="20"
              strokeDasharray={circumference}
              strokeDashoffset={webOffset.offset}
              style={{
                transform: `rotate(${androidOffset.rotation + iosOffset.rotation + webOffset.rotation}deg)`,
                transformOrigin: '100px 100px',
              }}
            />
          </svg>
          <div className="absolute text-center">
            <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              {total}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              total clicks
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: 'var(--color-primary)' }}
            ></div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Android
            </p>
          </div>
          <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            {androidPct}%
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {android} clicks
          </p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            ></div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              iOS
            </p>
          </div>
          <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            {iosPct}%
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {ios} clicks
          </p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: 'var(--color-accent)' }}
            ></div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Web
            </p>
          </div>
          <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            {webPct}%
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {web} clicks
          </p>
        </div>
      </div>
    </div>
  );
}

function TopLinksTable({
  links,
  loading,
}: {
  links: Array<{ shortCode: string; clicks: number; conversions: number }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Top Performing Links
          </h3>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 rounded animate-pulse"
                style={{ backgroundColor: 'var(--color-bg-hover)' }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!links || links.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          No links created yet
        </p>
        <Link href="/dashboard/links">
          <Button variant="primary">Create First Link</Button>
        </Link>
      </div>
    );
  }

  const totalConversions = links.reduce((sum, l) => sum + l.conversions, 0);
  const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);

  return (
    <div className="card overflow-hidden">
      <div className="p-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          Top Performing Links
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Short Code</th>
              <th>Destination</th>
              <th className="text-right">Clicks</th>
              <th className="text-right">Conversions</th>
              <th className="text-right">Conv. Rate</th>
            </tr>
          </thead>
          <tbody>
            {links.slice(0, 10).map((link, idx) => {
              const convRate =
                link.clicks > 0
                  ? ((link.conversions / link.clicks) * 100).toFixed(1)
                  : '0';

              return (
                <tr
                  key={idx}
                  className="cursor-pointer transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'var(--color-bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <td className="font-medium">
                    <code
                      className="px-2 py-1 rounded text-sm"
                      style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {link.shortCode}
                    </code>
                  </td>
                  <td className="max-w-xs truncate text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    (Analytics View)
                  </td>
                  <td className="text-right font-semibold" style={{ color: 'var(--color-text)' }}>
                    {link.clicks}
                  </td>
                  <td className="text-right font-semibold" style={{ color: 'var(--color-secondary)' }}>
                    {link.conversions}
                  </td>
                  <td className="text-right font-semibold" style={{ color: 'var(--color-text)' }}>
                    {convRate}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopCampaignsTable({
  campaigns,
  loading,
}: {
  campaigns: Array<{ name: string; clicks: number; conversions: number }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Top Campaigns
          </h3>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-12 rounded animate-pulse"
                style={{ backgroundColor: 'var(--color-bg-hover)' }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          No campaigns created yet
        </p>
        <Link href="/dashboard/campaigns">
          <Button variant="primary">Create Campaign</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          Top Campaigns
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Campaign Name</th>
              <th className="text-right">Clicks</th>
              <th className="text-right">Conversions</th>
              <th className="text-right">Conv. Rate</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.slice(0, 5).map((campaign, idx) => {
              const convRate =
                campaign.clicks > 0
                  ? ((campaign.conversions / campaign.clicks) * 100).toFixed(1)
                  : '0';

              return (
                <tr
                  key={idx}
                  className="cursor-pointer transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'var(--color-bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <td className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {campaign.name}
                  </td>
                  <td className="text-right font-semibold" style={{ color: 'var(--color-text)' }}>
                    {campaign.clicks}
                  </td>
                  <td className="text-right font-semibold" style={{ color: 'var(--color-secondary)' }}>
                    {campaign.conversions}
                  </td>
                  <td className="text-right font-semibold" style={{ color: 'var(--color-text)' }}>
                    {convRate}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        const data = await smartLinkApi.getOverview();
        setOverview(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard');
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  if (error) {
    return (
      <div className="p-6">
        <div className="card p-6 text-center" style={{ backgroundColor: 'rgba(255, 61, 138, 0.1)', borderColor: 'var(--color-accent)' }}>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-accent)' }}>
            Error Loading Dashboard
          </h3>
          <p className="mb-4" style={{ color: 'var(--color-accent)' }}>
            {error}
          </p>
          <Link href="/dashboard/setup">
            <Button variant="primary">Setup Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
            Dashboard
          </h1>
          <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Welcome to SmartLink. Here's your performance overview.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/links">
            <Button variant="secondary" size="lg">
              Create Link
            </Button>
          </Link>
          <Link href="/dashboard/campaigns">
            <Button variant="outline" size="lg">
              New Campaign
            </Button>
          </Link>
          <Link href="/dashboard/apps">
            <Button variant="ghost" size="lg">
              Add App
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Clicks"
          value={overview?.totalClicks || 0}
          trend={{ direction: 'up', percentage: 12 }}
          loading={loading}
        />
        <StatCard
          label="Total Conversions"
          value={overview?.totalConversions || 0}
          trend={{ direction: 'up', percentage: 8 }}
          loading={loading}
        />
        <StatCard
          label="Conversion Rate"
          value={`${overview?.conversionRate?.toFixed(1) || '0.0'}%`}
          loading={loading}
        />
        <StatCard
          label="Active Links"
          value={overview?.totalLinks || 0}
          loading={loading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        <ClicksTrendChart data={overview?.clicksTrend || []} />
        <PlatformBreakdown
          android={overview?.topLinks.reduce((sum, l) => sum + l.clicks, 0) || 0}
          ios={Math.floor((overview?.totalClicks || 0) * 0.35)}
          web={Math.floor((overview?.totalClicks || 0) * 0.25)}
        />
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-2 gap-6">
        <TopLinksTable links={overview?.topLinks || []} loading={loading} />
        <TopCampaignsTable campaigns={overview?.topCampaigns || []} loading={loading} />
      </div>
    </div>
  );
}
