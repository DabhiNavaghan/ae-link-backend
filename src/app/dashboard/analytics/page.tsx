'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { smartLinkApi } from '@/lib/api';
import { useDashboard } from '@/lib/context/DashboardContext';
import { DashboardOverview } from '@/types';
import StatCard from '@/components/charts/StatCard';
import { LineChart, DonutChart, BarChart } from '@/components/charts/AnalyticsCharts';
import { downloadCSV, getAnalyticsFilename, formatAnalyticsForExport } from '@/lib/utils/export';

type DateRangeType = '7d' | '30d' | '90d';

const DATE_RANGES: { label: string; value: DateRangeType; days: number }[] = [
  { label: '7 days', value: '7d', days: 7 },
  { label: '30 days', value: '30d', days: 30 },
  { label: '90 days', value: '90d', days: 90 },
];

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
      // {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 24, ...style }}>
      {children}
    </div>
  );
}

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function actionLabel(action: string) {
  switch (action) {
    case 'app_opened': return 'app opened';
    case 'store_redirect': return 'store redirect';
    case 'web_fallback': return 'web fallback';
    default: return action || '—';
  }
}

function platformIcon(platform: string) {
  if (platform === 'ios') return '🍎';
  if (platform === 'android') return '🤖';
  return '🖥';
}

