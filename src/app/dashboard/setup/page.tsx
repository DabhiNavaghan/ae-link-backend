'use client';

import { useState } from 'react';
import { smartLinkApi } from '@/lib/api';
import { RegisterTenantDto } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useRouter } from 'next/navigation';
import { useFieldHistory } from '@/lib/hooks/useFieldHistory';

type SetupStep = 'welcome' | 'app-details' | 'platforms' | 'success';

/* ─── Icons ─── */
const RocketIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.841m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
  </svg>
);

const KeyIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  </svg>
);

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

const BookIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-8 h-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const InfoIcon = ({ className = 'w-4 h-4 text-slate-400' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  </svg>
);

/* ─── Tooltip Component ─── */
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1.5 cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <InfoIcon />
      {show && (
        <span className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg leading-relaxed">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  );
}

/* ─── Section Header ─── */
function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ─── Step 1: Welcome ─── */
function WelcomeStep({
  onNext,
  loading,
}: {
  onNext: (apiKey: string) => void;
  loading: boolean;
}) {
  const [apiKey, setApiKey] = useState('');
  const [showExisting, setShowExisting] = useState(false);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <RocketIcon />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome to SmartLink</h2>
        <p className="text-slate-500 text-sm">
          Set up deep linking for your mobile app in minutes.
        </p>
      </div>

      {/* Features overview */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
        {[
          ['Deferred Deep Links', 'Route users to the right content even after app install'],
          ['Device Fingerprinting', 'Smart matching between web clicks and app opens'],
          ['Real-time Analytics', 'Track clicks, installs, and conversions'],
        ].map(([title, desc]) => (
          <div key={title} className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-800">{title}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Primary CTA */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={() => onNext('')}
        isLoading={loading && !apiKey}
      >
        Create New App
      </Button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-slate-400 uppercase tracking-wider">or</span>
        </div>
      </div>

      {/* Existing key */}
      {!showExisting ? (
        <button
          onClick={() => setShowExisting(true)}
          className="w-full flex items-center justify-center gap-2 text-sm text-slate-600 hover:text-primary-600 font-medium py-2.5 border border-slate-200 rounded-lg hover:border-primary-300 transition-colors"
        >
          <KeyIcon />
          Connect with existing API key
        </button>
      ) : (
        <div className="border border-slate-200 p-4 rounded-xl space-y-3">
          <p className="text-xs text-slate-500">
            If you've already registered an app, paste your API key to connect.
          </p>
          <Input
            label="API Key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="ae_live_xxxxxxxxxxxx"
            helperText="Find this in your dashboard under Settings > API Keys"
          />
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="md"
              onClick={() => { setShowExisting(false); setApiKey(''); }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => onNext(apiKey)}
              isLoading={loading}
              disabled={!apiKey.trim()}
              className="flex-1"
            >
              Verify & Connect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Step 2: App Details ─── */
function AppDetailsStep({
  onNext,
  onBack,
  loading,
  suggestions,
}: {
  onNext: (data: RegisterTenantDto) => void;
  onBack: () => void;
  loading: boolean;
  suggestions: Record<string, string[]>;
}) {
  const [formData, setFormData] = useState<RegisterTenantDto>({
    name: '',
    domain: '',
    app: {
      android: { package: '', sha256: '', storeUrl: '' },
      ios: { bundleId: '', teamId: '', appId: '', storeUrl: '' },
    },
    settings: {
      fingerprintTtlHours: 6,
      matchThreshold: 60,
      defaultFallbackUrl: '',
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, path: string) => {
    const value = e.target.value;
    const keys = path.split('.');
    const updated = JSON.parse(JSON.stringify(formData));
    let obj: any = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    setFormData(updated);
    // Clear error on change
    if (errors[path]) {
      setErrors((prev) => { const next = { ...prev }; delete next[path]; return next; });
    }
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'App name is required';
    if (!formData.domain.trim()) newErrors.domain = 'Domain is required';
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    onNext(formData);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<RocketIcon />}
        title="App Details"
        subtitle="Basic info about your app — you can change this later."
      />

      <div className="space-y-4">
        <Input
          label="App Name"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange(e, 'name')}
          placeholder="e.g., AllEvents Mobile App"
          helperText="A friendly name to identify this app in your dashboard."
          error={errors.name}
          suggestions={suggestions['name']}
          required
        />
        <Input
          label="Domain"
          type="text"
          value={formData.domain}
          onChange={(e) => handleChange(e, 'domain')}
          placeholder="e.g., allevents.in"
          helperText="Your website domain — deep links will be hosted under this."
          error={errors.domain}
          suggestions={suggestions['domain']}
          required
        />
        <Input
          label="Default Fallback URL"
          type="text"
          value={formData.settings?.defaultFallbackUrl || ''}
          onChange={(e) => handleChange(e, 'settings.defaultFallbackUrl')}
          placeholder="https://allevents.in"
          helperText="Where to send users if the app is not installed and no store URL is set. (optional)"
          suggestions={suggestions['settings.defaultFallbackUrl']}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" size="lg" onClick={onBack} className="w-24">
          Back
        </Button>
        <Button variant="primary" size="lg" fullWidth onClick={handleSubmit} isLoading={loading}>
          Next: Platforms
        </Button>
      </div>
    </div>
  );
}

/* ─── Step 3: Platforms ─── */
function PlatformsStep({
  onNext,
  onBack,
  loading,
  initialData,
  suggestions,
}: {
  onNext: (data: RegisterTenantDto) => void;
  onBack: () => void;
  loading: boolean;
  initialData: RegisterTenantDto;
  suggestions: Record<string, string[]>;
}) {
  const [formData, setFormData] = useState(JSON.parse(JSON.stringify(initialData)));
  const [expandAndroid, setExpandAndroid] = useState(true);
  const [expandIos, setExpandIos] = useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, path: string) => {
    const value = e.target.value;
    const keys = path.split('.');
    const updated = JSON.parse(JSON.stringify(formData));
    let obj: any = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    setFormData(updated);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<RocketIcon />}
        title="Platform Setup"
        subtitle="Configure Android & iOS. You can skip this and do it later."
      />

      {/* Android Section */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setExpandAndroid(!expandAndroid)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
              <AndroidIcon />
            </div>
            <span className="font-semibold text-slate-800">Android</span>
          </div>
          <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandAndroid ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expandAndroid && (
          <div className="p-4 space-y-4">
            <Input
              label={<span className="flex items-center">Package Name<Tooltip text="Your Android app's package name. Find it in your app/build.gradle file under 'applicationId', e.g., com.example.myapp" /></span> as any}
              type="text"
              value={formData.app?.android?.package || ''}
              onChange={(e) => handleChange(e, 'app.android.package')}
              placeholder="com.allevents.mobile"
              helperText="Android Studio > app/build.gradle > applicationId"
              suggestions={suggestions['app.android.package']}
            />
            <Input
              label={<span className="flex items-center">SHA256 Fingerprint<Tooltip text="Your app's signing certificate SHA256. Run: ./gradlew signingReport in Android Studio terminal, or find it in Google Play Console > Setup > App Signing." /></span> as any}
              type="text"
              value={formData.app?.android?.sha256 || ''}
              onChange={(e) => handleChange(e, 'app.android.sha256')}
              placeholder="23:C6:3D:23:1E:87:..."
              helperText="Android Studio > Terminal > ./gradlew signingReport"
              suggestions={suggestions['app.android.sha256']}
            />
            <Input
              label={<span className="flex items-center">Play Store URL<Tooltip text="The full URL to your app on Google Play Store. Copy it from your browser when viewing your app listing." /></span> as any}
              type="text"
              value={formData.app?.android?.storeUrl || ''}
              onChange={(e) => handleChange(e, 'app.android.storeUrl')}
              placeholder="https://play.google.com/store/apps/details?id=..."
              helperText="Users without your app will be sent here."
              suggestions={suggestions['app.android.storeUrl']}
            />
          </div>
        )}
      </div>

      {/* iOS Section */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setExpandIos(!expandIos)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
              <AppleIcon />
            </div>
            <span className="font-semibold text-slate-800">iOS</span>
          </div>
          <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandIos ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expandIos && (
          <div className="p-4 space-y-4">
            <Input
              label={<span className="flex items-center">Bundle ID<Tooltip text="Your iOS app's bundle identifier. Find it in Xcode: select your target > General tab > 'Bundle Identifier', e.g., com.example.myapp" /></span> as any}
              type="text"
              value={formData.app?.ios?.bundleId || ''}
              onChange={(e) => handleChange(e, 'app.ios.bundleId')}
              placeholder="com.allevents.mobile"
              helperText="Xcode > Target > General > Bundle Identifier"
              suggestions={suggestions['app.ios.bundleId']}
            />
            <Input
              label={<span className="flex items-center">Team ID<Tooltip text="Your Apple Developer Team ID. Go to developer.apple.com > Account > Membership — it's the 10-character alphanumeric string." /></span> as any}
              type="text"
              value={formData.app?.ios?.teamId || ''}
              onChange={(e) => handleChange(e, 'app.ios.teamId')}
              placeholder="e.g., 53V82MSR2T"
              helperText="developer.apple.com > Account > Membership"
              suggestions={suggestions['app.ios.teamId']}
            />
            <Input
              label={<span className="flex items-center">App ID<Tooltip text="Your iOS App ID (the numeric ID). Find it at appstoreconnect.apple.com > Apps > your app > General > Apple ID." /></span> as any}
              type="text"
              value={formData.app?.ios?.appId || ''}
              onChange={(e) => handleChange(e, 'app.ios.appId')}
              placeholder="e.g., 488116646"
              helperText="App Store Connect > App > General > Apple ID"
              suggestions={suggestions['app.ios.appId']}
            />
            <Input
              label={<span className="flex items-center">App Store URL<Tooltip text="The full URL to your app on the Apple App Store. Copy it from your browser or App Store Connect." /></span> as any}
              type="text"
              value={formData.app?.ios?.storeUrl || ''}
              onChange={(e) => handleChange(e, 'app.ios.storeUrl')}
              placeholder="https://apps.apple.com/app/id488116646"
              helperText="Users without your app will be sent here."
              suggestions={suggestions['app.ios.storeUrl']}
            />
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" size="lg" onClick={onBack} className="w-24">
          Back
        </Button>
        <Button variant="primary" size="lg" fullWidth onClick={() => onNext(formData)} isLoading={loading}>
          Finish Setup
        </Button>
      </div>
    </div>
  );
}

/* ─── Step 4: Success ─── */
function SuccessStep({ apiKey, appName }: { apiKey: string; appName: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-success-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">You're All Set!</h2>
        <p className="text-slate-500 text-sm">
          <strong className="text-slate-700">{appName}</strong> is now registered and ready.
        </p>
      </div>

      {/* API Key Card */}
      <div className="bg-success-50 border border-success-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <KeyIcon />
          <p className="text-sm font-semibold text-slate-800">Your API Key</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-success-200">
          <code className="font-mono text-xs flex-1 break-all text-slate-900 select-all">
            {apiKey}
          </code>
          <button
            onClick={handleCopy}
            className={`text-xs font-medium whitespace-nowrap px-3 py-1.5 rounded-md transition-colors ${
              copied ? 'bg-success-100 text-success-700' : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
            }`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-success-700 mt-2.5 flex items-start gap-1.5">
          <InfoIcon className="w-3.5 h-3.5 text-success-500 mt-0.5 flex-shrink-0" />
          Save this key securely. You'll need it to authenticate SDK and API requests.
        </p>
      </div>

      {/* Next Steps */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-3 text-sm">What's Next</h3>
        <div className="space-y-3">
          {[
            { step: '1', title: 'Add the Flutter SDK', desc: 'Install smartlink_sdk in your pubspec.yaml' },
            { step: '2', title: 'Initialize with your API key', desc: 'SmartLinkSdk.init(apiKey: "your-key")' },
            { step: '3', title: 'Create a deep link', desc: 'Use the dashboard to generate your first link' },
            { step: '4', title: 'Test end-to-end', desc: 'Click the link on web, install app, verify routing' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-200 text-primary-700 text-xs font-bold flex items-center justify-center">
                {item.step}
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={() => router.push('/dashboard/docs')}
          className="flex-1"
        >
          <span className="flex items-center gap-2"><BookIcon /> View Docs</span>
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={() => router.push('/dashboard')}
          className="flex-1"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

/* ─── Main Setup Page ─── */
export default function SetupPage() {
  const [step, setStep] = useState<SetupStep>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appData, setAppData] = useState<RegisterTenantDto | null>(null);
  const [successData, setSuccessData] = useState<{ apiKey: string; appName: string } | null>(null);
  const router = useRouter();
  const { getSuggestions, saveMany } = useFieldHistory();

  const allFields = [
    'name', 'domain', 'settings.defaultFallbackUrl',
    'app.android.package', 'app.android.sha256', 'app.android.storeUrl',
    'app.ios.bundleId', 'app.ios.teamId', 'app.ios.appId', 'app.ios.storeUrl',
  ];
  const suggestions = Object.fromEntries(allFields.map((f) => [f, getSuggestions(f)]));

  const handleWelcomeStep = async (apiKey: string) => {
    try {
      setLoading(true);
      setError(null);
      if (apiKey) {
        smartLinkApi.setApiKey(apiKey);
        await smartLinkApi.getTenant();
        router.push('/dashboard');
      } else {
        setStep('app-details');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid API key. Please check and try again.');
      smartLinkApi.clearApiKey();
    } finally {
      setLoading(false);
    }
  };

  const handleAppDetailsStep = (data: RegisterTenantDto) => {
    setAppData(data);
    setStep('platforms');
  };

  const handlePlatformsStep = async (data: RegisterTenantDto) => {
    try {
      setLoading(true);
      setError(null);
      const result = await smartLinkApi.registerTenant(data);
      const apiKey = result?.apiKey || '';
      const appName = result?.name || data.name;
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'smartlink-tenant',
          JSON.stringify({ id: (result as any)?.tenantId || (result as any)?._id, name: appName, apiKey })
        );
      }

      // Also create an App record with the platform config
      try {
        await smartLinkApi.createApp({
          name: data.name,
          android: data.app?.android || undefined,
          ios: data.app?.ios || undefined,
        });
      } catch (appErr) {
        // Non-blocking — tenant is already created, app can be added later
        console.error('Failed to create app record:', appErr);
      }

      saveMany({
        name: data.name,
        domain: data.domain,
        'settings.defaultFallbackUrl': data.settings?.defaultFallbackUrl || '',
        'app.android.package': data.app?.android?.package || '',
        'app.android.sha256': data.app?.android?.sha256 || '',
        'app.android.storeUrl': data.app?.android?.storeUrl || '',
        'app.ios.bundleId': data.app?.ios?.bundleId || '',
        'app.ios.teamId': data.app?.ios?.teamId || '',
        'app.ios.appId': data.app?.ios?.appId || '',
        'app.ios.storeUrl': data.app?.ios?.storeUrl || '',
      });
      setSuccessData({ apiKey, appName });
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Failed to create app. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['welcome', 'app-details', 'platforms'] as const;
  const currentStepIndex = steps.indexOf(step as any);
  const stepLabels = ['Welcome', 'App Details', 'Platforms'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">SmartLink</h1>
          <p className="text-slate-500 text-sm mt-1">Smart Deep Linking Platform</p>
        </div>

        {/* Progress Bar (visible for non-success steps) */}
        {step !== 'success' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              {stepLabels.map((label, idx) => (
                <span
                  key={label}
                  className={`text-xs font-medium transition-colors ${
                    currentStepIndex >= idx ? 'text-primary-600' : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              {steps.map((s, idx) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    currentStepIndex >= idx ? 'bg-primary-500' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 sm:p-8">
          {error && (
            <div className="mb-5 bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {step === 'welcome' && <WelcomeStep onNext={handleWelcomeStep} loading={loading} />}
          {step === 'app-details' && (
            <AppDetailsStep onNext={handleAppDetailsStep} onBack={() => setStep('welcome')} loading={loading} suggestions={suggestions} />
          )}
          {step === 'platforms' && appData && (
            <PlatformsStep initialData={appData} onNext={handlePlatformsStep} onBack={() => setStep('app-details')} loading={loading} suggestions={suggestions} />
          )}
          {step === 'success' && successData && (
            <SuccessStep apiKey={successData.apiKey} appName={successData.appName} />
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-5 flex items-center justify-center gap-4">
          <a href="/dashboard/docs" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1.5">
            <BookIcon /> Documentation
          </a>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-400">Powered by AllEvents</span>
        </div>
      </div>
    </div>
  );
}
