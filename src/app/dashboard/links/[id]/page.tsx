'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { formatDate, formatRelativeTime, copyToClipboard } from '@/lib/utils/slug';
import { generateQRCodeSVG, SMARTLINK_LOGO_SVG } from '@/lib/utils/qr-code';
import { smartLinkApi } from '@/lib/api';
import { useDashboard } from '@/lib/context/DashboardContext';

interface LinkData {
  _id: string;
  title?: string;
  shortCode: string;
  destinationUrl: string;
  linkType: string;
  clickCount: number;
  isActive: boolean;
  expiresAt?: string;
  params?: Record<string, any>;
  platformOverrides?: Record<string, any>;
  campaignId?: string;
  campaignName?: string;
  createdAt: string;
  updatedAt: string;
}

interface Analytics {
  totalClicks: number;
  uniqueClicks: number;
  conversions: number;
  deferredMatches: number;
  actions: {
    appOpened: number;
    appInstalled: number;
    storeRedirect: number;
    webFallback: number;
  };
  devices: Record<string, number>;
  channels: Array<{ channel: string; clicks: number }>;
  countries: Array<{ country: string; clicks: number }>;
  browsers: Array<{ browser: string; clicks: number }>;
  referrers: Array<{ referrer: string; clicks: number }>;
  deepLinks: Array<{ url: string; clicks: number; appOpened: number; installs: number }>;
  refParams: Array<{ ref: string; clicks: number; appOpened: number; installs: number }>;
  utmSources: Array<{ source: string; clicks: number; appOpened: number; installs: number }>;
  utmMediums: Array<{ medium: string; clicks: number; appOpened: number; installs: number }>;
  utmCampaigns: Array<{ campaign: string; clicks: number; appOpened: number; installs: number }>;
  customParams: Array<{ key: string; value: string; clicks: number; appOpened: number; installs: number }>;
}

