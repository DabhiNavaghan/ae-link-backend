'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatDate, formatRelativeTime, copyToClipboard } from '@/lib/utils/slug';
import { generateQRCodeSVG } from '@/lib/utils/qr-code';
import { AeLinkApi } from '@/lib/api';

const api = new AeLinkApi();

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
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://aelink.vercel.app';
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
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://aelink.vercel.app';
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
            <div className="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600">Loading link...</p>
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
            className="text-primary-600 hover:text-primary-700 font-medium mb-4"
          >
            ← Back
          </button>
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-6 text-danger-800">
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
          className="text-primary-600 hover:text-primary-700 font-medium mb-4"
        >
          ← Back
        </button>

        {/* Header */}
        <div className="bg-card rounded-lg shadow-sm p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm text-slate-600 mb-2">Short Code</p>
              <h1 className="text-4xl font-mono font-bold text-primary-600 mb-2">
                {link.shortCode}
              </h1>
              <p className="text-slate-600 font-mono">
                {typeof window !== 'undefined' ? window.location.host : 'aelink.vercel.app'}/{link.shortCode}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge status={link.isActive ? 'active' : 'paused'}>
                {link.isActive ? 'Active' : 'Inactive'}
              </Badge>
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
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 font-semibold mb-2">
              DESTINATION URL
            </p>
            <a
              href={link.destinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 break-all text-sm"
            >
              {link.destinationUrl}
            </a>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-lg shadow-sm p-4">
            <p className="text-sm text-slate-600 mb-1">Total Clicks</p>
            <p className="text-3xl font-bold text-slate-900">
              {analytics?.totalClicks || 0}
            </p>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-4">
            <p className="text-sm text-slate-600 mb-1">Unique Clicks</p>
            <p className="text-3xl font-bold text-slate-900">
              {analytics?.uniqueClicks || 0}
            </p>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-4">
            <p className="text-sm text-slate-600 mb-1">Conversions</p>
            <p className="text-3xl font-bold text-slate-900">
              {analytics?.conversions || 0}
            </p>
          </div>

          <div className="bg-card rounded-lg shadow-sm p-4">
            <p className="text-sm text-slate-600 mb-1">Deferred Matches</p>
            <p className="text-3xl font-bold text-slate-900">
              {analytics?.deferredMatches || 0}
            </p>
          </div>
        </div>

        {/* QR Code and Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* QR Code */}
          <div className="bg-card rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              QR Code
            </h3>
            {qrCodeUrl && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 flex justify-center">
                <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40" />
              </div>
            )}
            <p className="text-xs text-slate-500 mt-4 text-center">
              Share this QR code on posters, emails, and social media
            </p>
          </div>

          {/* Link Type and Campaign */}
          <div className="bg-card rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Info</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">
                  LINK TYPE
                </p>
                <Badge status="active" size="sm">
                  {link.linkType}
                </Badge>
              </div>

              {link.campaignName && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">
                    CAMPAIGN
                  </p>
                  <a
                    href={`/dashboard/campaigns/${link.campaignId}`}
                    className="text-primary-600 hover:text-primary-700 text-sm"
                  >
                    {link.campaignName}
                  </a>
                </div>
              )}

              {link.expiresAt && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">
                    EXPIRES
                  </p>
                  <p className="text-sm text-slate-900">
                    {formatDate(link.expiresAt)}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">
                  CREATED
                </p>
                <p className="text-sm text-slate-900">
                  {formatRelativeTime(link.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Device Breakdown */}
          {analytics && Object.keys(analytics.devices).length > 0 && (
            <div className="bg-card rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Devices
              </h3>
              <div className="space-y-3">
                {Object.entries(analytics.devices).map(([device, count]) => (
                  <div key={device}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-slate-600 capitalize">
                        {device}
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {count}
                      </p>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full"
                        style={{
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
          <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Link Parameters
            </h3>
            <div className="space-y-3">
              {Object.entries(link.params).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {key}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
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
            <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Platform Overrides
              </h3>
              <div className="space-y-4">
                {link.platformOverrides.android && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-semibold text-blue-900 mb-2">
                      Android
                    </p>
                    <p className="text-xs text-blue-700 break-all">
                      {link.platformOverrides.android.url}
                    </p>
                    {link.platformOverrides.android.fallback && (
                      <p className="text-xs text-blue-600 mt-2">
                        Fallback: {link.platformOverrides.android.fallback}
                      </p>
                    )}
                  </div>
                )}

                {link.platformOverrides.ios && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm font-semibold text-purple-900 mb-2">
                      iOS
                    </p>
                    <p className="text-xs text-purple-700 break-all">
                      {link.platformOverrides.ios.url}
                    </p>
                    {link.platformOverrides.ios.fallback && (
                      <p className="text-xs text-purple-600 mt-2">
                        Fallback: {link.platformOverrides.ios.fallback}
                      </p>
                    )}
                  </div>
                )}

                {link.platformOverrides.web && (
                  <div className="p-4 bg-slate-100 border border-slate-300 rounded-lg">
                    <p className="text-sm font-semibold text-slate-900 mb-2">
                      Web
                    </p>
                    <p className="text-xs text-slate-700 break-all">
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
            <div className="bg-card rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
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
                        className="flex-1 bg-primary-200 rounded-t hover:bg-primary-300 transition group relative"
                        style={{ height: `${height}%`, minHeight: '4px' }}
                        title={`${item.date}: ${item.clicks} clicks`}
                      >
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-0 bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                          {item.clicks}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">
                  No click data available
                </p>
              )}
            </div>

            {/* Top Countries */}
            {analytics.countries && analytics.countries.length > 0 && (
              <div className="bg-card rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  Top Countries
                </h3>
                <div className="space-y-3">
                  {analytics.countries.slice(0, 5).map((item) => (
                    <div key={item.country}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm text-slate-600">
                          {item.country}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.clicks}
                        </p>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full"
                          style={{
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
          <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Top Browsers
            </h3>
            <div className="space-y-3">
              {analytics.browsers.slice(0, 5).map((item) => (
                <div key={item.browser}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-slate-600">{item.browser}</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.clicks}
                    </p>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full"
                      style={{
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
        <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-500">
          <p>Updated {formatRelativeTime(link.updatedAt)}</p>
        </div>
      </div>
    </div>
  );
}
