'use client';

import { useState, useEffect, useCallback } from 'react';
import { smartLinkApi } from '@/lib/api';
import { DashboardOverview } from '@/types';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useDashboard } from '@/lib/context/DashboardContext';

// ─── Channel colors ─────────────────────────────────────────────
const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: 'var(--color-primary)',
  email: 'var(--color-accent)',
  qr: 'var(--color-secondary)',
  instagram: 'var(--color-warning)',
  sms: 'var(--color-primary)',
  push: 'var(--color-accent)',
  web: 'var(--color-secondary)',
  direct: 'var(--color-text-secondary)',
  facebook: 'var(--color-secondary)',
  twitter: 'var(--color-text-secondary)',
  tiktok: 'var(--color-text-tertiary)',
  youtube: 'var(--color-warning)',
  other: 'var(--color-text-tertiary)',
};

const CAMPAIGN_COLORS = [
  'var(--color-primary)',
  'var(--color-accent)',
  'var(--color-secondary)',
  'var(--color-warning)',
  'var(--color-primary)',
  'var(--color-accent)',
];

// ─── Utility ─────────────────────────────────────────────────────
function formatNum(n: number): { value: string; unit: string } {
  if (n >= 1_000_000) return { value: (n / 1_000_000).toFixed(2), unit: 'M' };
  if (n >= 1_000) return { value: (n / 1_000).toFixed(1), unit: 'K' };
  return { value: String(n), unit: '' };
}

function actionLabel(action: string): { text: string; warn: boolean } {
  switch (action) {
    case 'app_opened': return { text: 'install', warn: false };
    case 'store_redirect': return { text: 'click', warn: false };
    case 'web_fallback': return { text: 'click', warn: false };
    default: return { text: action, warn: false };
  }
}

