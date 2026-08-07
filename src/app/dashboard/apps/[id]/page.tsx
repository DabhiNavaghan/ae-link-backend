'use client';

import { useState, useEffect } from 'react';
import { smartLinkApi } from '@/lib/api';
import { IApp, AppVisitAnalytics } from '@/types';
import { safeHttpUrl } from '@/lib/utils/url';
import AppIcon from '@/components/AppIcon';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Link from 'next/link';

/** Matches the ranges offered on the Analytics page, so the two agree. */
const VISIT_RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

export default function AppDetailPage({ params }: { params: { id: string } }) {
  const [app, setApp] = useState<IApp | null>(null);
  const [visits, setVisits] = useState<AppVisitAnalytics | null>(null);
  const [visitDays, setVisitDays] = useState(30);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApp = async () => {
      try {
        setLoading(true);
        const result = await smartLinkApi.getApp(params.id);
        setApp(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load app details');
      } finally {
        setLoading(false);
      }
    };
    fetchApp();
  }, [params.id]);

  // Re-fetched on its own whenever the range changes, so switching 7/30/90 days
  // never re-loads the app config above it.
  useEffect(() => {
    setVisitsLoading(true);
    // Traffic is supplementary — a failure here should not take the page down.
    smartLinkApi
      .getAppAnalytics(params.id, visitDays)
      .then(setVisits)
      .catch(() => setVisits(null))
      .finally(() => setVisitsLoading(false));
  }, [params.id, visitDays]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 rounded animate-pulse w-1/3" style={{ backgroundColor: 'var(--color-bg-hover)' }} />
        <div className="grid grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card p-6 h-48 animate-pulse" style={{ backgroundColor: 'var(--color-bg-hover)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="card p-8 text-center" style={{ backgroundColor: 'rgba(255, 61, 138, 0.12)', borderColor: 'var(--color-danger)' }}>
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-danger)' }}>Error Loading App</h3>
        <p className="mb-4" style={{ color: 'var(--color-danger)' }}>{error}</p>
        <Link href="/dashboard/apps">
          <Button variant="primary">Back to Apps</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{app.name}</h1>
          <p className="text-xs mt-1 font-mono" style={{ color: 'var(--color-text-tertiary)' }}>ID: {String((app as any)._id)}</p>
        </div>
        <Link href="/dashboard/apps">
          <Button variant="ghost">Back to Apps</Button>
        </Link>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        <Badge status={app.isActive ? 'active' : 'archived'}>
          {app.isActive ? 'Active' : 'Inactive'}
        </Badge>
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Created {new Date(app.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Platform Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Android */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.523 15.341c-.5 0-.902-.402-.902-.902s.402-.902.902-.902.901.402.901.902-.401.902-.901.902zm-11.046 0c-.5 0-.902-.402-.902-.902s.402-.902.902-.902.902.402.902.902-.402.902-.902.902zm11.4-6.052l1.997-3.46a.416.416 0 00-.152-.567.416.416 0 00-.568.152L17.12 8.93c-1.46-.67-3.1-1.044-5.12-1.044s-3.66.374-5.12 1.044L4.846 5.414a.416.416 0 00-.568-.152.416.416 0 00-.152.567l1.997 3.46C2.688 11.186.343 14.654 0 18.76h24c-.343-4.106-2.688-7.574-6.123-9.471z" />
            </svg>
            Android
          </h2>
          <div className="space-y-3">
            {app.android?.package || app.android?.sha256 || app.android?.storeUrl ? (
              <>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Package Name</p>
                  <p className="mt-1 font-mono text-sm" style={{ color: 'var(--color-text)' }}>{app.android?.package || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>SHA256 Fingerprint</p>
                  <code className="text-xs p-2 rounded mt-1 block overflow-x-auto" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}>
                    {app.android?.sha256 || 'Not set'}
                  </code>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Store URL</p>
                  {app.android?.storeUrl ? (
                    <a href={app.android.storeUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sm mt-1 break-all" style={{ color: 'var(--color-primary)' }}>
                      {app.android.storeUrl}
                    </a>
                  ) : (
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Not set</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-sm italic">Not configured</p>
            )}
          </div>
        </div>

        {/* iOS */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <svg className="w-5 h-5 text-slate-700" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            iOS
          </h2>
          <div className="space-y-3">
            {app.ios?.bundleId || app.ios?.teamId || app.ios?.appId || app.ios?.storeUrl ? (
              <>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Bundle ID</p>
                  <p className="mt-1 font-mono text-sm" style={{ color: 'var(--color-text)' }}>{app.ios?.bundleId || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Team ID</p>
                  <p className="mt-1 font-mono text-sm" style={{ color: 'var(--color-text)' }}>{app.ios?.teamId || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>App ID</p>
                  <p className="mt-1 font-mono text-sm" style={{ color: 'var(--color-text)' }}>{app.ios?.appId || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Store URL</p>
                  {app.ios?.storeUrl ? (
                    <a href={app.ios.storeUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sm mt-1 break-all" style={{ color: 'var(--color-primary)' }}>
                      {app.ios.storeUrl}
                    </a>
                  ) : (
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Not set</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-sm italic">Not configured</p>
            )}
          </div>
        </div>
      </div>

      {/* Store page traffic — visits to /apps/:slug/store. These belong to the
          app rather than to a link, so they appear in no click figure. */}
      <div className="card p-6">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Store Page</h2>
          <div style={{ display: 'flex', border: '1px solid var(--color-border)' }}>
            {VISIT_RANGES.map((r, i) => (
              <button
                key={r.days}
                onClick={() => setVisitDays(r.days)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, padding: '5px 12px',
                  border: 'none', cursor: 'pointer',
                  background: visitDays === r.days ? 'var(--color-primary)' : 'var(--color-bg-card)',
                  color: visitDays === r.days ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                  borderRight: i < VISIT_RANGES.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          Visits to this app&rsquo;s public store link, and which store they were handed off to.
        </p>

        {visitsLoading ? (
          <p className="text-sm italic" style={{ color: 'var(--color-text-tertiary)' }}>
            Loading traffic…
          </p>
        ) : !visits ? (
          <p className="text-sm italic" style={{ color: 'var(--color-text-tertiary)' }}>
            Traffic could not be loaded.
          </p>
        ) : visits.totalVisits === 0 ? (
          <p className="text-sm italic" style={{ color: 'var(--color-text-tertiary)' }}>
            No visits in the last {visitDays} days.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'visits', value: visits.totalVisits },
                { label: 'unique', value: visits.uniqueVisits },
                { label: '→ app store', value: visits.sentTo.ios },
                { label: '→ play store', value: visits.sentTo.android },
              ].map((s) => (
                <div key={s.label} className="p-3" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                  <div className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>{s.value.toLocaleString()}</div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>by platform</p>
                {([
                  ['ios', visits.byOS.ios],
                  ['android', visits.byOS.android],
                  ['other / desktop', visits.byOS.other],
                ] as Array<[string, number]>).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-sm py-1">
                    <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                    <span className="font-mono" style={{ color: 'var(--color-text)' }}>{value.toLocaleString()}</span>
                  </div>
                ))}
                {/* Nobody sent to a store means the page had no store URL to
                    use, or the visitor stayed to choose. Worth seeing. */}
                {visits.sentTo.none > 0 && (
                  <div className="flex items-center justify-between text-sm py-1">
                    <span style={{ color: 'var(--color-text-tertiary)' }}>stayed on the page</span>
                    <span className="font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{visits.sentTo.none.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>top sources</p>
                {visits.topSources.length === 0 ? (
                  <p className="text-sm italic" style={{ color: 'var(--color-text-tertiary)' }}>no utm_source on these visits</p>
                ) : (
                  visits.topSources.slice(0, 5).map((s) => (
                    <div key={s.source} className="flex items-center justify-between text-sm py-1">
                      <span className="truncate mr-3" style={{ color: 'var(--color-text-secondary)' }}>{s.source}</span>
                      <span className="font-mono" style={{ color: 'var(--color-text)' }}>{s.visits.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* App Info — the copy shown on the app info interstitial */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--color-text)' }}>App Info</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          Shown when a link has app store navigation switched off and no web destination to open.
        </p>
        {app.info?.tagline || app.info?.description || app.info?.iconUrl || app.info?.marketingUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <AppIcon
                appId={String((app as any)._id)}
                hasIcon={Boolean(safeHttpUrl(app.info?.iconUrl))}
                name={app.name}
                size={48}
                className="rounded-xl object-cover shrink-0"
              />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{app.name}</p>
                {app.info?.tagline && (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{app.info.tagline}</p>
                )}
              </div>
            </div>
            {app.info?.description && (
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Description</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text)' }}>{app.info.description}</p>
              </div>
            )}
            {app.info?.marketingUrl && (
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Marketing Page</p>
                {safeHttpUrl(app.info.marketingUrl) ? (
                  <a href={safeHttpUrl(app.info.marketingUrl)} target="_blank" rel="noopener noreferrer"
                    className="text-sm mt-1 break-all" style={{ color: 'var(--color-primary)' }}>
                    {app.info.marketingUrl}
                  </a>
                ) : (
                  // Saved before the http(s) rule existed — show it as inert text
                  // rather than a link that would run whatever scheme it carries.
                  <p className="text-sm mt-1 break-all" style={{ color: 'var(--color-warning)' }}>
                    {app.info.marketingUrl} — not a valid http(s) URL, ignored
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic" style={{ color: 'var(--color-text-tertiary)' }}>
            Not configured — the info page falls back to the app name and store links.
          </p>
        )}
      </div>

      {/* App ID for link creation */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Using this App in Links</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          When creating a deep link, select this app so the link knows which app store URLs to use for redirects.
          The App ID below can also be used directly in the API.
        </p>
        <div className="flex items-center gap-3 p-3" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderWidth: '1px' }}>
          <code className="font-mono text-sm flex-1 select-all" style={{ color: 'var(--color-text)' }}>
            {String((app as any)._id)}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(String((app as any)._id));
            }}
            className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}
