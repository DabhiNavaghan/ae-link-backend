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
  devices: Record<string, number>;
  countries: Array<{ country: string; clicks: number }>;
  browsers: Array<{ browser: string; clicks: number }>;
  referrers: Array<{ referrer: string; clicks: number }>;
  clicksTrend: Array<{ date: string; clicks: number }>;
}

export default function LinkDetailPage() {
  const router = useRouter();
  const params = useParams();
  const linkId = params.id as string;
  const { can, isContextReady } = useDashboard();

  const [link, setLink] = useState<LinkData | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
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
        devices: analyticsData.devices || {},
        countries: analyticsData.topCountries || [],
        browsers: analyticsData.topBrowsers || [],
        referrers: analyticsData.topReferrers || [],
        clicksTrend: analyticsData.clicksTrend || [],
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load link');
    } finally {
      setLoading(false);
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

  const sectionHeader = (num: string, label: string) => (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.16em', color: 'var(--color-text-tertiary)' }}>
      <span style={{ color: 'var(--color-primary)', fontWeight: 700, marginRight: 10 }}>{num}</span>
      // {label}
    </span>
  );

  const progressBar = (label: string, value: number, max: number, color = 'var(--color-primary)') => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: 'var(--color-text)' }}>{label}</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>{value}</span>
      </div>
      <div style={{ height: 6, background: 'var(--color-bg-hover)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color, transition: 'width 0.6s ease' }} />
      </div>
    </div>
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '1rem' }} className="md:p-8">
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: '1rem' }} className="md:flex-nowrap">
          <button onClick={() => router.back()} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>← back</button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleCopy} className="btn-dashboard btn-dashboard-sm">{copied ? 'copied!' : 'copy link'}</button>
            <button onClick={() => router.push(`/dashboard/links/create?duplicate=${linkId}`)} className="btn-dashboard btn-dashboard-sm">duplicate</button>
            <button onClick={() => router.push(`/dashboard/links/${linkId}/edit`)} className="btn-dashboard btn-dashboard-sm btn-dashboard-primary">edit</button>
          </div>
        </div>

        {/* 01 Header */}
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {sectionHeader('01', 'link details')}
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
                {link.destinationUrl}
              </a>
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              <span>type: <span style={{ color: 'var(--color-text)' }}>{link.linkType}</span></span>
              {link.campaignName && <span>campaign: <a href={`/dashboard/campaigns/${link.campaignId}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{link.campaignName}</a></span>}
              {link.expiresAt && <span>expires: <span style={{ color: 'var(--color-text)' }}>{formatDate(link.expiresAt)}</span></span>}
            </div>
          </div>
        </div>

        {/* 02 Stats */}
        <div className="dashboard-grid-kpi" style={{ marginBottom: 24 }}>
          {[
            { label: 'clicks', value: analytics?.totalClicks || 0, accent: true },
            { label: 'unique', value: analytics?.uniqueClicks || 0 },
            { label: 'conversions', value: analytics?.conversions || 0 },
            { label: 'deferred', value: analytics?.deferredMatches || 0 },
          ].map((s) => (
            <div key={s.label} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: s.accent ? 'var(--color-primary)' : 'var(--color-text)', letterSpacing: '-0.02em' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* QR + Info + Devices row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, marginBottom: 24 }} className="md:grid-cols-2 lg:grid-cols-[1fr_2fr]">
          {/* QR Code */}
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {sectionHeader('03', 'qr code')}
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" style={{ width: 160, height: 160 }} />}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 12, textAlign: 'center' }}>scan to open link</div>
            </div>
          </div>

          {/* Devices */}
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {sectionHeader('04', 'devices')}
            </div>
            <div style={{ padding: 20 }}>
              {analytics && Object.keys(analytics.devices).length > 0 ? (
                Object.entries(analytics.devices).map(([device, count]) =>
                  progressBar(device, count, analytics.totalClicks || 1)
                )
              ) : (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 40 }}>no device data yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Parameters */}
        {link.params && Object.keys(link.params).length > 0 && (
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              {sectionHeader('05', 'parameters')}
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
              {sectionHeader('06', 'platform overrides')}
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

        {/* Clicks Trend + Countries */}
        {analytics && analytics.clicksTrend && analytics.clicksTrend.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }} className="md:grid-cols-1 lg:grid-cols-[2fr_1fr]">
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                {sectionHeader('07', 'clicks trend')}
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
                  {analytics.clicksTrend.map((item, idx) => {
                    const maxClicks = Math.max(...analytics.clicksTrend.map((t) => t.clicks));
                    const height = maxClicks > 0 ? (item.clicks / maxClicks) * 100 : 0;
                    return (
                      <div
                        key={idx}
                        style={{ flex: 1, height: `${height}%`, minHeight: 2, background: 'var(--color-primary)', transition: 'height 0.3s ease', cursor: 'pointer' }}
                        title={`${item.date}: ${item.clicks} clicks`}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-accent)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-primary)'; }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {analytics.countries && analytics.countries.length > 0 && (
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                  {sectionHeader('08', 'countries')}
                </div>
                <div style={{ padding: 20 }}>
                  {analytics.countries.slice(0, 5).map((item) =>
                    progressBar(item.country, item.clicks, analytics.countries[0]?.clicks || 1, 'var(--color-secondary)')
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Browsers + Referrers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }} className="md:grid-cols-1 lg:grid-cols-2">
          {analytics && analytics.browsers && analytics.browsers.length > 0 && (
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                {sectionHeader('09', 'browsers')}
              </div>
              <div style={{ padding: 20 }}>
                {analytics.browsers.slice(0, 5).map((item) =>
                  progressBar(item.browser, item.clicks, analytics.browsers[0]?.clicks || 1, 'var(--color-accent)')
                )}
              </div>
            </div>
          )}

          {analytics && analytics.referrers && analytics.referrers.length > 0 && (
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                {sectionHeader('10', 'referrers')}
              </div>
              <div style={{ padding: 20 }}>
                {analytics.referrers.slice(0, 8).map((item) => {
                  let displayRef = item.referrer;
                  try { const u = new URL(item.referrer); displayRef = u.hostname; } catch {}
                  return progressBar(displayRef, item.clicks, analytics.referrers[0]?.clicks || 1, 'var(--color-warning)');
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', padding: '12px 0', borderTop: '1px dashed var(--color-border)', display: 'flex', gap: 24 }}>
          <span>created {formatRelativeTime(link.createdAt)}</span>
          <span>updated {formatRelativeTime(link.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}
