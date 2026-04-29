'use client';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { smartLinkApi } from '@/lib/api';
import { useDashboard } from '@/lib/context/DashboardContext';
import { CreateAppDto, IApp, UpdateAppDto } from '@/types';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/* ─── Icons ─── */
const AndroidIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.523 15.341c-.5 0-.902-.402-.902-.902s.402-.902.902-.902.901.402.901.902-.401.902-.901.902zm-11.046 0c-.5 0-.902-.402-.902-.902s.402-.902.902-.902.902.402.902.902-.402.902-.902.902zm11.4-6.052l1.997-3.46a.416.416 0 00-.152-.567.416.416 0 00-.568.152L17.12 8.93c-1.46-.67-3.1-1.044-5.12-1.044s-3.66.374-5.12 1.044L4.846 5.414a.416.416 0 00-.568-.152.416.416 0 00-.152.567l1.997 3.46C2.688 11.186.343 14.654 0 18.76h24c-.343-4.106-2.688-7.574-6.123-9.471z" />
  </svg>
);

const AppleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const PencilIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

/* ─── Copy Store Link ─── */
function AppCopyStoreLink({ app }: { app: IApp }) {
  const [copied, setCopied] = useState(false);
  const storeKey = (app as any).slug || String((app as any)._id);
  const storeUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/apps/${storeKey}/store`;
  const handleCopy = () => {
    navigator.clipboard.writeText(storeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title={storeUrl}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
      style={{
        border: '1px solid var(--color-primary)',
        color: copied ? '#000' : 'var(--color-primary)',
        background: copied ? 'var(--color-primary)' : 'transparent',
        borderRadius: 2,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.04em',
        cursor: 'pointer',
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 13, height: 13 }}>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
      {copied ? 'copied!' : 'copy store link'}
    </button>
  );
}

/* ─── App Card ─── */
function AppCard({
  app,
  onEdit,
  onDelete,
}: {
  app: IApp;
  onEdit: (app: IApp) => void;
  onDelete: (app: IApp) => void;
}) {
  const hasAndroid = app.android && (app.android.package || app.android.storeUrl);
  const hasIos = app.ios && (app.ios.bundleId || app.ios.storeUrl);

  return (
    <div className="card p-4 md:p-6 hover:shadow-md transition-shadow" style={{ backgroundColor: 'var(--color-bg-card)' }}>
      <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h3 className="text-base md:text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{app.name}</h3>
          <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
            ID: {String((app as any)._id).slice(-8)}
          </p>
        </div>
        <Badge status={app.isActive ? 'active' : 'archived'}>
          {app.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Platform badges */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {hasAndroid && (
          <span className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-medium" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)' }}>
            <AndroidIcon /> Android
          </span>
        )}
        {hasIos && (
          <span className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-medium" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
            <AppleIcon /> iOS
          </span>
        )}
        {!hasAndroid && !hasIos && (
          <span className="text-xs italic" style={{ color: 'var(--color-text-tertiary)' }}>No platforms configured</span>
        )}
      </div>

      {/* Platform details */}
      <div className="space-y-3 pt-4 mb-5" style={{ borderTopColor: 'var(--color-border)', borderTopWidth: '1px' }}>
        {hasAndroid && (
          <div className="text-sm">
            <p className="font-medium mb-1 flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-success)' }} /> Android
            </p>
            <div className="pl-3.5 space-y-0.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {app.android?.package && <p>Package: <span className="font-mono" style={{ color: 'var(--color-text)' }}>{app.android.package}</span></p>}
              {app.android?.sha256 && <p>SHA256: <span className="font-mono" style={{ color: 'var(--color-text)' }}>{app.android.sha256.substring(0, 20)}...</span></p>}
              {app.android?.storeUrl && <p>Store: <a href={app.android.storeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }} className="hover:underline">Play Store</a></p>}
            </div>
          </div>
        )}
        {hasIos && (
          <div className="text-sm">
            <p className="font-medium mb-1 flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-text-secondary)' }} /> iOS
            </p>
            <div className="pl-3.5 space-y-0.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {app.ios?.bundleId && <p>Bundle ID: <span className="font-mono" style={{ color: 'var(--color-text)' }}>{app.ios.bundleId}</span></p>}
              {app.ios?.teamId && <p>Team ID: <span className="font-mono" style={{ color: 'var(--color-text)' }}>{app.ios.teamId}</span></p>}
              {app.ios?.appId && <p>App ID: <span className="font-mono" style={{ color: 'var(--color-text)' }}>{app.ios.appId}</span></p>}
              {app.ios?.storeUrl && <p>Store: <a href={app.ios.storeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }} className="hover:underline">App Store</a></p>}
            </div>
          </div>
        )}
      </div>

      {/* Smart store link copy button */}
      {(app.android?.storeUrl || app.ios?.storeUrl) && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <AppCopyStoreLink app={app} />
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(app)} className="flex-1">
          <span className="flex items-center justify-center gap-1.5"><PencilIcon /> Edit</span>
        </Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(app)} className="flex-1">
          <span className="flex items-center justify-center gap-1.5"><TrashIcon /> Delete</span>
        </Button>
      </div>
    </div>
  );
}

/* ─── App Form Modal ─── */
function AppFormModal({
  isOpen,
  onClose,
  onSuccess,
  editApp,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editApp?: IApp | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!editApp;

  const [name, setName] = useState('');
  const [androidPackage, setAndroidPackage] = useState('');
  const [androidSha256, setAndroidSha256] = useState('');
  const [androidStoreUrl, setAndroidStoreUrl] = useState('');
  const [iosBundleId, setIosBundleId] = useState('');
  const [iosTeamId, setIosTeamId] = useState('');
  const [iosAppId, setIosAppId] = useState('');
  const [iosStoreUrl, setIosStoreUrl] = useState('');

  // Populate fields when editing
  useEffect(() => {
    if (editApp) {
      setName(editApp.name || '');
      setAndroidPackage(editApp.android?.package || '');
      setAndroidSha256(editApp.android?.sha256 || '');
      setAndroidStoreUrl(editApp.android?.storeUrl || '');
      setIosBundleId(editApp.ios?.bundleId || '');
      setIosTeamId(editApp.ios?.teamId || '');
      setIosAppId(editApp.ios?.appId || '');
      setIosStoreUrl(editApp.ios?.storeUrl || '');
    } else {
      setName('');
      setAndroidPackage('');
      setAndroidSha256('');
      setAndroidStoreUrl('');
      setIosBundleId('');
      setIosTeamId('');
      setIosAppId('');
      setIosStoreUrl('');
    }
    setError(null);
  }, [editApp, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('App name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const appData = {
        name: name.trim(),
        android: {
          package: androidPackage.trim(),
          sha256: androidSha256.trim(),
          storeUrl: androidStoreUrl.trim(),
        },
        ios: {
          bundleId: iosBundleId.trim(),
          teamId: iosTeamId.trim(),
          appId: iosAppId.trim(),
          storeUrl: iosStoreUrl.trim(),
        },
      };

      if (isEdit) {
        await smartLinkApi.updateApp(String((editApp as any)._id), appData as UpdateAppDto);
      } else {
        await smartLinkApi.createApp(appData as CreateAppDto);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || `Failed to ${isEdit ? 'update' : 'create'} app`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <div className="sticky top-0 p-6 z-10" style={{ backgroundColor: 'var(--color-bg-card)', borderBottomColor: 'var(--color-border)', borderBottomWidth: '1px' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
              {isEdit ? 'Edit App' : 'Add New App'}
            </h2>
            <button
              onClick={onClose}
              className="text-2xl leading-none"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              &times;
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' }}>
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div>
            <Input
              label="App Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., AllEvents Mobile App"
              required
            />
          </div>

          {/* Android */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)' }}>
                <AndroidIcon />
              </div>
              Android Configuration
            </h3>
            <Input
              label="Package Name"
              type="text"
              value={androidPackage}
              onChange={(e) => setAndroidPackage(e.target.value)}
              placeholder="com.allevents.mobile"
              helperText="Android Studio > app/build.gradle > applicationId"
            />
            <Input
              label="SHA256 Fingerprint"
              type="text"
              value={androidSha256}
              onChange={(e) => setAndroidSha256(e.target.value)}
              placeholder="23:C6:3D:23:1E:87:..."
              helperText="Terminal: ./gradlew signingReport"
            />
            <Input
              label="Play Store URL"
              type="text"
              value={androidStoreUrl}
              onChange={(e) => setAndroidStoreUrl(e.target.value)}
              placeholder="https://play.google.com/store/apps/details?id=..."
              helperText="Users without your app will be sent here"
            />
          </div>

          {/* iOS */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
                <AppleIcon />
              </div>
              iOS Configuration
            </h3>
            <Input
              label="Bundle ID"
              type="text"
              value={iosBundleId}
              onChange={(e) => setIosBundleId(e.target.value)}
              placeholder="com.allevents.mobile"
              helperText="Xcode > Target > General > Bundle Identifier"
            />
            <Input
              label="Team ID"
              type="text"
              value={iosTeamId}
              onChange={(e) => setIosTeamId(e.target.value)}
              placeholder="e.g., 53V82MSR2T"
              helperText="developer.apple.com > Account > Membership"
            />
            <Input
              label="App ID"
              type="text"
              value={iosAppId}
              onChange={(e) => setIosAppId(e.target.value)}
              placeholder="e.g., 488116646"
              helperText="App Store Connect > App > General > Apple ID"
            />
            <Input
              label="App Store URL"
              type="text"
              value={iosStoreUrl}
              onChange={(e) => setIosStoreUrl(e.target.value)}
              placeholder="https://apps.apple.com/app/id488116646"
              helperText="Users without your app will be sent here"
            />
          </div>

          <div className="flex gap-3 pt-4" style={{ borderTopColor: 'var(--color-border)', borderTopWidth: '1px' }}>
            <Button variant="secondary" size="lg" onClick={onClose} type="button" className="flex-1">
              Cancel
            </Button>
            <Button variant="primary" size="lg" type="submit" isLoading={loading} className="flex-1">
              {isEdit ? 'Save Changes' : 'Create App'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Apps Page ─── */
export default function AppsPage() {
  const [apps, setApps] = useState<IApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editApp, setEditApp] = useState<IApp | null>(null);
  const { isContextReady, can } = useDashboard();
  const router = useRouter();

  // Permission gate — redirect unauthorized users
  useEffect(() => {
    if (isContextReady && !can('manage:apps')) {
      router.replace('/dashboard');
    }
  }, [isContextReady, can, router]);

  const fetchApps = async () => {
    try {
      setLoading(true);
      setError(null);
      const { apps: appList } = await smartLinkApi.listApps();
      setApps(appList);
    } catch (err: any) {
      if (err.status === 401) {
        setError('Not authenticated. Please set up your API key first.');
      } else {
        setError(err.message || 'Failed to load apps');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleEdit = (app: IApp) => {
    setEditApp(app);
    setModalOpen(true);
  };

  const handleDelete = async (app: IApp) => {
    if (!confirm(`Are you sure you want to delete "${app.name}"? This will deactivate the app.`)) {
      return;
    }
    try {
      await smartLinkApi.deleteApp(String((app as any)._id));
      fetchApps();
    } catch (err: any) {
      alert(err.message || 'Failed to delete app');
    }
  };

  const handleAddNew = () => {
    setEditApp(null);
    setModalOpen(true);
  };

  const handleModalSuccess = () => {
    fetchApps();
  };

  return (
    <div className="space-y-6 p-4 md:p-8" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap md:flex-nowrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text)' }}>Apps</h1>
          <p className="mt-1 text-sm md:text-base" style={{ color: 'var(--color-text-secondary)' }}>
            Manage your Android and iOS app configurations
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={handleAddNew}>
          <span className="flex items-center gap-2"><PlusIcon /> Add App</span>
        </Button>
      </div>

      {/* Error / empty state */}
      {error && !loading && apps.length === 0 && (
        <div className="card p-8 text-center" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-danger)', borderWidth: '1px' }}>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-danger)' }}>No Apps Yet</h3>
          <p className="mb-4" style={{ color: 'var(--color-danger)' }}>{error}</p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Add your first app to start creating deep links.
          </p>
        </div>
      )}

      {!error && !loading && apps.length === 0 && (
        <div className="card p-12 text-center" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--color-primary-light)' }}>
            <div style={{ color: 'var(--color-primary)' }}>
              <PlusIcon />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Add Your First App</h3>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
            Register your Android or iOS app to start creating deep links and tracking installs.
          </p>
          <Button variant="primary" size="lg" onClick={handleAddNew}>
            <span className="flex items-center gap-2"><PlusIcon /> Add App</span>
          </Button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card p-6 space-y-3" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <div className="h-6 rounded animate-pulse w-1/2" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
              <div className="h-4 rounded animate-pulse w-1/4" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
              <div className="flex gap-2 pt-2">
                <div className="h-6 rounded-full animate-pulse w-20" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
                <div className="h-6 rounded-full animate-pulse w-16" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
              </div>
              <div className="pt-4 space-y-2" style={{ borderTopColor: 'var(--color-border)', borderTopWidth: '1px' }}>
                <div className="h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
                <div className="h-3 rounded animate-pulse w-3/4" style={{ backgroundColor: 'var(--color-bg-secondary)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apps grid */}
      {!loading && apps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {apps.map((app) => (
            <AppCard
              key={String((app as any)._id)}
              app={app}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      <AppFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleModalSuccess}
        editApp={editApp}
      />
    </div>
  );
}
