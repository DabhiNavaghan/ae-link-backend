'use client';

import { smartLinkApi } from '@/lib/api';
import { useDashboard } from '@/lib/context/DashboardContext';
import { DashboardOverview } from '@/types';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const tension = 0.3;
    const dx = curr.x - prev.x;
    const cp1x = prev.x + dx * tension;
    const cp2x = curr.x - dx * tension;
    d += ` C ${cp1x} ${prev.y}, ${cp2x} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function generateSparkPath(data: number[], w = 200, h = 36): { line: string; area: string } {
  if (data.length === 0) return { line: '', area: '' };
  const max = Math.max(...data, 1);
  const step = w / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => ({
    x: i * step,
    y: h - (v / max) * (h - 4) - 2,
  }));
  const line = smoothPath(points);
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return { line, area };
}

function generateChartPaths(
  data: Array<{ clicks: number; conversions: number }>,
  viewW = 650,
  viewH = 180,
  padL = 40
): { clicksPath: string; clicksArea: string; conversionsPath: string; clickPts: Array<{ x: number; y: number }>; convPts: Array<{ x: number; y: number }> } {
  const usableW = viewW - padL;
  if (data.length === 0) return { clicksPath: '', clicksArea: '', conversionsPath: '', clickPts: [], convPts: [] };
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

  const clicksPathStr = smoothPath(clickPts);
  const clicksArea = `${clicksPathStr} L ${padL + (data.length - 1) * step} ${viewH} L ${padL} ${viewH} Z`;
  const conversionsPath = smoothPath(convPts);

  return { clicksPath: clicksPathStr, clicksArea, conversionsPath, clickPts, convPts };
}

// ─── Copy Store Link Button ──────────────────────────────────────
function CopyStoreLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="btn-dashboard btn-dashboard-sm"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      title={url}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 13, height: 13 }}>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
      {copied ? 'copied!' : 'copy store link'}
    </button>
  );
}

// ─── Main Dashboard Component ────────────────────────────────────
export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const { selectedAppId, apps, isContextReady, can } = useDashboard();
  const router = useRouter();

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenu]);

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
    if (!isContextReady) return;
    fetchOverview();
  }, [fetchOverview, isContextReady]);

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
  const { clicksPath, clicksArea, conversionsPath, clickPts, convPts } = generateChartPaths(chartData);

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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Smart store link for the selected app */}
          {(() => {
            const currentApp = apps.find((a) => a.id === selectedAppId);
            if (!currentApp || (!currentApp.androidStoreUrl && !currentApp.iosStoreUrl)) return null;
            const storeKey = currentApp.slug || currentApp.id;
            const storeUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/apps/${storeKey}/store`;
            return (
              <CopyStoreLinkButton url={storeUrl} />
            );
          })()}
          {can('manage:campaigns') && (
            <Link href="/dashboard/campaigns">
              <button className="btn-dashboard">+ New campaign</button>
            </Link>
          )}
          {can('manage:links') && (
            <Link href="/dashboard/links">
              <button className="btn-dashboard btn-dashboard-primary">→ New link</button>
            </Link>
          )}
        </div>
      </div>

      {/* ─── KPI Strip ─────────────────────────────────────── */}
      <div
        className="dashboard-grid-kpi"
        style={{
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
        className="dashboard-grid-chart-row"
        style={{
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
                  const isNonOrganic = click.campaign && click.campaign !== 'direct';
                  // Format time in user's local timezone
                  let localTime = click.time;
                  try {
                    const d = new Date(click.time);
                    if (!isNaN(d.getTime())) {
                      localTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                    }
                  } catch {}
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginBottom: 4,
                        lineHeight: 1.55,
                        flexWrap: 'wrap',
                        padding: '3px 6px',
                        marginLeft: -6,
                        marginRight: -6,
                        borderRadius: 4,
                        background: isNonOrganic ? 'rgba(74, 222, 128, 0.1)' : 'transparent',
                      }}
                    >
                      <span style={{ color: isNonOrganic ? '#4ade80' : 'var(--color-primary)' }}>▸</span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{localTime}</span>
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
              <svg className="dashboard-chart-svg" viewBox="0 0 700 260" preserveAspectRatio="none" style={{ width: '100%', height: 300 }} onMouseLeave={() => setHoveredPoint(null)}>
                {/* Gridlines */}
                <g stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="4 4">
                  <line x1="40" y1="40" x2="690" y2="40" />
                  <line x1="40" y1="100" x2="690" y2="100" />
                  <line x1="40" y1="160" x2="690" y2="160" />
                  <line x1="40" y1="220" x2="690" y2="220" />
                </g>
                {/* Clicks area + smooth line */}
                <path d={clicksArea} fill="rgba(201, 255, 61, 0.08)" />
                <path d={clicksPath} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {/* Conversions smooth line */}
                <path d={conversionsPath} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {/* Interactive hover zones */}
                {clickPts.map((pt, i) => (
                  <g key={i} onMouseEnter={() => setHoveredPoint(i)}>
                    {/* Invisible wider hit area */}
                    <rect x={pt.x - (i === 0 ? 20 : (clickPts[1]?.x - clickPts[0]?.x) / 2)} y={0} width={i === 0 || i === clickPts.length - 1 ? 20 + (clickPts[1]?.x - clickPts[0]?.x) / 2 : clickPts[1]?.x - clickPts[0]?.x} height={260} fill="transparent" />
                    {hoveredPoint === i && (
                      <>
                        {/* Vertical guide line */}
                        <line x1={pt.x} y1={20} x2={pt.x} y2={220} stroke="var(--color-border-hover)" strokeWidth="1" strokeDasharray="3 3" />
                        {/* Click dot */}
                        <circle cx={pt.x} cy={pt.y} r="4" fill="var(--color-primary)" stroke="var(--color-bg)" strokeWidth="2" />
                        {/* Conversion dot */}
                        <circle cx={convPts[i].x} cy={convPts[i].y} r="4" fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth="2" />
                        {/* Tooltip background */}
                        <rect x={Math.min(pt.x - 55, 580)} y={2} width={110} height={38} rx={0} fill="var(--color-bg-card)" stroke="var(--color-border)" strokeWidth="1" />
                        {/* Tooltip text */}
                        <text x={Math.min(pt.x - 50, 585)} y={16} fontFamily="var(--font-mono)" fontSize="9" fill="var(--color-primary)">
                          clicks: {chartData[i]?.clicks}
                        </text>
                        <text x={Math.min(pt.x - 50, 585)} y={32} fontFamily="var(--font-mono)" fontSize="9" fill="var(--color-accent)">
                          conv: {chartData[i]?.conversions}
                        </text>
                      </>
                    )}
                  </g>
                ))}
                {/* End marker */}
                {clickPts.length > 0 && hoveredPoint === null && (
                  <circle cx={clickPts[clickPts.length - 1].x} cy={clickPts[clickPts.length - 1].y} r="3" fill="var(--color-primary)" />
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
            {can('manage:campaigns') && (
              <Link href="/dashboard/campaigns">
                <button className="btn-dashboard btn-dashboard-sm btn-dashboard-primary">+ new</button>
              </Link>
            )}
          </div>
        </div>
        <div className="dashboard-table-wrapper">
          {loading ? (
            <div style={{ padding: 20 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} style={{ height: 44, marginBottom: 4, width: '100%' }} />
              ))}
            </div>
          ) : (overview?.topCampaigns || []).length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              <p style={{ marginBottom: 16 }}>No campaigns yet</p>
              {can('manage:campaigns') && (
                <Link href="/dashboard/campaigns">
                  <button className="btn-dashboard btn-dashboard-primary">Create Campaign</button>
                </Link>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <thead>
                <tr>
                  {['name', 'status', 'links', 'clicks', 'conversions', 'cvr', ''].map((h) => (
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
                      <Link href={`/dashboard/campaigns/${campaign.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500, cursor: 'pointer' }}>
                          <span style={{ display: 'inline-block', width: 6, height: 18, background: CAMPAIGN_COLORS[idx % CAMPAIGN_COLORS.length] }} />
                          {campaign.name}
                        </div>
                      </Link>
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
                      <StatusPill status={campaign.status} />
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
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', position: 'relative' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === `campaign-${campaign.id}` ? null : `campaign-${campaign.id}`); }}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 8px', color: 'var(--color-text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      >⋯</button>
                      {openMenu === `campaign-${campaign.id}` && (
                        <div ref={menuRef} style={{ position: 'absolute', right: 16, top: '100%', zIndex: 50, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                          {[
                            { label: '▸ view', action: () => router.push(`/dashboard/campaigns/${campaign.id}`) },
                            { label: '▸ edit', action: () => router.push(`/dashboard/campaigns/${campaign.id}`) },
                            { label: '▸ duplicate', action: () => router.push(`/dashboard/campaigns/create?duplicate=${campaign.id}`) },
                            { label: '▸ copy slug', action: () => { navigator.clipboard.writeText(campaign.name); } },
                            { label: campaign.status === 'active' ? '▸ pause' : '▸ resume', action: () => {} },
                            { label: '▸ archive', action: () => {}, danger: true },
                          ].map((item) => (
                            <button
                              key={item.label}
                              onClick={() => { item.action(); setOpenMenu(null); }}
                              style={{
                                display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px',
                                fontFamily: 'var(--font-mono)', fontSize: 11, color: (item as any).danger ? 'var(--color-warning)' : 'var(--color-text)',
                                background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: '0.04em',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      )}
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
        className="dashboard-grid-split"
        style={{
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
            {can('manage:links') && (
              <Link href="/dashboard/links">
                <button className="btn-dashboard btn-dashboard-sm btn-dashboard-primary">+ new link</button>
              </Link>
            )}
          </div>
          <div className="dashboard-table-wrapper">
            {loading ? (
              <div style={{ padding: 20 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} style={{ height: 40, marginBottom: 4, width: '100%' }} />
                ))}
              </div>
            ) : (overview?.topLinks || []).length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                <p style={{ marginBottom: 16 }}>No links created yet</p>
                {can('manage:links') && (
                  <Link href="/dashboard/links">
                    <button className="btn-dashboard btn-dashboard-primary">Create First Link</button>
                  </Link>
                )}
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
                          <Link href={`/dashboard/links/${link.linkId}`} style={{ textDecoration: 'none' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', cursor: 'pointer' }}>{link.shortCode}</span>
                          </Link>
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
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', position: 'relative' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === `link-${link.linkId}` ? null : `link-${link.linkId}`); }}
                            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 8px', color: 'var(--color-text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                          >⋯</button>
                          {openMenu === `link-${link.linkId}` && (
                            <div ref={menuRef} style={{ position: 'absolute', right: 16, top: '100%', zIndex: 50, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                              {[
                                { label: '▸ view', action: () => router.push(`/dashboard/links/${link.linkId}`) },
                                { label: '▸ edit', action: () => router.push(`/dashboard/links/${link.linkId}`) },
                                { label: '▸ duplicate', action: () => router.push(`/dashboard/links/create?duplicate=${link.linkId}`) },
                                { label: '▸ copy link', action: () => { navigator.clipboard.writeText(`${window.location.origin}/${link.shortCode}`); } },
                                { label: '▸ copy slug', action: () => { navigator.clipboard.writeText(link.shortCode); } },
                                { label: '▸ delete', action: () => {}, danger: true },
                              ].map((item) => (
                                <button
                                  key={item.label}
                                  onClick={() => { item.action(); setOpenMenu(null); }}
                                  style={{
                                    display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px',
                                    fontFamily: 'var(--font-mono)', fontSize: 11, color: (item as any).danger ? 'var(--color-warning)' : 'var(--color-text)',
                                    background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: '0.04em',
                                  }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)'; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}
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

      {/* ─── Top Referrers ──────────────────────────────── */}
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
            <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>06</span>
            // top referrers
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>30d</span>
        </div>
        <div className="dashboard-table-wrapper">
          {loading ? (
            <div style={{ padding: 20 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} style={{ height: 36, marginBottom: 4, width: '100%' }} />
              ))}
            </div>
          ) : (overview?.topReferrers || []).length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              No referrer data yet
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <thead>
                <tr>
                  {['referrer', 'clicks', '%'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === 'referrer' ? 'left' : 'right',
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
                {(overview?.topReferrers || []).map((ref, idx) => {
                  let displayRef = ref.referrer;
                  try {
                    const u = new URL(ref.referrer);
                    displayRef = u.hostname + (u.pathname !== '/' ? u.pathname : '');
                  } catch { }
                  return (
                    <tr
                      key={idx}
                      style={{ transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ref.referrer}>
                        {displayRef}
                      </td>
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: 'var(--color-primary)' }}>
                        {ref.clicks.toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                        {ref.percentage}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
      className="dashboard-stat-cell"
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
