'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatDate, formatRelativeTime, copyToClipboard } from '@/lib/utils/slug';
import { generateQRCodeSVG } from '@/lib/utils/qr-code';
import { SmartLinkApi } from '@/lib/api';

const api = new SmartLinkApi();

interface Link {
  _id: string;
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
  clicksTrend: Array<{ date: string; clicks: number }>;
}

export default function LinkDetailPage() {
  const router = useRouter();
  const params = useParams();
  const linkId = params.id as string;

  const [link, setLink] = useState<Link | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, [linkId]);

  async function fetchData() {
    try {
      setLoading(true);
      const [linkData, analyticsData] = await Promise.all([
        api.getLink(linkId),
        api.getLinkAnalytics(linkId),
      ]);

      setLink(linkData as unknown as Link);

      // Generate QR code
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://smartlink.vercel.app';
      const deepLink = `${origin}/${(linkData as unknown as Link).shortCode}`;
      const svg = generateQRCodeSVG(deepLink, 200);
      setQrCodeUrl(`data:image/svg+xml;base64,${btoa(svg)}`);

      setAnalytics({
        totalClicks: analyticsData.totalClicks || 0,
        uniqueClicks: analyticsData.clicks?.unique || 0,
        conversions: analyticsData.conversions?.total || 0,
        deferredMatches: analyticsData.deferredMatches || 0,
        devices: analyticsData.devices || {},
        countries: analyticsData.topCountries || [],
        browsers: analyticsData.topBrowsers || [],
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

  if (loading) {
    return (
      <div className="min-h-screen bg-base p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 rounded-full animate-spin mb-4" style={{ borderColor: 'var(--color-primary-light)', borderTopColor: 'var(--color-primary)' }}></div>
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading link...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen bg-base p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="font-medium mb-4"
            style={{ color: 'var(--color-primary)' }}
          >
            ← Back
          </button>
          <div className="rounded-lg p-6" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--color-danger)', borderWidth: '1px', color: 'var(--color-danger)' }}>
            {error || 'Link not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="font-medium mb-4"
          style={{ color: 'var(--color-primary)' }}
        >
          ← Back
        </button>

        {/* Header */}
        <div className="rounded-lg shadow-sm p-8 mb-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Short Code</p>
              <h1 className="text-4xl font-mono font-bold mb-2" style={{ color: 'var(--color-primary)' }}>
                {link.shortCode}
              </h1>
              <p className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                {typeof window !== 'undefined' ? window.location.host : 'smartlink.vercel.app'}/{link.shortCode}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge status={link.isActive ? 'active' : 'paused'}>
                {link.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/dashboard/links/${linkId}/edit`)}
              >
                ✏️ Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </Button>
            </div>
          </div>

          {/* Destination URL */}
          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderWidth: '1px' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
              DESTINATION URL
            </p>
            <a
              href={link.destinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm"
              style={{ color: 'var(--color-primary)' }}
            >
              {link.destinationUrl}
            </a>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg shadow-sm p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Total Clicks</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              {analytics?.totalClicks || 0}
            </p>
          </div>

          <div className="rounded-lg shadow-sm p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Unique Clicks</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              {analytics?.uniqueClicks || 0}
            </p>
          </div>

          <div className="rounded-lg shadow-sm p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Conversions</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              {analytics?.conversions || 0}
            </p>
          </div>

          <div className="rounded-lg shadow-sm p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Deferred Matches</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              {analytics?.deferredMatches || 0}
            </p>
          </div>
        </div>

        {/* QR Code and Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* QR Code */}
          <div className="rounded-lg shadow-sm p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
              QR Code
            </h3>
            {qrCodeUrl && (
              <div className="rounded-lg p-4 flex justify-center" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderWidth: '1px' }}>
                <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40" />
              </div>
            )}
            <p className="text-xs mt-4 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              Share this QR code on posters, emails, and social media
            </p>
          </div>

          {/* Link Type and Campaign */}
          <div className="rounded-lg shadow-sm p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Info</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  LINK TYPE
                </p>
                <Badge status="active" size="sm">
                  {link.linkType}
                </Badge>
              </div>

              {link.campaignName && (
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                    CAMPAIGN
                  </p>
                  <a
                    href={`/dashboard/campaigns/${link.campaignId}`}
                    className="text-sm"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {link.campaignName}
                  </a>
                </div>
              )}

              {link.expiresAt && (
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                    EXPIRES
                  </p>
                  <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                    {formatDate(link.expiresAt)}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  CREATED
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                  {formatRelativeTime(link.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Device Breakdown */}
          {analytics && Object.keys(analytics.devices).length > 0 && (
            <div className="rounded-lg shadow-sm p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                Devices
              </h3>
              <div className="space-y-3">
                {Object.entries(analytics.devices).map(([device, count]) => (
                  <div key={device}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                        {device}
                      </p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {count}
                      </p>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                      <div
                        className="h-2 rounded-full"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          width: `${Math.min(
                            100,
                            (count /
                              (analytics.totalClicks || 1)) *
                              100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Parameters */}
        {link.params && Object.keys(link.params).length > 0 && (
          <div className="rounded-lg shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
              Link Parameters
            </h3>
            <div className="space-y-3">
              {Object.entries(link.params).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-start justify-between p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderWidth: '1px' }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      {key}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      {typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform Overrides */}
        {link.platformOverrides &&
          Object.keys(link.platformOverrides).length > 0 && (
            <div className="rounded-lg shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                Platform Overrides
              </h3>
              <div className="space-y-4">
                {link.platformOverrides.android && (
                  <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)', borderWidth: '1px' }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: 'rgba(59, 130, 246, 1)' }}>
                      Android
                    </p>
                    <p className="text-xs break-all" style={{ color: 'rgba(59, 130, 246, 0.8)' }}>
                      {link.platformOverrides.android.url}
                    </p>
                    {link.platformOverrides.android.fallback && (
                      <p className="text-xs mt-2" style={{ color: 'rgba(59, 130, 246, 0.7)' }}>
                        Fallback: {link.platformOverrides.android.fallback}
                      </p>
                    )}
                  </div>
                )}

                {link.platformOverrides.ios && (
                  <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.3)', borderWidth: '1px' }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: 'rgba(168, 85, 247, 1)' }}>
                      iOS
                    </p>
                    <p className="text-xs break-all" style={{ color: 'rgba(168, 85, 247, 0.8)' }}>
                      {link.platformOverrides.ios.url}
                    </p>
                    {link.platformOverrides.ios.fallback && (
                      <p className="text-xs mt-2" style={{ color: 'rgba(168, 85, 247, 0.7)' }}>
                        Fallback: {link.platformOverrides.ios.fallback}
                      </p>
                    )}
                  </div>
                )}

                {link.platformOverrides.web && (
                  <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderWidth: '1px' }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                      Web
                    </p>
                    <p className="text-xs break-all" style={{ color: 'var(--color-text-secondary)' }}>
                      {link.platformOverrides.web.url}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Analytics Charts */}
        {analytics && analytics.clicksTrend && analytics.clicksTrend.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Clicks Over Time */}
            <div className="rounded-lg shadow-sm p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                Clicks Over Time
              </h3>
              {analytics.clicksTrend.length > 0 ? (
                <div className="flex items-end gap-1 h-40">
                  {analytics.clicksTrend.map((item, idx) => {
                    const maxClicks = Math.max(
                      ...analytics.clicksTrend.map((t) => t.clicks)
                    );
                    const height =
                      maxClicks > 0
                        ? (item.clicks / maxClicks) * 100
                        : 0;
                    return (
                      <div
                        key={idx}
                        className="flex-1 rounded-t transition group relative"
                        style={{ height: `${height}%`, minHeight: '4px', backgroundColor: 'var(--color-primary-light)' }}
                        title={`${item.date}: ${item.clicks} clicks`}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-light)'}
                      >
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-0 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none" style={{ backgroundColor: 'var(--color-text)' }}>
                          {item.clicks}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
                  No click data available
                </p>
              )}
            </div>

            {/* Top Countries */}
            {analytics.countries && analytics.countries.length > 0 && (
              <div className="rounded-lg shadow-sm p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                  Top Countries
                </h3>
                <div className="space-y-3">
                  {analytics.countries.slice(0, 5).map((item) => (
                    <div key={item.country}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {item.country}
                        </p>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                          {item.clicks}
                        </p>
                      </div>
                      <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                        <div
                          className="h-2 rounded-full"
                          style={{
                            backgroundColor: 'var(--color-primary)',
                            width: `${Math.min(
                              100,
                              (item.clicks /
                                (analytics.countries[0]?.clicks || 1)) *
                                100
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Top Browsers */}
        {analytics && analytics.browsers && analytics.browsers.length > 0 && (
          <div className="rounded-lg shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
              Top Browsers
            </h3>
            <div className="space-y-3">
              {analytics.browsers.slice(0, 5).map((item) => (
                <div key={item.browser}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item.browser}</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {item.clicks}
                    </p>
                  </div>
                  <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                    <div
                      className="h-2 rounded-full"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        width: `${Math.min(
                          100,
                          (item.clicks / (analytics.browsers[0]?.clicks || 1)) *
                            100
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Link Info Footer */}
        <div className="rounded-lg p-4 text-xs" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' }}>
          <p>Updated {formatRelativeTime(link.updatedAt)}</p>
        </div>
      </div>
    </div>
  );
}
