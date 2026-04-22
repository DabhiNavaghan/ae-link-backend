'use client';

import { useState, useEffect } from 'react';
import { aeLinkApi } from '@/lib/api';
import { ITenant, RegisterTenantDto, IAppConfig, ITenantSettings } from '@/types';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';

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

function AppCard({
  app,
  onEdit,
  onDelete,
}: {
  app: ITenant;
  onEdit: (app: ITenant) => void;
  onDelete: (app: ITenant) => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{app.name}</h3>
          <p className="text-sm text-slate-600 mt-1">{app.domain}</p>
        </div>
        <Badge status={app.isActive ? 'active' : 'archived'}>
          {app.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="space-y-4 mb-6 border-t border-b border-slate-200 py-4">
        {/* Android Info */}
        {app.app?.android && (
          <div className="text-sm">
            <p className="font-semibold text-slate-700 mb-1">Android</p>
            <p className="text-slate-600">Package: {app.app.android.package}</p>
            <p className="text-slate-600 text-xs">SHA256: {app.app.android.sha256}</p>
          </div>
        )}

        {/* iOS Info */}
        {app.app?.ios && (
          <div className="text-sm">
            <p className="font-semibold text-slate-700 mb-1">iOS</p>
            <p className="text-slate-600">Bundle ID: {app.app.ios.bundleId}</p>
            <p className="text-slate-600">Team ID: {app.app.ios.teamId}</p>
          </div>
        )}

        {/* API Key */}
        <div className="text-sm bg-slate-50 p-3 rounded-lg">
          <p className="font-semibold text-slate-700 mb-2">API Key</p>
          {showApiKey ? (
            <div className="flex items-center gap-2">
              <code className="bg-white px-2 py-1 rounded text-xs font-mono border border-slate-200 flex-1 overflow-x-auto">
                {app.apiKey}
              </code>
              <CopyButton text={app.apiKey} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <code className="text-slate-400">••••••••••••••••</code>
              <button
                onClick={() => setShowApiKey(true)}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Reveal
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(app)}
          className="flex-1"
        >
          Edit
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(app)}
          className="flex-1"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

function AddAppForm({ onSuccess }: { onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<RegisterTenantDto>({
    name: '',
    domain: '',
    app: {
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
    },
    settings: {
      fingerprintTtlHours: 72,
      matchThreshold: 80,
      defaultFallbackUrl: '',
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    path: string
  ) => {
    const value = e.target.value;
    const keys = path.split('.');
    let obj: any = formData;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!obj[key]) obj[key] = {};
      obj = obj[key];
    }

    obj[keys[keys.length - 1]] = value;
    setFormData({ ...formData });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      await aeLinkApi.registerTenant(formData);

      setIsOpen(false);
      setFormData({
        name: '',
        domain: '',
        app: {
          android: { package: '', sha256: '', storeUrl: '' },
          ios: { bundleId: '', teamId: '', appId: '', storeUrl: '' },
        },
        settings: {
          fingerprintTtlHours: 72,
          matchThreshold: 80,
          defaultFallbackUrl: '',
        },
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create app');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button variant="primary" size="lg" onClick={() => setIsOpen(true)}>
        Add New App
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Add New App</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Basic Information</h3>
            <Input
              label="App Name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange(e, 'name')}
              placeholder="e.g., AllEvents Mobile App"
              required
            />
            <Input
              label="Domain"
              type="text"
              value={formData.domain}
              onChange={(e) => handleChange(e, 'domain')}
              placeholder="e.g., allevents.in"
              required
            />
          </div>

          {/* Android */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Android Configuration</h3>
            <Input
              label="Package Name"
              type="text"
              value={formData.app?.android?.package || ''}
              onChange={(e) => handleChange(e, 'app.android.package')}
              placeholder="e.g., com.allevents.mobile"
            />
            <Input
              label="SHA256 Fingerprint"
              type="text"
              value={formData.app?.android?.sha256 || ''}
              onChange={(e) => handleChange(e, 'app.android.sha256')}
              placeholder="Your app's certificate SHA256"
            />
            <Input
              label="Play Store URL"
              type="text"
              value={formData.app?.android?.storeUrl || ''}
              onChange={(e) => handleChange(e, 'app.android.storeUrl')}
              placeholder="https://play.google.com/store/apps/details?id=..."
            />
          </div>

          {/* iOS */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">iOS Configuration</h3>
            <Input
              label="Bundle ID"
              type="text"
              value={formData.app?.ios?.bundleId || ''}
              onChange={(e) => handleChange(e, 'app.ios.bundleId')}
              placeholder="e.g., com.allevents.mobile"
            />
            <Input
              label="Team ID"
              type="text"
              value={formData.app?.ios?.teamId || ''}
              onChange={(e) => handleChange(e, 'app.ios.teamId')}
              placeholder="Your Apple Team ID"
            />
            <Input
              label="App ID"
              type="text"
              value={formData.app?.ios?.appId || ''}
              onChange={(e) => handleChange(e, 'app.ios.appId')}
              placeholder="Your App ID from Apple Connect"
            />
            <Input
              label="App Store URL"
              type="text"
              value={formData.app?.ios?.storeUrl || ''}
              onChange={(e) => handleChange(e, 'app.ios.storeUrl')}
              placeholder="https://apps.apple.com/app/id..."
            />
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Settings</h3>
            <Input
              label="Fingerprint TTL (hours)"
              type="number"
              value={formData.settings?.fingerprintTtlHours || 72}
              onChange={(e) =>
                handleChange({ ...e, target: { ...e.target, value: e.target.value } } as any, 'settings.fingerprintTtlHours')
              }
              min="1"
              max="720"
            />
            <Input
              label="Match Threshold (1-100)"
              type="number"
              value={formData.settings?.matchThreshold || 80}
              onChange={(e) =>
                handleChange({ ...e, target: { ...e.target, value: e.target.value } } as any, 'settings.matchThreshold')
              }
              min="1"
              max="100"
            />
            <Input
              label="Default Fallback URL"
              type="text"
              value={formData.settings?.defaultFallbackUrl || ''}
              onChange={(e) => handleChange(e, 'settings.defaultFallbackUrl')}
              placeholder="https://allevents.in"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setIsOpen(false)}
              type="button"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              type="submit"
              isLoading={loading}
              className="flex-1"
            >
              Create App
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AppsPage() {
  const [apps, setApps] = useState<ITenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        setLoading(true);
        const tenant = await aeLinkApi.getTenant();
        setApps([tenant]);
      } catch (err: any) {
        if (err.status === 401) {
          setError('No apps registered. Create your first app to get started.');
        } else {
          setError(err.message || 'Failed to load apps');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, [refreshKey]);

  const handleDelete = async (app: ITenant) => {
    if (confirm(`Are you sure you want to delete ${app.name}?`)) {
      try {
        // Will implement delete endpoint
        alert('Delete functionality coming soon');
      } catch (err) {
        alert('Failed to delete app');
      }
    }
  };

  const handleEdit = (app: ITenant) => {
    alert('Edit functionality coming soon');
  };

  const handleSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Apps Management</h1>
          <p className="text-slate-600 mt-1">
            Manage your registered apps and their configurations
          </p>
        </div>
        <AddAppForm onSuccess={handleSuccess} />
      </div>

      {error && !loading && apps.length === 0 && (
        <div className="card bg-warning-50 border-warning-200 p-8 text-center">
          <h3 className="text-lg font-semibold text-warning-900 mb-2">Get Started</h3>
          <p className="text-warning-700 mb-4">{error}</p>
          <p className="text-warning-600 text-sm">
            Register your app to start creating deep links and tracking analytics.
          </p>
        </div>
      )}

      {/* Apps Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card p-6 space-y-3">
              <div className="h-6 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4"></div>
              <div className="pt-4 space-y-2">
                <div className="h-4 bg-slate-100 rounded animate-pulse"></div>
                <div className="h-4 bg-slate-100 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      ) : apps.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {apps.map((app) => (
            <AppCard
              key={String(app._id)}
              app={app}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
