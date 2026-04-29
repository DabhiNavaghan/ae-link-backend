'use client';

import { useState, useEffect } from 'react';
import { smartLinkApi } from '@/lib/api';
import { IApp } from '@/types';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Link from 'next/link';

export default function AppDetailPage({ params }: { params: { id: string } }) {
  const [app, setApp] = useState<IApp | null>(null);
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

      {/* App ID for link creation */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Using this App in Links</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          When creating a deep link, select this app so the link knows which app store URLs to use for redirects.
          The App ID below can also be used directly in the API.
        </p>
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', borderWidth: '1px' }}>
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
