'use client';

import React, { useEffect, useState } from 'react';
import { smartLinkApi } from '@/lib/api';

interface TenantSettings {
  name: string;
  domain: string;
  defaultFallbackUrl?: string;
  apiKey?: string;
  tenantId?: string;
  android?: {
    package: string;
    sha256: string;
    storeUrl: string;
  };
  ios?: {
    bundleId: string;
    teamId: string;
    appId: string;
    storeUrl: string;
  };
  fingerprintTtlHours: number;
  matchThreshold: number;
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<TenantSettings>({
    name: '',
    domain: '',
    fingerprintTtlHours: 72,
    matchThreshold: 60,
    android: {
      package: '',
      sha256: '',
      storeUrl: '',
    },
    ios: {
      bundleId: '',
      teamId: '',
      appId: '',
      storeUrl: '',
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'app' | 'deep-link' | 'integration' | 'danger'>('general');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const tenant = await smartLinkApi.getTenant();
      setSettings({
        name: tenant.name || '',
        domain: tenant.domain || '',
        defaultFallbackUrl: (tenant as any).settings?.defaultFallbackUrl || '',
        apiKey: smartLinkApi.getApiKey() || '',
        tenantId: (tenant as any)._id || (tenant as any).tenantId || '',
        android: (tenant as any).app?.android || {
          package: '',
          sha256: '',
          storeUrl: '',
        },
        ios: (tenant as any).app?.ios || {
          bundleId: '',
          teamId: '',
          appId: '',
          storeUrl: '',
        },
        fingerprintTtlHours: (tenant as any).settings?.fingerprintTtlHours || 72,
        matchThreshold: (tenant as any).settings?.matchThreshold || 60,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to load settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tenantId = settings.tenantId;
      if (!tenantId) throw new Error('Tenant ID not found');

      await smartLinkApi.updateTenant(tenantId, {
        name: settings.name,
        settings: {
          defaultFallbackUrl: settings.defaultFallbackUrl || '',
          fingerprintTtlHours: settings.fingerprintTtlHours,
          matchThreshold: settings.matchThreshold,
        },
        app: {
          android: settings.android,
          ios: settings.ios,
        },
      } as any);

      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateKey = async () => {
    try {
      const result = await smartLinkApi.regenerateApiKey();
      setSettings({ ...settings, apiKey: result.apiKey });
      setMessage({ type: 'success', text: 'API key regenerated. The old key no longer works.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to regenerate key',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Copied to clipboard' });
    setTimeout(() => setMessage(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-3"></div>
          <p className="text-slate-500 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Settings</h1>
        <p className="text-slate-600">Configure your SmartLink app and deep linking preferences.</p>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`card p-4 mb-6 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-danger-50 border-danger-200 text-danger-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="card border-b border-slate-200 mb-6 flex overflow-x-auto">
        {[
          { key: 'general', label: 'General' },
          { key: 'app', label: 'App Config' },
          { key: 'deep-link', label: 'Deep Link' },
          { key: 'integration', label: 'Integration' },
          { key: 'danger', label: 'Danger zone' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card p-6">
        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                App Name
              </label>
              <input
                type="text"
                value={settings.name}
                onChange={e => setSettings({ ...settings, name: e.target.value })}
                className="input-base"
                placeholder="AllEvents"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Domain
              </label>
              <input
                type="text"
                value={settings.domain}
                disabled
                className="input-base bg-slate-50 text-slate-600 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">Domain cannot be changed after registration.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Default Fallback URL
              </label>
              <input
                type="url"
                value={settings.defaultFallbackUrl || ''}
                onChange={e =>
                  setSettings({ ...settings, defaultFallbackUrl: e.target.value })
                }
                className="input-base"
                placeholder="https://allevents.in"
              />
              <p className="text-xs text-slate-500 mt-1">
                Where to redirect users when the app is not installed and no store URL is configured.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                API Key
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.apiKey || ''}
                  disabled
                  className="input-base flex-1 bg-slate-50 text-slate-600 cursor-not-allowed font-mono text-sm"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors text-sm"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => copyToClipboard(settings.apiKey || '')}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  Copy
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleRegenerateKey}
                  className="text-sm text-danger-600 hover:text-danger-700 font-medium"
                >
                  Regenerate API Key
                </button>
                <span className="text-xs text-slate-400">
                  Warning: this will invalidate the current key immediately.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* App Configuration */}
        {activeTab === 'app' && (
          <div className="space-y-8">
            {/* Android */}
            <div className="border-b border-slate-200 pb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.523 15.341c-.5 0-.902-.402-.902-.902s.402-.902.902-.902.901.402.901.902-.401.902-.901.902zm-11.046 0c-.5 0-.902-.402-.902-.902s.402-.902.902-.902.902.402.902.902-.402.902-.902.902zm11.4-6.052l1.997-3.46a.416.416 0 00-.152-.567.416.416 0 00-.568.152L17.12 8.93c-1.46-.67-3.1-1.044-5.12-1.044s-3.66.374-5.12 1.044L4.846 5.414a.416.416 0 00-.568-.152.416.416 0 00-.152.567l1.997 3.46C2.688 11.186.343 14.654 0 18.76h24c-.343-4.106-2.688-7.574-6.123-9.471z" />
                </svg>
                Android
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Package Name
                  </label>
                  <input
                    type="text"
                    value={settings.android?.package || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        android: { ...settings.android!, package: e.target.value },
                      })
                    }
                    className="input-base"
                    placeholder="com.amitech.allevents"
                  />
                  <p className="text-xs text-slate-500 mt-1">Found in app/build.gradle under applicationId</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    SHA256 Certificate Fingerprint
                  </label>
                  <textarea
                    value={settings.android?.sha256 || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        android: { ...settings.android!, sha256: e.target.value },
                      })
                    }
                    className="input-base"
                    placeholder="23:C6:3D:23:1E:87:..."
                    rows={3}
                  />
                  <p className="text-xs text-slate-500 mt-1">Run ./gradlew signingReport in Android Studio terminal, or find in Google Play Console &gt; App Signing</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Play Store URL
                  </label>
                  <input
                    type="url"
                    value={settings.android?.storeUrl || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        android: { ...settings.android!, storeUrl: e.target.value },
                      })
                    }
                    className="input-base"
                    placeholder="https://play.google.com/store/apps/details?id=com.amitech.allevents"
                  />
                </div>
              </div>
            </div>

            {/* iOS */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-700" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                iOS
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bundle ID
                  </label>
                  <input
                    type="text"
                    value={settings.ios?.bundleId || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        ios: { ...settings.ios!, bundleId: e.target.value },
                      })
                    }
                    className="input-base"
                    placeholder="com.amitech.allevents"
                  />
                  <p className="text-xs text-slate-500 mt-1">Xcode &gt; Target &gt; General &gt; Bundle Identifier</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Team ID
                    </label>
                    <input
                      type="text"
                      value={settings.ios?.teamId || ''}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          ios: { ...settings.ios!, teamId: e.target.value },
                        })
                      }
                      className="input-base"
                      placeholder="53V82MSR2T"
                    />
                    <p className="text-xs text-slate-500 mt-1">developer.apple.com &gt; Membership</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      App Store ID
                    </label>
                    <input
                      type="text"
                      value={settings.ios?.appId || ''}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          ios: { ...settings.ios!, appId: e.target.value },
                        })
                      }
                      className="input-base"
                      placeholder="488116646"
                    />
                    <p className="text-xs text-slate-500 mt-1">App Store Connect &gt; General &gt; Apple ID</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    App Store URL
                  </label>
                  <input
                    type="url"
                    value={settings.ios?.storeUrl || ''}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        ios: { ...settings.ios!, storeUrl: e.target.value },
                      })
                    }
                    className="input-base"
                    placeholder="https://apps.apple.com/app/id488116646"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deep Link Settings */}
        {activeTab === 'deep-link' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Fingerprint TTL (hours)
              </label>
              <input
                type="number"
                value={settings.fingerprintTtlHours}
                onChange={e =>
                  setSettings({
                    ...settings,
                    fingerprintTtlHours: Math.min(
                      168,
                      Math.max(1, parseInt(e.target.value) || 1)
                    ),
                  })
                }
                min="1"
                max="168"
                className="input-base"
              />
              <p className="text-xs text-slate-500 mt-2">
                How long to keep device fingerprints for deferred link matching (1-168 hours). Default: 72 hours.
              </p>
              <div className="mt-4 p-3 bg-primary-50 rounded-lg">
                <p className="text-sm text-primary-900">
                  <strong>About fingerprints:</strong> Device fingerprints help match
                  deferred deep links by capturing device characteristics (IP, user agent,
                  screen properties). Longer TTLs allow more matches but use more storage.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Match Threshold (points)
              </label>
              <input
                type="range"
                value={settings.matchThreshold}
                onChange={e =>
                  setSettings({
                    ...settings,
                    matchThreshold: parseInt(e.target.value),
                  })
                }
                min="50"
                max="100"
                step="5"
                className="w-full"
              />
              <div className="mt-2 flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-900">
                  {settings.matchThreshold} points
                </span>
                <span className="text-xs text-slate-500">Recommended: 70</span>
              </div>
              <div className="mt-4 p-3 bg-primary-50 rounded-lg">
                <p className="text-sm text-primary-900">
                  <strong>Match threshold:</strong> Minimum confidence score required to
                  confirm a deferred link match. Lower values = more matches but less
                  accurate. Higher values = fewer matches but very reliable.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Integration Guide */}
        {activeTab === 'integration' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Flutter SDK</h3>
              <div className="bg-slate-50 p-4 rounded-lg overflow-x-auto">
                <p className="text-sm text-slate-600 mb-2">Create <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">lib/services/smartlink_service.dart</code> and initialize in main.dart:</p>
                <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap">
{`import 'package:smartlink/smartlink.dart';

// Create service with your API key
final smartLink = SmartLinkService(
  apiKey: '${settings.apiKey || 'YOUR_API_KEY'}',
  onDeepLink: (data) {
    // Route based on event ID, action, params
    if (data.eventId != null) {
      navigateTo('/event/\${data.eventId}');
    }
  },
);

// In main():
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final deferred = await aeLink.initialize();
  runApp(MyApp(initialLink: deferred));
}`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">API Usage</h3>
              <div className="bg-slate-50 p-4 rounded-lg overflow-x-auto">
                <p className="text-sm text-slate-600 mb-2">Create a deep link:</p>
                <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap">
{`curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://smartlink.vercel.app'}/api/v1/links \\
  -H "X-API-Key: ${settings.apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Summer Music Festival",
    "destinationUrl": "https://allevents.in/event/summer-fest",
    "deepLinkPath": "/event/summer-fest",
    "params": { "source": "email" }
  }'`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
              <p className="text-sm text-primary-900">
                <strong>Full documentation:</strong>{' '}
                <a href="/dashboard/docs" className="text-primary-600 hover:underline font-medium">
                  View the complete integration guide
                </a>{' '}
                for detailed setup instructions, SDK reference, and troubleshooting.
              </p>
            </div>
          </div>
        )}

        {/* Danger Zone */}
        {activeTab === 'danger' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 mb-6">
              These actions are irreversible. Please proceed with caution.
            </p>

            <div className="border border-danger-200 bg-danger-50 p-4 rounded-lg">
              <h4 className="font-semibold text-danger-900 mb-2">Reset Analytics Data</h4>
              <p className="text-sm text-danger-800 mb-4">
                Delete all clicks, conversions, and analytics data.
              </p>
              <button
                onClick={() => setShowDeleteConfirm('analytics')}
                className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg text-sm font-medium"
              >
                Reset Analytics
              </button>
            </div>

            <div className="border border-danger-200 bg-danger-50 p-4 rounded-lg">
              <h4 className="font-semibold text-danger-900 mb-2">Delete All Links</h4>
              <p className="text-sm text-danger-800 mb-4">
                Permanently delete all deep links and associated data.
              </p>
              <button
                onClick={() => setShowDeleteConfirm('links')}
                className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg text-sm font-medium"
              >
                Delete Links
              </button>
            </div>

            <div className="border border-danger-200 bg-danger-50 p-4 rounded-lg">
              <h4 className="font-semibold text-danger-900 mb-2">Delete Tenant Account</h4>
              <p className="text-sm text-danger-800 mb-4">
                Permanently delete this account and all associated data.
              </p>
              <button
                onClick={() => setShowDeleteConfirm('account')}
                className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg text-sm font-medium"
              >
                Delete Account
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      {activeTab !== 'danger' && activeTab !== 'integration' && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => { setLoading(true); fetchSettings(); }}
            className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card p-6 max-w-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Delete</h3>
            <p className="text-slate-600 mb-6">
              Are you sure? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(null);
                  setMessage({
                    type: 'success',
                    text: `${showDeleteConfirm} deletion would be processed`,
                  });
                }}
                className="flex-1 px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
