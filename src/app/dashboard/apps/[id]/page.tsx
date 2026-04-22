'use client';

import { useState, useEffect } from 'react';
import { aeLinkApi } from '@/lib/api';
import { ITenant } from '@/types';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Link from 'next/link';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-primary-600 hover:text-primary-700 text-sm font-medium transition"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-6 bg-gradient-to-br from-primary-50 to-white">
      <p className="text-slate-600 text-sm font-medium mb-2">{label}</p>
      <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
    </div>
  );
}

export default function AppDetailPage({ params }: { params: { id: string } }) {
  const [app, setApp] = useState<ITenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const handleRegenerateKey = async () => {
    setRegenerating(true);
    try {
      const result = await aeLinkApi.regenerateApiKey();
      // Update the local app state with new key
      if (app) {
        setApp({ ...app, apiKey: result.apiKey } as ITenant);
      }
      setShowApiKey(true);
      setShowRegenerateConfirm(false);
      alert('API key regenerated successfully! The new key is now shown above.');
    } catch (err) {
      alert('Failed to regenerate API key. Please try again.');
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    const fetchApp = async () => {
      try {
        setLoading(true);
        const tenant = await aeLinkApi.getTenant();
        setApp(tenant);
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
        <div className="h-10 bg-slate-200 rounded animate-pulse w-1/3"></div>
        <div className="grid grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-6 h-24 animate-pulse bg-slate-100"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="card bg-danger-50 border-danger-200 p-8 text-center">
        <h3 className="text-lg font-semibold text-danger-900 mb-2">Error Loading App</h3>
        <p className="text-danger-700 mb-4">{error}</p>
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
          <h1 className="text-3xl font-bold text-slate-900">{app.name}</h1>
          <p className="text-slate-600 mt-1">{app.domain}</p>
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
        <span className="text-sm text-slate-600">
          Created {new Date(app.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-6">
        <StatCard label="Total Links" value={0} />
        <StatCard label="Total Clicks" value={0} />
        <StatCard label="Total Conversions" value={0} />
      </div>

      {/* API Configuration */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">API Configuration</h2>

        <div className="space-y-4">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">API Key</label>
            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
              {showApiKey ? (
                <>
                  <code className="font-mono text-sm flex-1 break-all text-slate-900">
                    {app.apiKey}
                  </code>
                  <CopyButton text={app.apiKey} />
                </>
              ) : (
                <>
                  <code className="text-slate-400 font-mono">••••••••••••••••••••••••••••••••</code>
                  <button
                    onClick={() => setShowApiKey(true)}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium whitespace-nowrap"
                  >
                    Reveal
                  </button>
                </>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Use this key to authenticate API requests. Keep it secret.
            </p>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Base URL</label>
            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <code className="font-mono text-sm flex-1 text-slate-900">
                https://api.aelink.io/v1
              </code>
              <CopyButton text="https://api.aelink.io/v1" />
            </div>
          </div>

          {/* Regenerate Key Button */}
          <div className="pt-4 border-t border-slate-200">
            {!showRegenerateConfirm ? (
              <div>
                <Button variant="danger" size="md" onClick={() => setShowRegenerateConfirm(true)}>
                  Regenerate API Key
                </Button>
                <p className="text-xs text-slate-500 mt-2">
                  This will invalidate the current API key. Update your app and integrations after regenerating.
                </p>
              </div>
            ) : (
              <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-danger-800 mb-2">Are you sure?</p>
                <p className="text-sm text-danger-700 mb-4">
                  The current API key will stop working immediately. Your Flutter SDK and any integrations will need the new key.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleRegenerateKey}
                    isLoading={regenerating}
                  >
                    Yes, Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRegenerateConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Platform Configuration */}
      <div className="grid grid-cols-2 gap-6">
        {/* Android */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Android Configuration</h2>
          <div className="space-y-3">
            {app.app?.android ? (
              <>
                <div>
                  <p className="text-sm font-medium text-slate-700">Package Name</p>
                  <p className="text-slate-900 mt-1">{app.app.android.package}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">SHA256 Fingerprint</p>
                  <code className="text-xs bg-slate-100 p-2 rounded mt-1 block overflow-x-auto">
                    {app.app.android.sha256}
                  </code>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Store URL</p>
                  <a
                    href={app.app.android.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700 text-sm mt-1 break-all"
                  >
                    {app.app.android.storeUrl}
                  </a>
                </div>
              </>
            ) : (
              <p className="text-slate-600">Not configured</p>
            )}
          </div>
        </div>

        {/* iOS */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">iOS Configuration</h2>
          <div className="space-y-3">
            {app.app?.ios ? (
              <>
                <div>
                  <p className="text-sm font-medium text-slate-700">Bundle ID</p>
                  <p className="text-slate-900 mt-1">{app.app.ios.bundleId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Team ID</p>
                  <p className="text-slate-900 mt-1">{app.app.ios.teamId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">App ID</p>
                  <p className="text-slate-900 mt-1">{app.app.ios.appId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Store URL</p>
                  <a
                    href={app.app.ios.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700 text-sm mt-1 break-all"
                  >
                    {app.app.ios.storeUrl}
                  </a>
                </div>
              </>
            ) : (
              <p className="text-slate-600">Not configured</p>
            )}
          </div>
        </div>
      </div>

      {/* Integration Guide */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Flutter SDK Integration</h2>
        <p className="text-slate-600 mb-4">
          Initialize the AE-LINK SDK in your Flutter app with the following code:
        </p>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
{`import 'package:ae_link_flutter/ae_link.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await AELink.initialize(
    apiKey: '${app.apiKey}',
    domain: '${app.domain}',
  );
  
  runApp(MyApp());
}`}
        </pre>
      </div>

      {/* Settings */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Settings</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Fingerprint TTL</p>
              <p className="text-slate-900 font-semibold">
                {app.settings?.fingerprintTtlHours || 72} hours
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Match Threshold</p>
              <p className="text-slate-900 font-semibold">
                {app.settings?.matchThreshold || 80}%
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Default Fallback</p>
              <p className="text-slate-900 font-semibold text-sm truncate">
                {app.settings?.defaultFallbackUrl || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