export default function AnalyticsDashboard() {
  const { selectedAppId, isContextReady } = useDashboard();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeType>('30d');

  const fetchAnalytics = useCallback(async () => {
    if (!isContextReady) return;
    setLoading(true);
    setError(null);
    try {
      const days = DATE_RANGES.find(r => r.value === dateRange)!.days;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const result = await smartLinkApi.getOverview({
        appId: selectedAppId || undefined,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [selectedAppId, dateRange, isContextReady]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ...data.topLinks.map(l => ({
        type: 'Link', name: l.shortCode, clicks: l.clicks, conversions: l.conversions,
        conversionRate: (l.clicks > 0 ? (l.conversions / l.clicks) * 100 : 0).toFixed(2),
      })),
      ...data.topCampaigns.map(c => ({
        type: 'Campaign', name: c.name, clicks: c.clicks, conversions: c.conversions,
        conversionRate: c.conversionRate.toFixed(2),
      })),
    ];
    const days = DATE_RANGES.find(r => r.value === dateRange)!.days;
    const end = new Date();
    const start = new Date(); start.setDate(end.getDate() - days);
    downloadCSV(formatAnalyticsForExport(rows), getAnalyticsFilename('analytics', start, end));
  };

  const totalPlatform = (data?.platformBreakdown?.android || 0) + (data?.platformBreakdown?.ios || 0) + (data?.platformBreakdown?.web || 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ ...mono, fontSize: 24, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>analytics</h1>
            <p style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)' }}>deep link performance — real data only</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Date range */}
            <div style={{ display: 'flex', border: '1px solid var(--color-border)' }}>
              {DATE_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setDateRange(r.value)}
                  style={{
                    ...mono, fontSize: 11, padding: '8px 14px', border: 'none', cursor: 'pointer',
                    background: dateRange === r.value ? 'var(--color-primary)' : 'var(--color-bg-card)',
                    color: dateRange === r.value ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                    borderRight: r.value !== '90d' ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleExport}
              disabled={!data}
              style={{
                ...mono, fontSize: 11, padding: '8px 16px', cursor: 'pointer',
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)', opacity: data ? 1 : 0.4,
              }}
            >
              ↓ export csv
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid var(--color-warning)', padding: '12px 16px', marginBottom: 24, ...mono, fontSize: 12, color: 'var(--color-warning)' }}>
            {error}
          </div>
        )}

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 24, height: 96, animation: 'pulse 1.5s infinite' }} />
            ))
          ) : data ? (
            <>
              <Card>
                <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>total clicks</div>
                <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>{formatNum(data.totalClicks)}</div>
              </Card>
              <Card>
                <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>total conversions</div>
                <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>{formatNum(data.totalConversions)}</div>
              </Card>
              <Card>
                <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>conversion rate</div>
                <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: 'var(--color-primary)' }}>{(data.conversionRate || 0).toFixed(2)}%</div>
              </Card>
              <Card>
                <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>active links</div>
                <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>{formatNum(data.totalLinks)}</div>
              </Card>
              <Card>
                <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>active campaigns</div>
                <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>{data.activeCampaigns}</div>
              </Card>
              <Card>
                <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>deferred matched</div>
                <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: 'var(--color-accent)' }}>{formatNum(data.deferredLinksMatched)}</div>
              </Card>
            </>
          ) : null}
        </div>

        {data && (
          <>
            {/* Clicks & Conversions Trend */}
            <Card style={{ marginBottom: 24 }}>
              <SectionLabel>clicks &amp; conversions trend</SectionLabel>
              <LineChart
                data={data.clicksTrend.map(ct => ({
                  label: new Date(ct.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  value: ct.clicks,
                }))}
                secondaryData={data.clicksTrend.map(ct => ({
                  label: new Date(ct.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  value: ct.conversions,
                }))}
                primaryColor="var(--color-primary)"
                secondaryColor="var(--color-accent)"
                height={280}
              />
              <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 3, background: 'var(--color-primary)' }} />
                  <span style={{ ...mono, fontSize: 11, color: 'var(--color-text-tertiary)' }}>clicks</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 3, background: 'var(--color-accent)' }} />
                  <span style={{ ...mono, fontSize: 11, color: 'var(--color-text-tertiary)' }}>conversions</span>
                </div>
              </div>
            </Card>

            {/* Platform + Channel + Referrers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
              {/* Platform split */}
              <Card>
                <SectionLabel>platform split</SectionLabel>
                <DonutChart
                  data={[
                    { label: 'iOS', value: data.platformBreakdown.ios, color: 'var(--color-primary)' },
                    { label: 'Android', value: data.platformBreakdown.android, color: 'var(--color-accent)' },
                    { label: 'Web', value: data.platformBreakdown.web, color: 'var(--color-text-tertiary)' },
                  ]}
                  centerText={totalPlatform > 0 ? formatNum(totalPlatform) : undefined}
                  size={160}
                />
              </Card>

              {/* Channel breakdown */}
              <Card>
                <SectionLabel>channel breakdown</SectionLabel>
                {data.channelBreakdown.length === 0 ? (
                  <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)', paddingTop: 40, textAlign: 'center' }}>no data</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.channelBreakdown.slice(0, 6).map((c) => (
                      <div key={c.channel}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ ...mono, fontSize: 11, color: 'var(--color-text-secondary)' }}>{c.channel || 'direct'}</span>
                          <span style={{ ...mono, fontSize: 11, color: 'var(--color-text)' }}>{c.clicks.toLocaleString()}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--color-border)', position: 'relative' }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${c.percentage}%`, background: 'var(--color-primary)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Top referrers */}
              <Card>
                <SectionLabel>top referrers</SectionLabel>
                {data.topReferrers.length === 0 ? (
                  <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)', paddingTop: 40, textAlign: 'center' }}>no data</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.topReferrers.slice(0, 6).map((r) => (
                      <div key={r.referrer}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ ...mono, fontSize: 11, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                            {r.referrer}
                          </span>
                          <span style={{ ...mono, fontSize: 11, color: 'var(--color-text)' }}>{r.clicks.toLocaleString()}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--color-border)', position: 'relative' }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${r.percentage}%`, background: 'var(--color-accent)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Top Links */}
            <Card style={{ marginBottom: 24 }}>
              <SectionLabel>top performing links</SectionLabel>
              {data.topLinks.length === 0 ? (
                <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '32px 0' }}>no links yet</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {['short code', 'destination', 'campaign', 'clicks', 'conversions', 'conv. rate'].map(h => (
                          <th key={h} style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-tertiary)', padding: '8px 12px', textAlign: h === 'short code' || h === 'destination' || h === 'campaign' ? 'left' : 'right', fontWeight: 600 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.topLinks.map((l, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ ...mono, fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', padding: '10px 12px' }}>/{l.shortCode}</td>
                          <td style={{ ...mono, fontSize: 11, color: 'var(--color-text-secondary)', padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.destinationUrl || '—'}</td>
                          <td style={{ ...mono, fontSize: 11, color: 'var(--color-text-tertiary)', padding: '10px 12px' }}>{l.campaignName || '—'}</td>
                          <td style={{ ...mono, fontSize: 12, color: 'var(--color-text)', padding: '10px 12px', textAlign: 'right' }}>{l.clicks.toLocaleString()}</td>
                          <td style={{ ...mono, fontSize: 12, color: 'var(--color-text)', padding: '10px 12px', textAlign: 'right' }}>{l.conversions.toLocaleString()}</td>
                          <td style={{ ...mono, fontSize: 12, color: 'var(--color-accent)', padding: '10px 12px', textAlign: 'right' }}>
                            {(l.clicks > 0 ? (l.conversions / l.clicks) * 100 : 0).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Campaign Performance */}
            <Card style={{ marginBottom: 24 }}>
              <SectionLabel>campaign performance</SectionLabel>
              {data.topCampaigns.length === 0 ? (
                <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '32px 0' }}>no campaigns yet</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {['campaign', 'status', 'links', 'clicks', 'conversions', 'conv. rate'].map(h => (
                          <th key={h} style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-tertiary)', padding: '8px 12px', textAlign: h === 'campaign' || h === 'status' ? 'left' : 'right', fontWeight: 600 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.topCampaigns.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ ...mono, fontSize: 12, fontWeight: 700, color: 'var(--color-text)', padding: '10px 12px' }}>{c.name}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 8px',
                              background: c.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                              color: c.status === 'active' ? '#10b981' : 'var(--color-text-tertiary)',
                            }}>
                              {c.status}
                            </span>
                          </td>
                          <td style={{ ...mono, fontSize: 12, color: 'var(--color-text-secondary)', padding: '10px 12px', textAlign: 'right' }}>{c.linkCount}</td>
                          <td style={{ ...mono, fontSize: 12, color: 'var(--color-text)', padding: '10px 12px', textAlign: 'right' }}>{c.clicks.toLocaleString()}</td>
                          <td style={{ ...mono, fontSize: 12, color: 'var(--color-text)', padding: '10px 12px', textAlign: 'right' }}>{c.conversions.toLocaleString()}</td>
                          <td style={{ ...mono, fontSize: 12, color: 'var(--color-accent)', padding: '10px 12px', textAlign: 'right' }}>{c.conversionRate.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Recent Activity */}
            <Card>
              <SectionLabel>recent activity</SectionLabel>
              {data.recentClicks.length === 0 ? (
                <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '32px 0' }}>no recent activity</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {data.recentClicks.map((click, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'grid', gridTemplateColumns: '140px 80px 1fr 140px 1fr',
                        gap: 12, padding: '10px 0', alignItems: 'center',
                        borderBottom: i < data.recentClicks.length - 1 ? '1px solid var(--color-border)' : 'none',
                      }}
                    >
                      <span style={{ ...mono, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        {new Date(click.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span style={{ ...mono, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                        {platformIcon(click.platform)} {click.platform || 'web'}
                      </span>
                      <span style={{ ...mono, fontSize: 11, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {click.campaign || 'direct'}
                      </span>
                      <span style={{ ...mono, fontSize: 10, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {actionLabel(click.action)}
                      </span>
                      <span style={{
                        ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
                        background: 'var(--color-bg-secondary)', padding: '2px 6px', justifySelf: 'start',
                      }}>
                        {click.channel || 'direct'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