export default function LinkDetailPage() {
  const router = useRouter();
  const params = useParams();
  const linkId = params.id as string;
  const { can, isContextReady } = useDashboard();

  const [link, setLink] = useState<LinkData | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, [linkId]);

  useEffect(() => {
    if (isContextReady && !can('manage:links')) {
      router.replace('/dashboard');
    }
  }, [isContextReady, can, router]);

  async function fetchData() {
    try {
      setLoading(true);
      const [linkData, analyticsData] = await Promise.all([
        smartLinkApi.getLink(linkId),
        smartLinkApi.getLinkAnalytics(linkId),
      ]);

      setLink(linkData as unknown as LinkData);

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://smartlink.vercel.app';
      const deepLink = `${origin}/${(linkData as unknown as LinkData).shortCode}`;
      const svg = await generateQRCodeSVG(deepLink, 200, SMARTLINK_LOGO_SVG);
      setQrCodeUrl(`data:image/svg+xml;base64,${btoa(svg)}`);

      setAnalytics({
        totalClicks: analyticsData.totalClicks || 0,
        uniqueClicks: analyticsData.clicks?.unique || 0,
        conversions: analyticsData.conversions?.total || 0,
        deferredMatches: analyticsData.deferredMatches || 0,
        actions: analyticsData.actions || { appOpened: 0, appInstalled: 0, storeRedirect: 0, webFallback: 0 },
        devices: analyticsData.devices || {},
        channels: analyticsData.channels || [],
        countries: analyticsData.topCountries || [],
        browsers: analyticsData.topBrowsers || [],
        referrers: analyticsData.topReferrers || [],
        deepLinks: analyticsData.topDeepLinks || [],
        refParams: analyticsData.topRefParams || [],
        utmSources: analyticsData.topUtmSources || [],
        utmMediums: analyticsData.topUtmMediums || [],
        utmCampaigns: analyticsData.topUtmCampaigns || [],
        customParams: analyticsData.customParams || [],
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load link');
    } finally {
      setLoading(false);
    }
  }

  async function refreshData() {
    try {
      setRefreshing(true);
      const analyticsData = await smartLinkApi.getLinkAnalytics(linkId);
      setAnalytics({
        totalClicks: analyticsData.totalClicks || 0,
        uniqueClicks: analyticsData.clicks?.unique || 0,
        conversions: analyticsData.conversions?.total || 0,
        deferredMatches: analyticsData.deferredMatches || 0,
        actions: analyticsData.actions || { appOpened: 0, appInstalled: 0, storeRedirect: 0, webFallback: 0 },
        devices: analyticsData.devices || {},
        channels: analyticsData.channels || [],
        countries: analyticsData.topCountries || [],
        browsers: analyticsData.topBrowsers || [],
        referrers: analyticsData.topReferrers || [],
        deepLinks: analyticsData.topDeepLinks || [],
        refParams: analyticsData.topRefParams || [],
        utmSources: analyticsData.topUtmSources || [],
        utmMediums: analyticsData.topUtmMediums || [],
        utmCampaigns: analyticsData.topUtmCampaigns || [],
        customParams: analyticsData.customParams || [],
      });
    } catch (err: any) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCopy() {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://smartlink.vercel.app';
      await copyToClipboard(`${origin}/${link?.shortCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }

  let sectionNum = 0;
  const nextSection = (label: string) => {
    sectionNum++;
    const num = String(sectionNum).padStart(2, '0');
    return (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
        <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>{num}</span>
        // {label}
      </span>
    );
  };

  const progressBar = (label: string, value: number, max: number, color = 'var(--color-primary)') => (
    <div key={label} style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }} title={label}>{label}</span>
        <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0, marginLeft: 8 }}>{value}</span>
      </div>
      <div style={{ height: 6, background: 'var(--color-bg-hover)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );

  // Progress bar showing link clicks + installs + app opens per param value
  const dualStatBar = (label: string, clicks: number, appOpened: number, maxClicks: number, color = 'var(--color-primary)', installs = 0, tooltip?: string) => {
    return (
      <div key={label} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 6, alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%' }} title={tooltip || label}>{label}</span>
          <span style={{ flexShrink: 0, marginLeft: 8, display: 'flex', gap: 14 }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>{clicks} <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>clicks</span></span>
            <span style={{ color: 'var(--color-success, #22c55e)' }}>{installs} <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>installs</span></span>
            <span style={{ color: 'var(--color-primary)' }}>{appOpened} <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>app opens</span></span>
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--color-bg-hover)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${maxClicks > 0 ? Math.min(100, (clicks / maxClicks) * 100) : 0}%`, background: color, opacity: 0.3, transition: 'width 0.6s ease' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${maxClicks > 0 ? Math.min(100, ((appOpened + installs) / maxClicks) * 100) : 0}%`, background: color, transition: 'width 0.6s ease' }} />
        </div>
      </div>
    );
  };

  const emptyState = (msg: string) => (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 40 }}>{msg}</div>
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '1rem' }} className="md:p-8">
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>loading link...</div>
        </div>
      </div>
    );
  }

  if (!link) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '1rem' }} className="md:p-8">
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <button onClick={() => router.back()} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>← back</button>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-warning)', padding: 20, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-warning)' }}>
            {error || 'Link not found'}
          </div>
        </div>
      </div>
    );
  }

  // Reset section counter for render
  sectionNum = 0;

  // Check if there's any metadata-based analytics
  const hasDeepLinks = analytics && analytics.deepLinks.length > 0;
  const hasRefParams = analytics && analytics.refParams.length > 0;
  const hasUtmData = analytics && (analytics.utmSources.length > 0 || analytics.utmMediums.length > 0 || analytics.utmCampaigns.length > 0);
  const hasCustomParams = analytics && analytics.customParams.length > 0;
  const hasTrackingData = hasDeepLinks || hasRefParams || hasUtmData || hasCustomParams;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '1rem' }} className="md:p-8">
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: '1rem' }} className="md:flex-nowrap">
          <button onClick={() => router.back()} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>← back</button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="btn-dashboard btn-dashboard-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, opacity: refreshing ? 0.6 : 1 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>
                <path d="M21 12a9 9 0 1 1-3.2-6.85" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
              {refreshing ? 'refreshing...' : 'refresh data'}
            </button>
            <button onClick={handleCopy} className="btn-dashboard btn-dashboard-sm">{copied ? 'copied!' : 'copy link'}</button>
            <button onClick={() => router.push(`/dashboard/links/create?duplicate=${linkId}`)} className="btn-dashboard btn-dashboard-sm">duplicate</button>
            <button onClick={() => router.push(`/dashboard/links/${linkId}/edit`)} className="btn-dashboard btn-dashboard-sm btn-dashboard-primary">edit</button>
          </div>
        </div>

        {/* 01 Link Details */}
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {nextSection('link details')}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '3px 10px',
              border: '1px solid',
              color: link.isActive ? 'var(--color-primary)' : 'var(--color-warning)',
              borderColor: link.isActive ? 'var(--color-primary)' : 'var(--color-warning)',
            }}>
              {link.isActive ? 'active' : 'inactive'}
            </span>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4, letterSpacing: '-0.01em' }}>
              {link.title || link.shortCode}
            </div>
            <div
              onClick={async () => {
                const origin = typeof window !== 'undefined' ? window.location.origin : 'https://smartlink.vercel.app';
                await copyToClipboard(`${origin}/${link.shortCode}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 16, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title="Click to copy link"
            >
              {typeof window !== 'undefined' ? window.location.host : 'smartlink.vercel.app'}/{link.shortCode}
              <span style={{ fontSize: 10, color: copied ? 'var(--color-primary)' : 'var(--color-text-tertiary)', transition: 'color 0.2s' }}>
                {copied ? '✓ copied' : '⧉'}
              </span>
            </div>
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '12px 16px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>destination</div>
              <a href={link.destinationUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-secondary)', wordBreak: 'break-all', textDecoration: 'none' }}>
                {link.destinationUrl || '(dynamic — set via deepLink query param)'}
              </a>
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', flexWrap: 'wrap' }}>
              <span>type: <span style={{ color: 'var(--color-text)' }}>{link.linkType}</span></span>
              {link.campaignName && <span>campaign: <a href={`/dashboard/campaigns/${link.campaignId}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{link.campaignName}</a></span>}
              {link.expiresAt && <span>expires: <span style={{ color: 'var(--color-text)' }}>{formatDate(link.expiresAt)}</span></span>}
            </div>
          </div>
        </div>

        {/* 02 KPI Stats */}
        <div className="dashboard-grid-kpi" style={{ marginBottom: 24 }}>
          {[
            { label: 'total clicks', value: analytics?.totalClicks || 0, accent: true },
            { label: 'store redirects', value: analytics?.actions.storeRedirect || 0 },
            { label: 'installs', value: analytics?.deferredMatches || 0 },
            { label: 'unique clicks', value: analytics?.uniqueClicks || 0 },
            { label: 'app opens', value: analytics?.actions.appOpened || 0 },
          ].map((s) => (
            <div key={s.label} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: s.accent ? 'var(--color-primary)' : 'var(--color-text)', letterSpacing: '-0.02em' }}>{s.value}</div>
            </div>
          ))}
        </div>


        {/* Action Breakdown + Channels row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }} className="md:grid-cols-1 lg:grid-cols-2">
          {/* Action Breakdown */}
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {nextSection('actions')}
            </div>
            <div style={{ padding: 20 }}>
              {analytics && (analytics.actions.appOpened > 0 || analytics.actions.storeRedirect > 0 || analytics.actions.webFallback > 0 || analytics.deferredMatches > 0) ? (
                <>
                  {progressBar('app opened', analytics.actions.appOpened, analytics.totalClicks || 1, 'var(--color-primary)')}
                  {progressBar('installs', analytics.deferredMatches, analytics.totalClicks || 1, 'var(--color-success, #22c55e)')}
                  {progressBar('store redirect', analytics.actions.storeRedirect, analytics.totalClicks || 1, 'var(--color-warning)')}
                  {progressBar('web fallback', analytics.actions.webFallback, analytics.totalClicks || 1, 'var(--color-secondary)')}
                </>
              ) : emptyState('no action data yet')}
            </div>
          </div>

          {/* Channels */}
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {nextSection('channels')}
            </div>
            <div style={{ padding: 20 }}>
              {analytics && analytics.channels.length > 0 ? (
                analytics.channels.map((item) =>
                  progressBar(item.channel, item.clicks, analytics.channels[0]?.clicks || 1, 'var(--color-accent)')
                )
              ) : emptyState('no channel data yet')}
            </div>
          </div>
        </div>

        {/* Deep Link URLs — only for dynamic links */}
        {hasDeepLinks && analytics && (
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {nextSection('deep link urls')}
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                unique destination urls passed via ?deepLink= param
              </div>
              {analytics.deepLinks.map((item) => {
                let displayUrl = item.url;
                try { const u = new URL(item.url); displayUrl = u.pathname === '/' ? u.hostname : u.hostname + u.pathname; } catch {}
                return dualStatBar(displayUrl, item.clicks, item.appOpened, analytics.deepLinks[0]?.clicks || 1, 'var(--color-secondary)', item.installs, item.url);
              })}
            </div>
          </div>
        )}

        {/* Ref Params */}
        {hasRefParams && analytics && (
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {nextSection('ref params')}
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                clicks, installs & app opens by ref parameter value
              </div>
              {analytics.refParams.map((item) =>
                dualStatBar(item.ref, item.clicks, item.appOpened, analytics.refParams[0]?.clicks || 1, 'var(--color-primary)', item.installs)
              )}
            </div>
          </div>
        )}

        {/* UTM Analytics */}
        {hasUtmData && analytics && (
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {nextSection('utm tracking')}
            </div>
            <div style={{ padding: 20 }}>
              {/* UTM Sources */}
              {analytics.utmSources.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    utm_source
                  </div>
                  {analytics.utmSources.map((item) =>
                    dualStatBar(item.source, item.clicks, item.appOpened, analytics.utmSources[0]?.clicks || 1, 'var(--color-primary)', item.installs)
                  )}
                </div>
              )}

              {/* UTM Mediums */}
              {analytics.utmMediums.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    utm_medium
                  </div>
                  {analytics.utmMediums.map((item) =>
                    dualStatBar(item.medium, item.clicks, item.appOpened, analytics.utmMediums[0]?.clicks || 1, 'var(--color-accent)', item.installs)
                  )}
                </div>
              )}

              {/* UTM Campaigns */}
              {analytics.utmCampaigns.length > 0 && (
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    utm_campaign
                  </div>
                  {analytics.utmCampaigns.map((item) =>
                    dualStatBar(item.campaign, item.clicks, item.appOpened, analytics.utmCampaigns[0]?.clicks || 1, 'var(--color-warning)', item.installs)
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom Params (e.g. no_app_redirect, etc.) */}
        {hasCustomParams && analytics && (
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {nextSection('custom params')}
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                other query params passed with the link
              </div>
              {(() => {
                // Group custom params by key
                const grouped: Record<string, Array<{ value: string; clicks: number; appOpened: number; installs: number }>> = {};
                analytics.customParams.forEach((p) => {
                  if (!grouped[p.key]) grouped[p.key] = [];
                  grouped[p.key].push({ value: p.value, clicks: p.clicks, appOpened: p.appOpened, installs: p.installs });
                });
                return Object.entries(grouped).map(([key, values]) => (
                  <div key={key} style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-primary)', marginBottom: 10, fontWeight: 600 }}>
                      {key}
                    </div>
                    {values.map((v) =>
                      dualStatBar(`${v.value}`, v.clicks, v.appOpened, values[0]?.clicks || 1, 'var(--color-text-tertiary)', v.installs)
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* QR + Devices row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, marginBottom: 24 }} className="md:grid-cols-2 lg:grid-cols-[1fr_2fr]">
          {/* QR Code */}
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {nextSection('qr code')}
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" style={{ width: 160, height: 160 }} />}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 12, textAlign: 'center' }}>scan to open link</div>
            </div>
          </div>

          {/* Devices */}
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {nextSection('devices')}
            </div>
            <div style={{ padding: 20 }}>
              {analytics && Object.keys(analytics.devices).length > 0 ? (
                Object.entries(analytics.devices).map(([device, count]) =>
                  progressBar(device, count, analytics.totalClicks || 1)
                )
              ) : emptyState('no device data yet')}
            </div>
          </div>
        </div>

        {/* Parameters */}
        {link.params && Object.keys(link.params).length > 0 && (
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {nextSection('parameters')}
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="md:grid-cols-2">
              {Object.entries(link.params).map(([key, value]) => (
                <div key={key} style={{ background: 'var(--color-bg)', padding: 12, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{key}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text)', wordBreak: 'break-all' }}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform Overrides */}
        {link.platformOverrides && Object.keys(link.platformOverrides).length > 0 && (
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {nextSection('platform overrides')}
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {link.platformOverrides.android && (
                <div style={{ background: 'var(--color-bg)', padding: 12, border: '1px solid var(--color-border)', borderLeft: '3px solid var(--color-primary)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-primary)', marginBottom: 4 }}>android</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text)', wordBreak: 'break-all' }}>{link.platformOverrides.android.url}</div>
                  {link.platformOverrides.android.fallback && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>fallback: {link.platformOverrides.android.fallback}</div>
                  )}
                </div>
              )}
              {link.platformOverrides.ios && (
                <div style={{ background: 'var(--color-bg)', padding: 12, border: '1px solid var(--color-border)', borderLeft: '3px solid var(--color-accent)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-accent)', marginBottom: 4 }}>ios</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text)', wordBreak: 'break-all' }}>{link.platformOverrides.ios.url}</div>
                  {link.platformOverrides.ios.fallback && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>fallback: {link.platformOverrides.ios.fallback}</div>
                  )}
                </div>
              )}
              {link.platformOverrides.web && (
                <div style={{ background: 'var(--color-bg)', padding: 12, border: '1px solid var(--color-border)', borderLeft: '3px solid var(--color-secondary)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-secondary)', marginBottom: 4 }}>web</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text)', wordBreak: 'break-all' }}>{link.platformOverrides.web.url}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Countries + Browsers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }} className="md:grid-cols-1 lg:grid-cols-2">
          {analytics && analytics.countries && analytics.countries.length > 0 && (
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                {nextSection('countries')}
              </div>
              <div style={{ padding: 20 }}>
                {analytics.countries.slice(0, 8).map((item) =>
                  progressBar(item.country, item.clicks, analytics.countries[0]?.clicks || 1, 'var(--color-secondary)')
                )}
              </div>
            </div>
          )}

          {analytics && analytics.browsers && analytics.browsers.length > 0 && (
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                {nextSection('browsers')}
              </div>
              <div style={{ padding: 20 }}>
                {analytics.browsers.slice(0, 5).map((item) =>
                  progressBar(item.browser, item.clicks, analytics.browsers[0]?.clicks || 1, 'var(--color-accent)')
                )}
              </div>
            </div>
          )}
        </div>

        {/* Referrers */}
        {analytics && analytics.referrers && analytics.referrers.length > 0 && (
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {nextSection('referrers')}
            </div>
            <div style={{ padding: 20 }}>
              {analytics.referrers.slice(0, 10).map((item) => {
                let displayRef = item.referrer;
                try {
                  const u = new URL(item.referrer);
                  // Show hostname + path + search params (strip protocol only)
                  displayRef = u.hostname + (u.pathname !== '/' ? u.pathname : '') + u.search;
                } catch {}
                return (
                  <div key={item.referrer} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 4 }}>
                      <a href={item.referrer} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--color-warning)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}
                        title={item.referrer}
                      >
                        {displayRef}
                      </a>
                      <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0, marginLeft: 8 }}>{item.clicks}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--color-bg-hover)', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${analytics.referrers[0]?.clicks > 0 ? Math.min(100, (item.clicks / analytics.referrers[0].clicks) * 100) : 0}%`, background: 'var(--color-warning)', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', padding: '12px 0', borderTop: '1px dashed var(--color-border)', display: 'flex', gap: 24 }}>
          <span>created {formatRelativeTime(link.createdAt)}</span>
          <span>updated {formatRelativeTime(link.updatedAt)}</span>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
