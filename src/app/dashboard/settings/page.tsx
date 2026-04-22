'use client';

import React, { useEffect, useState } from 'react';

interface TenantSettings {
  name: string;
  domain: string;
  defaultFallbackUrl?: string;
  apiKey?: string;
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
    fingerprintTtlHours: 24,
    matchThreshold: 70,
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
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) {
        setMessage({ type: 'error', text: 'API key not found' });
        setLoading(false);
        return;
      }

      const response = await fetch('/api/v1/tenants', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        const tenant = data.data[0];
        setSettings({
          name: tenant.name || '',
          domain: tenant.domain || '',
          defaultFallbackUrl: tenant.settings?.defaultFallbackUrl || '',
          apiKey: apiKey,
          android: tenant.app?.android || {
            package: '',
            sha256: '',
            storeUrl: '',
          },
          ios: tenant.app?.ios || {
            bundleId: '',
            teamId: '',
            appId: '',
            storeUrl: '',
          },
          fingerprintTtlHours: tenant.settings?.fingerprintTtlHours || 24,
          matchThreshold: tenant.settings?.matchThreshold || 70,
        });
      }
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
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) throw new Error('API key not found');

      const payload = {
        name: settings.name,
        settings: {
          defaultFallbackUrl: settings.defaultFallbackUrl,
          fingerprintTtlHours: settings.fingerprintTtlHours,
          matchThreshold: settings.matchThreshold,
        },
        app: {
          android: settings.android,
          ios: settings.ios,
        },
      };

      const response = await fetch('/api/v1/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save settings');

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Copied to clipboard' });
    setTimeout(() => setMessage(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="text-slate-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Settings</h1>
          <p className="text-slate-600">Configure your AE-LINK dashboard</p>
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
          {['general', 'app', 'deep-link', 'integration', 'danger'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
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
                <p className="text-xs text-slate-500 mt-1">Display only</p>
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
                  placeholder="https://example.com"
                />
                <p className="text-xs text-slate-500 mt-1">
                  URL to redirect to when app is not installed
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
                    className="input-base flex-1 bg-slate-50 text-slate-600 cursor-not-allowed"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => copyToClipboard(settings.apiKey || '')}
                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* App Configuration */}
          {activeTab === 'app' && (
            <div className="space-y-8">
              {/* Android */}
              <div className="border-b border-slate-200 pb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Android</h3>
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
                      placeholder="com.allevents.mobile"
                    />
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
                      placeholder="AA:BB:CC:DD:..."
                      rows={3}
                    />
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
                      placeholder="https://play.google.com/store/apps/details?id=..."
                    />
                  </div>
                </div>
              </div>

              {/* iOS */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">iOS</h3>
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
                      placeholder="com.allevents.mobile"
                    />
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
                        placeholder="ABCD123456"
                      />
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
                        placeholder="123456789"
                      />
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
                      placeholder="https://apps.apple.com/app/..."
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
                  How long to keep device fingerprints (1-168 hours). Default: 24 hours.
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
                <h3 className="text-lg font-semibold text-slate-900 mb-4">SDK Integration</h3>
                <div className="bg-slate-50 p-4 rounded-lg overflow-x-auto">
                  <p className="text-sm text-slate-600 mb-2">Flutter:</p>
                  <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap">
{`import 'package:aelink_flutter/aelink.dart';

final aelink = AELink(
  apiKey: '${settings.apiKey}',
  domain: '${settings.domain}',
);

// Handle deep link
aelink.handleDeepLink(url);`}
                  </pre>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">API Usage</h3>
                <div className="bg-slate-50 p-4 rounded-lg overflow-x-auto">
                  <p className="text-sm text-slate-600 mb-2">Create a short link:</p>
                  <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap">
{`curl -X POST https://${settings.domain}/api/v1/links \\
  -H "Authorization: Bearer ${settings.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "campaignId": "...",
    "linkType": "event",
    "fallbackUrl": "https://example.com"
  }'`}
                  </pre>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-900">
                  <strong>Webhooks:</strong> Coming soon. Receive real-time notifications
                  for clicks and conversions.
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
                  Permanently delete all short links and associated data.
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
        {activeTab !== 'danger' && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={fetchSettings}
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
    </div>
  );
};

export default SettingsPage;
