'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  smartLinkApi,
  EventNameStat,
  EventCampaignStat,
  EventTimeseriesPoint,
  EventFunnelStage,
  EventIngestHealth,
} from '@/lib/api';
import { LineChart } from '@/components/charts/AnalyticsCharts';

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
      {'// '}
      {children}
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

function formatMoney(n: number) {
  if (!n) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const th: React.CSSProperties = {
  ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
  color: 'var(--color-text-tertiary)', padding: '8px 12px', fontWeight: 600,
};

const td: React.CSSProperties = { ...mono, fontSize: 12, padding: '10px 12px', color: 'var(--color-text)' };

export default function EventsDashboard() {
  const [dateRange, setDateRange] = useState<DateRangeType>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [events, setEvents] = useState<EventNameStat[]>([]);
  const [campaigns, setCampaigns] = useState<EventCampaignStat[]>([]);
  const [series, setSeries] = useState<EventTimeseriesPoint[]>([]);
  const [funnel, setFunnel] = useState<EventFunnelStage[]>([]);
  const [health, setHealth] = useState<EventIngestHealth | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const days = DATE_RANGES.find((r) => r.value === dateRange)!.days;
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - days);

      const filters = { from: from.toISOString(), to: to.toISOString() };

      // Five independent views — fetched together so the page paints once
      // rather than shifting five times.
      const [b, c, t, f, h] = await Promise.all([
        smartLinkApi.getEventAnalytics<{ events: EventNameStat[] }>('breakdown', filters),
        smartLinkApi.getEventAnalytics<{ campaigns: EventCampaignStat[] }>('campaigns', filters),
        smartLinkApi.getEventAnalytics<{ points: EventTimeseriesPoint[] }>('timeseries', filters),
        smartLinkApi.getEventAnalytics<{ funnel: EventFunnelStage[] }>('funnel', filters),
        smartLinkApi.getEventAnalytics<{ health: EventIngestHealth }>('health', filters),
      ]);

      setEvents(b.events || []);
      setCampaigns(c.campaigns || []);
      setSeries(t.points || []);
      setFunnel(f.funnel || []);
      setHealth(h.health || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalEvents = events.reduce((sum, e) => sum + e.count, 0);
  const totalRevenue = events.reduce((sum, e) => sum + e.totalValue, 0);
  const conversions = events.filter((e) => e.isConversion).reduce((s, e) => s + e.count, 0);
  const uniqueUsers = Math.max(0, ...events.map((e) => e.uniqueUsers));

  const hasData = !loading && totalEvents > 0;
  const isEmpty = !loading && !error && totalEvents === 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ ...mono, fontSize: 24, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>events</h1>
            <p style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              what people do after they install — attributed to the link that brought them
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Link
              href="/dashboard/events/definitions"
              style={{ ...mono, fontSize: 11, padding: '8px 16px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', textDecoration: 'none' }}
            >
              ⚙ definitions
            </Link>
            <Link
              href="/dashboard/users"
              style={{ ...mono, fontSize: 11, padding: '8px 16px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', textDecoration: 'none' }}
            >
              → users
            </Link>
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
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid var(--color-warning)', padding: '12px 16px', marginBottom: 24, ...mono, fontSize: 12, color: 'var(--color-warning)' }}>
            {error}
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 24, height: 96, animation: 'pulse 1.5s infinite' }} />
            ))
          ) : (
            <>
              <Card>
                <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>total events</div>
                <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>{formatNum(totalEvents)}</div>
              </Card>
              <Card>
                <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>conversions</div>
                <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: 'var(--color-accent)' }}>{formatNum(conversions)}</div>
              </Card>
              <Card>
                <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>identified users</div>
                <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>{formatNum(uniqueUsers)}</div>
              </Card>
              <Card>
                <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>revenue tracked</div>
                <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: 'var(--color-primary)' }}>{formatMoney(totalRevenue)}</div>
              </Card>
            </>
          )}
        </div>

        {/* Empty state — an integration guide, not a shrug */}
        {isEmpty && (
          <Card style={{ marginBottom: 24 }}>
            <SectionLabel>no events yet</SectionLabel>
            <p style={{ ...mono, fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
              Nothing has been tracked in this window. Add one call to your app and this page fills in:
            </p>
            <pre style={{
              ...mono, fontSize: 12, lineHeight: 1.7, background: 'var(--color-bg)',
              border: '1px solid var(--color-border)', padding: 16, overflowX: 'auto',
              color: 'var(--color-text-secondary)',
            }}>
{`await smartLink.track(
  'ticket_purchase',
  value: 1250, currency: 'INR',
  properties: {'event_id': 'evt_991', 'qty': 2},
);

// on sign-in — links this device to a person, and
// backfills what they did before signing in
await smartLink.identify('u_88213', traits: {'plan': 'pro'});`}
            </pre>
            <p style={{ ...mono, fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 12 }}>
              Full guide in <Link href="/dashboard/docs" style={{ color: 'var(--color-primary)' }}>docs</Link>.
            </p>
          </Card>
        )}

        {hasData && (
          <>
            {/* Funnel */}
            <Card style={{ marginBottom: 24 }}>
              <SectionLabel>funnel — click to conversion</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${funnel.length}, 1fr)`, gap: 8 }}>
                {funnel.map((stage, i) => {
                  const max = funnel[0]?.count || 1;
                  const width = max > 0 ? Math.max(4, (stage.count / max) * 100) : 0;
                  return (
                    <div key={stage.stage}>
                      <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
                        {stage.label}
                      </div>
                      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
                        {formatNum(stage.count)}
                      </div>
                      <div style={{ height: 6, background: 'var(--color-border)', position: 'relative', marginBottom: 6 }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${width}%`, background: i === funnel.length - 1 ? 'var(--color-accent)' : 'var(--color-primary)' }} />
                      </div>
                      <div style={{ ...mono, fontSize: 11, color: stage.conversionRate === null ? 'var(--color-text-tertiary)' : 'var(--color-accent)' }}>
                        {stage.conversionRate === null ? '—' : `${stage.conversionRate}% of previous`}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p style={{ ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 16, lineHeight: 1.6 }}>
                Each stage is counted from its own source, not derived from the one above — a stage can exceed
                its predecessor when the date window clips a journey that started earlier.
              </p>
            </Card>

            {/* Volume trend */}
            <Card style={{ marginBottom: 24 }}>
              <SectionLabel>event volume</SectionLabel>
              <LineChart
                data={series.map((p) => ({
                  label: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  value: p.count,
                }))}
                primaryColor="var(--color-primary)"
                height={240}
              />
            </Card>

            {/* Campaign attribution — the headline question */}
            <Card style={{ marginBottom: 24 }}>
              <SectionLabel>by campaign — who came from where, and what they did</SectionLabel>
              {campaigns.length === 0 ? (
                <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '32px 0' }}>no campaign data</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ ...th, textAlign: 'left' }}>campaign</th>
                        <th style={{ ...th, textAlign: 'right' }}>events</th>
                        <th style={{ ...th, textAlign: 'right' }}>conversions</th>
                        <th style={{ ...th, textAlign: 'right' }}>users</th>
                        <th style={{ ...th, textAlign: 'right' }}>devices</th>
                        <th style={{ ...th, textAlign: 'right' }}>revenue</th>
                        <th style={{ ...th, textAlign: 'right' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c) => (
                        <tr key={c.campaignId || 'unattributed'} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ ...td, fontWeight: 700, color: c.campaignId ? 'var(--color-text)' : 'var(--color-text-tertiary)' }}>
                            {c.campaignName}
                          </td>
                          <td style={{ ...td, textAlign: 'right' }}>{c.events.toLocaleString()}</td>
                          <td style={{ ...td, textAlign: 'right', color: 'var(--color-accent)' }}>{c.conversions.toLocaleString()}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{c.uniqueUsers.toLocaleString()}</td>
                          <td style={{ ...td, textAlign: 'right', color: 'var(--color-text-secondary)' }}>{c.uniqueDevices.toLocaleString()}</td>
                          <td style={{ ...td, textAlign: 'right', color: 'var(--color-primary)' }}>{formatMoney(c.totalValue)}</td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            {c.campaignId && (
                              <Link href={`/dashboard/users?campaignId=${c.campaignId}`} style={{ ...mono, fontSize: 11, color: 'var(--color-primary)', textDecoration: 'none' }}>
                                users →
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Event breakdown */}
            <Card style={{ marginBottom: 24 }}>
              <SectionLabel>by event</SectionLabel>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ ...th, textAlign: 'left' }}>event</th>
                      <th style={{ ...th, textAlign: 'right' }}>count</th>
                      <th style={{ ...th, textAlign: 'right' }}>devices</th>
                      <th style={{ ...th, textAlign: 'right' }}>users</th>
                      <th style={{ ...th, textAlign: 'right' }}>revenue</th>
                      <th style={{ ...th, textAlign: 'right' }}>last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700 }}>{e.label}</span>
                            {e.isConversion && (
                              <span style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 6px', background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                                conversion
                              </span>
                            )}
                          </div>
                          <div style={{ ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{e.name}</div>
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>{e.count.toLocaleString()}</td>
                        <td style={{ ...td, textAlign: 'right', color: 'var(--color-text-secondary)' }}>{e.uniqueDevices.toLocaleString()}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{e.uniqueUsers.toLocaleString()}</td>
                        <td style={{ ...td, textAlign: 'right', color: 'var(--color-primary)' }}>{formatMoney(e.totalValue)}</td>
                        <td style={{ ...td, textAlign: 'right', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                          {new Date(e.lastOccurredAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Pipeline health */}
            {health && (
              <Card>
                <SectionLabel>pipeline health</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
                  <div>
                    <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>unattributed</div>
                    <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: health.unattributedRate > 60 ? 'var(--color-warning)' : 'var(--color-text)' }}>
                      {health.unattributedRate}%
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
                      Organic traffic is normal. A sharp rise usually means attribution broke, not that marketing stopped.
                    </div>
                  </div>
                  <div>
                    <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>identified</div>
                    <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{health.identifiedRate}%</div>
                    <div style={{ ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
                      Share of events carrying a user. Raised by calling identify() on sign-in.
                    </div>
                  </div>
                  <div>
                    <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>clock skew</div>
                    <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
                      {Math.round(health.avgClockSkewMs / 1000)}s
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
                      Average gap between device and server clocks. Peak {Math.round(health.maxClockSkewMs / 60000)}m — usually an offline queue flushing late.
                    </div>
                  </div>
                  <div>
                    <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>event names</div>
                    <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: health.nameBudgetUsed > 80 ? 'var(--color-warning)' : 'var(--color-text)' }}>
                      {health.distinctEventNames}
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
                      {health.nameBudgetUsed}% of your limit. Nearing it usually means an id is being sent as a name.
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