function generateSparkPath(data: number[], w = 200, h = 36): { line: string; area: string } {
  if (data.length === 0) return { line: '', area: '' };
  const max = Math.max(...data, 1);
  const step = w / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => ({
    x: i * step,
    y: h - (v / max) * (h - 4) - 2,
  }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return { line, area };
}

function generateChartPaths(
  data: Array<{ clicks: number; conversions: number }>,
  viewW = 650,
  viewH = 180,
  padL = 40
): { clicksPath: string; clicksArea: string; conversionsPath: string } {
  const usableW = viewW - padL;
  if (data.length === 0) return { clicksPath: '', clicksArea: '', conversionsPath: '' };
  const maxClicks = Math.max(...data.map((d) => d.clicks), 1);
  const step = usableW / Math.max(data.length - 1, 1);

  const clickPts = data.map((d, i) => ({
    x: padL + i * step,
    y: viewH - (d.clicks / maxClicks) * (viewH - 40) - 20,
  }));
  const convPts = data.map((d, i) => ({
    x: padL + i * step,
    y: viewH - (d.conversions / maxClicks) * (viewH - 40) - 20,
  }));

  const clicksPath = clickPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const clicksArea = `${clicksPath} L ${padL + (data.length - 1) * step} ${viewH} L ${padL} ${viewH} Z`;
  const conversionsPath = convPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return { clicksPath, clicksArea, conversionsPath };
}

// ─── Main Dashboard Component ────────────────────────────────────
export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { user } = useUser();
  const { selectedAppId } = useDashboard();

  const displayName = user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'user';

  // Fetch overview data
  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const filters: { appId?: string; channel?: string } = {};
      if (selectedAppId) filters.appId = selectedAppId;
      if (selectedChannel) filters.channel = selectedChannel;
      const data = await smartLinkApi.getOverview(filters);
      setOverview(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedAppId, selectedChannel]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // ─── Skeleton ────────────────────────────────────────────────
  const Skeleton = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
    <div
      className={`animate-pulse ${className}`}
      style={{ background: 'var(--color-bg-hover)', borderRadius: 2, ...style }}
    />
  );

  // ─── Error State ─────────────────────────────────────────────
  if (error && !overview) {
    return (
      <div style={{ padding: 32 }}>
        <div
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            padding: 48,
            textAlign: 'center',
          }}
        >
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
            // error loading dashboard
          </p>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>{error}</p>
          <Link href="/dashboard/setup">
            <button
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-bg)',
                border: 'none',
                padding: '11px 20px',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                cursor: 'pointer',
              }}
            >
              Setup Dashboard
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const clicksFmt = formatNum(overview?.totalClicks || 0);
  const convFmt = formatNum(overview?.totalConversions || 0);
  const convRate = overview?.conversionRate?.toFixed(2) || '0.00';
  const linksFmt = formatNum(overview?.totalLinks || 0);
  const secAgo = Math.round((Date.now() - lastUpdated.getTime()) / 1000);

  // Sparkline data from trend
  const trendClicks = overview?.clicksTrend?.map((t) => t.clicks) || [];
  const trendConv = overview?.clicksTrend?.map((t) => t.conversions) || [];
  const clicksSpark = generateSparkPath(trendClicks);
  const convSpark = generateSparkPath(trendConv);

  // Chart paths
  const chartData = overview?.clicksTrend || [];
  const { clicksPath, clicksArea, conversionsPath } = generateChartPaths(chartData);

  // Date labels for chart
  const chartDates = chartData.length > 0
    ? [chartData[0]?.date, chartData[Math.floor(chartData.length / 3)]?.date, chartData[Math.floor((chartData.length * 2) / 3)]?.date, chartData[chartData.length - 1]?.date]
      .filter(Boolean)
      .map((d) => new Date(d!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    : [];

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>

      {/* ─── Page Head ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 30,
          marginBottom: 36,
          paddingBottom: 24,
          borderBottom: '1px solid var(--color-border)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          {/* Meta Row */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 24,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'var(--color-text-tertiary)',
              marginBottom: 16,
            }}
          >
            <span>
              <span
                style={{
                  width: 6,
                  height: 6,
                  background: 'var(--color-primary)',
                  boxShadow: '0 0 8px rgba(201, 255, 61, 0.4)',
                  display: 'inline-block',
                  marginRight: 8,
                  verticalAlign: 'middle',
                  borderRadius: '50%',
                  animation: 'pulse 1.4s ease-in-out infinite',
                }}
              />
              OPERATIONAL
            </span>
            <span>WINDOW / LAST 30 DAYS</span>
            <span>UPDATED / {secAgo < 60 ? `${secAgo}s ago` : `${Math.floor(secAgo / 60)}m ago`}</span>
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: 'clamp(32px, 4.5vw, 56px)',
              lineHeight: 0.9,
              letterSpacing: '-0.035em',
              textTransform: 'uppercase',
              color: 'var(--color-text)',
            }}
          >
            good morning, <em style={{ fontStyle: 'normal', color: 'var(--color-primary)' }}>{displayName}.</em>
          </h1>
          <p style={{ marginTop: 14, fontSize: 15, color: 'var(--color-text-secondary)', maxWidth: '60ch' }}>
            {overview?.activeCampaigns || 0} campaigns running. {overview?.totalLinks || 0} active links.
            {overview?.deferredLinksMatched ? (
              <strong style={{ color: 'var(--color-text)' }}> {overview.deferredLinksMatched} deferred matches.</strong>
            ) : null}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/dashboard/campaigns">
            <button className="btn-dashboard">+ New campaign</button>
          </Link>
          <Link href="/dashboard/links">
            <button className="btn-dashboard btn-dashboard-primary">→ New link</button>
          </Link>
        </div>
      </div>

      {/* ─── Filter Bar ────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          marginBottom: 24,
          padding: '14px 16px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)',
        }}
      >
        {/* Channel Filter */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: 'var(--color-text-tertiary)',
            marginRight: 4,
          }}
        >
          Channel
        </span>
        <div style={{ display: 'inline-flex', border: '1px solid var(--color-border-hover)' }}>
          {['', 'whatsapp', 'email', 'qr', 'instagram', 'sms', 'push', 'web'].map((ch) => (
            <button
              key={ch}
              onClick={() => setSelectedChannel(ch)}
              style={{
                padding: '7px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: selectedChannel === ch ? 'var(--color-bg)' : 'var(--color-text-tertiary)',
                background: selectedChannel === ch ? 'var(--color-primary)' : 'transparent',
                fontWeight: selectedChannel === ch ? 700 : 400,
                border: 'none',
                borderRight: '1px solid var(--color-border-hover)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {ch || 'all'}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={fetchOverview}
          style={{
            marginLeft: 'auto',
            padding: '7px 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-text-secondary)',
            background: 'transparent',
            border: '1px solid var(--color-border-hover)',
            cursor: 'pointer',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ─── KPI Strip ─────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)',
          marginBottom: 24,
        }}
      >
        {/* Total Clicks */}
        <StatCell
          label="Total clicks"
          id="#01"
          value={clicksFmt.value}
          unit={clicksFmt.unit}
          loading={loading}
          sparkPath={clicksSpark}
        />
        {/* Total Conversions */}
        <StatCell
          label="Conversions"
          id="#02"
          value={convFmt.value}
          unit={convFmt.unit}
          loading={loading}
          sparkPath={convSpark}
        />
        {/* CVR */}
        <StatCell
          label="CVR"
          id="#03"
          value={convRate}
          unit="%"
          loading={loading}
        />
        {/* Active Links */}
        <StatCell
          label="Active links"
          id="#04"
          value={linksFmt.value}
          unit={linksFmt.unit}
          loading={loading}
          isLast
        />
      </div>

      {/* ─── Live Stream + Chart Row ──────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: 24,
          marginBottom: 24,
        }}
      >
        {/* Live Terminal */}
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>01</span>
              // live route stream
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '3px 8px',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ width: 6, height: 6, background: 'var(--color-primary)', boxShadow: '0 0 6px rgba(201, 255, 61, 0.4)', display: 'inline-block' }} />
              streaming
            </span>
          </div>
          <div style={{ padding: 16, minHeight: 320, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} style={{ height: 20, marginBottom: 6, width: `${70 + Math.random() * 30}%` }} />
              ))
            ) : (overview?.recentClicks || []).length === 0 ? (
              <div style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', paddingTop: 80 }}>
                No recent activity
              </div>
            ) : (
              <>
                {(overview?.recentClicks || []).slice(0, 12).map((click, i) => {
                  const action = actionLabel(click.action);
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, lineHeight: 1.55, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--color-primary)' }}>▸</span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{click.time}</span>
                      <span style={{ color: 'var(--color-secondary)' }}>{click.platform}</span>
                      <span style={{ color: 'var(--color-primary)' }}>"{click.campaign}"</span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 7px',
                          border: `1px solid ${action.warn ? 'var(--color-warning)' : 'var(--color-primary)'}`,
                          color: action.warn ? 'var(--color-warning)' : 'var(--color-primary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}
                      >
                        {action.text}
                      </span>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: 8, marginBottom: 6, lineHeight: 1.55 }}>
                  <span style={{ color: 'var(--color-primary)' }}>▸</span>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 13,
                      background: 'var(--color-primary)',
                      marginLeft: 2,
                      animation: 'blink 1.1s steps(2) infinite',
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Routes & Conversions Chart */}
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>02</span>
              // clicks & conversions · 30d
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span>
                <span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--color-primary)', marginRight: 6, verticalAlign: 'middle' }} />
                clicks
              </span>
              <span>
                <span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--color-accent)', marginRight: 6, verticalAlign: 'middle' }} />
                conversions
              </span>
            </span>
          </div>
          <div style={{ padding: 20 }}>
            {loading ? (
              <Skeleton style={{ height: 260, width: '100%' }} />
            ) : chartData.length === 0 ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}>
                No trend data yet
              </div>
            ) : (
              <svg viewBox="0 0 700 260" preserveAspectRatio="none" style={{ width: '100%', height: 300 }}>
                {/* Gridlines */}
                <g stroke="var(--color-border)" strokeWidth="1">
                  <line x1="40" y1="40" x2="690" y2="40" />
                  <line x1="40" y1="100" x2="690" y2="100" />
                  <line x1="40" y1="160" x2="690" y2="160" />
                  <line x1="40" y1="220" x2="690" y2="220" />
                </g>
                {/* Clicks area + line */}
                <path d={clicksArea} fill="rgba(201, 255, 61, 0.12)" />
                <path d={clicksPath} fill="none" stroke="var(--color-primary)" strokeWidth="1.6" />
                {/* Conversions line */}
                <path d={conversionsPath} fill="none" stroke="var(--color-accent)" strokeWidth="1.6" />
                {/* End markers */}
                {chartData.length > 0 && (
                  <>
                    <circle cx={40 + ((chartData.length - 1) / Math.max(chartData.length - 1, 1)) * 650} cy={260 - 20 - ((chartData[chartData.length - 1]?.clicks || 0) / Math.max(...chartData.map((d) => d.clicks), 1)) * 200} r="4" fill="var(--color-primary)" />
                  </>
                )}
                {/* X labels */}
                <g fontFamily="var(--font-mono)" fontSize="9" fill="var(--color-text-tertiary)">
                  {chartDates.map((d, i) => (
                    <text key={i} x={40 + (i / Math.max(chartDates.length - 1, 1)) * 650} y="250">{d}</text>
                  ))}
                </g>
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* ─── Campaigns Table ──────────────────────────────── */}
      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
            <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>03</span>
            // active campaigns
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link href="/dashboard/campaigns">
              <button className="btn-dashboard btn-dashboard-sm btn-dashboard-primary">+ new</button>
            </Link>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} style={{ height: 44, marginBottom: 4, width: '100%' }} />
              ))}
            </div>
          ) : (overview?.topCampaigns || []).length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              <p style={{ marginBottom: 16 }}>No campaigns yet</p>
              <Link href="/dashboard/campaigns">
                <button className="btn-dashboard btn-dashboard-primary">Create Campaign</button>
              </Link>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <thead>
                <tr>
                  {['name', 'status', 'channels', 'links', 'clicks', 'conversions', 'cvr', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === 'clicks' || h === 'conversions' || h === 'cvr' ? 'right' : 'left',
                        padding: '12px 16px',
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.16em',
                        color: 'var(--color-text-tertiary)',
                        fontWeight: 500,
                        borderBottom: '1px solid var(--color-border)',
                        background: 'var(--color-bg-secondary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(overview?.topCampaigns || []).map((campaign, idx) => (
                  <tr
                    key={campaign.id}
                    style={{ transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500 }}>
                        <span style={{ display: 'inline-block', width: 6, height: 18, background: CAMPAIGN_COLORS[idx % CAMPAIGN_COLORS.length] }} />
                        {campaign.name}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
                      <StatusPill status={campaign.status} />
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                      {campaign.channels || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                      {campaign.linkCount}
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: 'var(--color-primary)' }}>
                      {campaign.clicks.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: 'var(--color-text)' }}>
                      {campaign.conversions.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: 'var(--color-text)' }}>
                      {campaign.conversionRate.toFixed(2)}%
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
                      <Link href={`/dashboard/campaigns`}>
                        <button style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 8px', color: 'var(--color-text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}>⋯</button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── Links + Channels Split ──────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 24,
          marginBottom: 24,
        }}
      >
        {/* Top Links */}
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>04</span>
              // top performing links
            </span>
            <Link href="/dashboard/links">
              <button className="btn-dashboard btn-dashboard-sm btn-dashboard-primary">+ new link</button>
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: 20 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} style={{ height: 40, marginBottom: 4, width: '100%' }} />
                ))}
              </div>
            ) : (overview?.topLinks || []).length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                <p style={{ marginBottom: 16 }}>No links created yet</p>
                <Link href="/dashboard/links">
                  <button className="btn-dashboard btn-dashboard-primary">Create First Link</button>
                </Link>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['slug', 'destination', 'campaign', 'clicks', 'cvr', ''].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === 'clicks' || h === 'cvr' ? 'right' : 'left',
                          padding: '12px 16px',
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '0.16em',
                          color: 'var(--color-text-tertiary)',
                          fontWeight: 500,
                          borderBottom: '1px solid var(--color-border)',
                          background: 'var(--color-bg-secondary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(overview?.topLinks || []).map((link, idx) => {
                    const cvr = link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(2) : '0.00';
                    return (
                      <tr
                        key={idx}
                        style={{ transition: 'background 0.15s' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>{link.shortCode}</span>
                        </td>
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-secondary)', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {link.destinationUrl ? new URL(link.destinationUrl, 'https://x.com').pathname : '—'}
                        </td>
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                          {link.campaignName || '—'}
                        </td>
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: 'var(--color-primary)' }}>
                          {link.clicks.toLocaleString()}
                        </td>
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: 'var(--color-text)' }}>
                          {cvr}%
                        </td>
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(link.shortCode);
                            }}
                            className="btn-dashboard btn-dashboard-sm"
                          >
                            copy
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Channel Breakdown */}
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>05</span>
              // by channel
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>30d</span>
          </div>
          <div style={{ padding: 20 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} style={{ height: 28, width: '100%' }} />
                ))}
              </div>
            ) : (overview?.channelBreakdown || []).length === 0 ? (
              <div style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '60px 0' }}>
                No channel data yet
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {(overview?.channelBreakdown || []).map((ch, idx) => {
                    const color = CHANNEL_COLORS[ch.channel] || 'var(--color-text-tertiary)';
                    return (
                      <div key={ch.channel}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 6 }}>
                          <span style={{ color: 'var(--color-text)' }}>{ch.channel}</span>
                          <span style={{ color: idx === 0 ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>{ch.percentage}%</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--color-bg-hover)', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${ch.percentage}%`, background: color, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {(overview?.channelBreakdown || []).length > 0 && (
                  <div
                    style={{
                      marginTop: 24,
                      paddingTop: 18,
                      borderTop: '1px dashed var(--color-border-hover)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    <span>top channel</span>
                    <span style={{ color: 'var(--color-primary)' }}>{overview?.channelBreakdown[0]?.channel}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Inline Styles (CSS-in-JS for animations) ──── */}
      <style jsx global>{`
        @keyframes blink {
          50% { opacity: 0.3; }
        }
        @keyframes pulse {
          50% { opacity: 0.3; }
        }
        .btn-dashboard {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 11px 20px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border: 1px solid var(--color-border-hover);
          transition: all 0.2s ease;
          white-space: nowrap;
          background: transparent;
          color: var(--color-text);
          cursor: pointer;
        }
        .btn-dashboard:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
        .btn-dashboard-primary {
          background: var(--color-primary);
          color: var(--color-bg);
          border-color: var(--color-primary);
          font-weight: 700;
        }
        .btn-dashboard-primary:hover {
          box-shadow: 4px 4px 0 0 var(--color-accent);
          transform: translate(-2px, -2px);
          color: var(--color-bg);
        }
        .btn-dashboard-sm {
          padding: 7px 12px;
          font-size: 11px;
        }
        @media (max-width: 1100px) {
          div[style*="gridTemplateColumns: '2fr 1fr'"],
          div[style*="gridTemplateColumns: '1fr 2fr'"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Sub Components ──────────────────────────────────────────────

function StatCell({
  label,
  id,
  value,
  unit,
  loading,
  sparkPath,
  isLast,
}: {
  label: string;
  id: string;
  value: string;
  unit: string;
  loading: boolean;
  sparkPath?: { line: string; area: string };
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        padding: '22px 24px',
        borderRight: isLast ? 'none' : '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: 'var(--color-text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {label}
        <span style={{ color: 'var(--color-bg-hover)' }}>{id}</span>
      </div>
      {loading ? (
        <div className="animate-pulse" style={{ height: 48, background: 'var(--color-bg-hover)', borderRadius: 2 }} />
      ) : (
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: 'clamp(28px, 3vw, 42px)',
            lineHeight: 1,
            letterSpacing: '-0.035em',
          }}
        >
          <em style={{ fontStyle: 'normal', color: 'var(--color-primary)' }}>{value}</em>
          <span style={{ fontSize: '0.45em', color: 'var(--color-text-tertiary)', marginLeft: 4, fontWeight: 500 }}>{unit}</span>
        </div>
      )}
      {sparkPath && sparkPath.line && !loading && (
        <svg viewBox="0 0 200 36" preserveAspectRatio="none" style={{ width: '100%', height: 36, marginTop: 4 }}>
          <path d={sparkPath.area} fill="rgba(201, 255, 61, 0.15)" />
          <path d={sparkPath.line} fill="none" stroke="var(--color-primary)" strokeWidth="1.4" />
        </svg>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { border: string; color: string; dot: string }> = {
    active: { border: 'var(--color-primary)', color: 'var(--color-primary)', dot: 'var(--color-primary)' },
    live: { border: 'var(--color-primary)', color: 'var(--color-primary)', dot: 'var(--color-primary)' },
    paused: { border: 'var(--color-accent)', color: 'var(--color-accent)', dot: 'var(--color-accent)' },
    draft: { border: 'var(--color-warning)', color: 'var(--color-warning)', dot: 'var(--color-warning)' },
    archived: { border: 'var(--color-text-tertiary)', color: 'var(--color-text-tertiary)', dot: 'var(--color-text-tertiary)' },
  };
  const c = colors[status] || colors.archived;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        padding: '3px 8px',
        border: `1px solid ${c.border}`,
        color: c.color,
        background: 'var(--color-bg)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, background: c.dot }} />
      {status}
    </span>
  );
}
