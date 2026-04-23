'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

/* ─── Icons ─── */
const ArrowLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
  </svg>
);

/* ─── Code Block Component ─── */
function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-sm overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy to clipboard"
      >
        {copied ? (
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <CopyIcon />
        )}
      </button>
    </div>
  );
}

/* ─── Section Component ─── */
function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
        {title}
      </h2>
      <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

/* ─── Reference Table ─── */
function ReferenceTable({
  rows,
}: {
  rows: { field: string; where: string; example: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200">Field</th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200">Where to Find</th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200">Example</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.field} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
              <td className="px-4 py-2.5 font-medium text-slate-800 border-b border-slate-100">{row.field}</td>
              <td className="px-4 py-2.5 text-slate-600 border-b border-slate-100">{row.where}</td>
              <td className="px-4 py-2.5 border-b border-slate-100">
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{row.example}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Nav Items ─── */
const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'android-setup', label: 'Android Setup' },
  { id: 'ios-setup', label: 'iOS Setup' },
  { id: 'flutter-sdk', label: 'Flutter SDK' },
  { id: 'api-reference', label: 'API Reference' },
  { id: 'deep-links', label: 'Deep Links' },
  { id: 'deferred-linking', label: 'Deferred Linking' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
];

/* ─── Main Docs Page ─── */
export default function DocsPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('overview');
  const appHost = typeof window !== 'undefined' ? window.location.host : 'aelink.vercel.app';
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://aelink.vercel.app';

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-slate-500 hover:text-slate-700 p-1">
              <ArrowLeftIcon />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">AE-LINK Documentation</h1>
              <p className="text-xs text-slate-500">Setup guides, SDK reference, and integration help</p>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => router.push('/dashboard')}>
            Dashboard
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-8">
        {/* Sidebar Nav */}
        <nav className="hidden lg:block w-56 flex-shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-8 pr-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => scrollTo(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeSection === item.id
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-w-0 py-8 space-y-12 pb-24 max-w-3xl">

          {/* Overview */}
          <DocSection id="overview" title="Overview">
            <p>
              AE-LINK is a deep linking platform that ensures consistent user experience from
              email or web to your mobile app. It supports standard deep links, deferred deep links
              (routing users to specific content even after a fresh install), device fingerprinting
              for attribution, and real-time analytics.
            </p>
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <p className="font-semibold text-primary-800 mb-2">How it works</p>
              <p className="text-primary-700">
                When a user clicks an AE-LINK deep link on the web, the system captures a device
                fingerprint (IP, browser, screen, etc.). If the app is already installed, the user
                is routed directly. If not, they're sent to the app store. After installing and
                opening the app, the Flutter SDK matches the fingerprint and delivers the original
                deep link content — no manual bookmarking needed.
              </p>
            </div>
          </DocSection>

          {/* Getting Started */}
          <DocSection id="getting-started" title="Getting Started">
            <p>Follow these steps to get AE-LINK running with your app:</p>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center">1</span>
                <div>
                  <p className="font-medium text-slate-800">Register your app</p>
                  <p className="text-slate-600 mt-0.5">
                    Go to <a href="/dashboard/setup" className="text-primary-600 hover:underline">/dashboard/setup</a> and
                    create a new app. You'll get an API key upon completion.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center">2</span>
                <div>
                  <p className="font-medium text-slate-800">Configure platforms</p>
                  <p className="text-slate-600 mt-0.5">
                    Add your Android package name + SHA256, and iOS Bundle ID + Team ID in the
                    setup wizard or under Settings.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center">3</span>
                <div>
                  <p className="font-medium text-slate-800">Integrate the Flutter SDK</p>
                  <p className="text-slate-600 mt-0.5">
                    Add <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-xs">ae_link_sdk</code> to
                    your Flutter app and initialize with your API key.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center">4</span>
                <div>
                  <p className="font-medium text-slate-800">Create and share links</p>
                  <p className="text-slate-600 mt-0.5">
                    Use the dashboard to create deep links, attach them to campaigns, and share
                    them via email, social, or SMS.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
              <p className="font-semibold mb-1">Important</p>
              <p>Your API key is shown once during setup. Copy it and store it securely. You can regenerate it later under Settings, but the old key will stop working immediately.</p>
            </div>
          </DocSection>

          {/* Android Setup */}
          <DocSection id="android-setup" title="Android Setup">
            <p>
              To enable deep links and app links on Android, you need three values from your
              Android project:
            </p>

            <ReferenceTable rows={[
              {
                field: 'Package Name',
                where: 'app/build.gradle > applicationId',
                example: 'com.amitech.allevents',
              },
              {
                field: 'SHA256 Fingerprint',
                where: 'Android Studio Terminal: ./gradlew signingReport',
                example: '23:C6:3D:23:1E:87:...',
              },
              {
                field: 'Play Store URL',
                where: 'Google Play Console > your app page URL',
                example: 'https://play.google.com/store/apps/details?id=com.amitech.allevents',
              },
            ]} />

            <div className="space-y-3">
              <p className="font-semibold text-slate-800">Finding your SHA256 fingerprint:</p>
              <p>Open a terminal in your Android project root and run:</p>
              <CodeBlock code="./gradlew signingReport" />
              <p>
                Look for the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">SHA-256</code> value
                under the variant you use for release (usually <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">release</code>).
              </p>
              <p>
                Alternatively, if your app is on the Play Store, go to <strong>Google Play Console &gt;
                Setup &gt; App Signing</strong> and copy the SHA-256 certificate fingerprint.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800">
              <p className="font-semibold mb-1">App Links verification</p>
              <p>
                AE-LINK automatically serves the <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">/.well-known/assetlinks.json</code> file
                for your domain, enabling automatic Android App Links verification. No manual file
                hosting needed.
              </p>
            </div>
          </DocSection>

          {/* iOS Setup */}
          <DocSection id="ios-setup" title="iOS Setup">
            <p>
              For Universal Links on iOS, you need four values from your Apple Developer account:
            </p>

            <ReferenceTable rows={[
              {
                field: 'Bundle ID',
                where: 'Xcode > Target > General > Bundle Identifier',
                example: 'com.amitech.allevents',
              },
              {
                field: 'Team ID',
                where: 'developer.apple.com > Account > Membership',
                example: '53V82MSR2T',
              },
              {
                field: 'App ID (Numeric)',
                where: 'App Store Connect > Apps > Your App > General Info > Apple ID',
                example: '488116646',
              },
              {
                field: 'App Store URL',
                where: 'Browser URL when viewing your app on the App Store',
                example: 'https://apps.apple.com/app/id488116646',
              },
            ]} />

            <div className="space-y-3">
              <p className="font-semibold text-slate-800">Finding your Team ID:</p>
              <p>
                Sign in to <a href="https://developer.apple.com/account" target="_blank" rel="noopener" className="text-primary-600 hover:underline">developer.apple.com/account</a>,
                go to <strong>Membership</strong>, and look for the 10-character alphanumeric Team ID.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800">
              <p className="font-semibold mb-1">Universal Links</p>
              <p>
                AE-LINK automatically serves the <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">/.well-known/apple-app-site-association</code> file
                for your domain. Make sure your Xcode project has the <strong>Associated Domains</strong> capability
                enabled with <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">applinks:{appHost}</code>.
              </p>
            </div>
          </DocSection>

          {/* Flutter SDK */}
          <DocSection id="flutter-sdk" title="Flutter SDK Integration">
            <p>The AE-LINK Flutter SDK handles everything: device fingerprinting, deferred deep link matching, and direct app link handling. Use the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">AeLinkService</code> wrapper for the simplest integration.</p>

            <div className="space-y-3">
              <p className="font-semibold text-slate-800">1. Add dependency</p>
              <CodeBlock language="yaml" code={`# pubspec.yaml
dependencies:
  ae_link:
    git:
      url: https://github.com/DabhiNavaghan/ae-link.git`} />
            </div>

            <div className="space-y-3">
              <p className="font-semibold text-slate-800">2. Create a service file</p>
              <p>Create <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">lib/services/aelink_service.dart</code> — a single file that manages the entire AE-LINK lifecycle:</p>
              <CodeBlock language="dart" code={`import 'package:ae_link/ae_link.dart';
import 'package:flutter/material.dart';

/// Global AE-LINK service instance
late AeLinkService aeLink;

/// Initialize AE-LINK — call once in main()
Future<DeepLinkData?> initAeLink({
  required GlobalKey<NavigatorState> navigatorKey,
}) async {
  aeLink = AeLinkService(
    apiKey: 'YOUR_API_KEY',  // From dashboard Settings
    debug: true,  // false in production
    onDeepLink: (data) {
      _handleDeepLink(data, navigatorKey);
    },
    onError: (message, error) {
      debugPrint('AE-LINK error: $message — $error');
    },
  );

  // Initialize SDK + check deferred link + start listening
  return await aeLink.initialize();
}

/// Route deep links to the correct screen
void _handleDeepLink(DeepLinkData data, GlobalKey<NavigatorState> navKey) {
  final navigator = navKey.currentState;
  if (navigator == null) return;

  debugPrint('Deep link: eventId=\${data.eventId}, '
      'action=\${data.action}, deferred=\${data.isDeferred}');

  // Route based on the link data
  if (data.eventId != null) {
    navigator.pushNamed('/event/\${data.eventId}');
  } else if (data.destinationUrl != null) {
    navigator.pushNamed('/webview', arguments: data.destinationUrl);
  }

  // Access UTM params, coupon codes, etc.
  final utmSource = data.linkParams?.utmSource;
  final coupon = data.couponCode;
  if (coupon != null) {
    debugPrint('Coupon code: $coupon');
  }
}`} />
            </div>

            <div className="space-y-3">
              <p className="font-semibold text-slate-800">3. Initialize in main.dart</p>
              <CodeBlock language="dart" code={`import 'package:flutter/material.dart';
import 'services/aelink_service.dart';

final navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize AE-LINK (handles everything)
  final deferredLink = await initAeLink(navigatorKey: navigatorKey);

  runApp(MyApp(
    navigatorKey: navigatorKey,
    initialDeepLink: deferredLink,
  ));
}

class MyApp extends StatelessWidget {
  final GlobalKey<NavigatorState> navigatorKey;
  final DeepLinkData? initialDeepLink;

  const MyApp({
    super.key,
    required this.navigatorKey,
    this.initialDeepLink,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      // If there's a deferred link, go to that screen
      initialRoute: initialDeepLink?.eventId != null
          ? '/event/\${initialDeepLink!.eventId}'
          : '/',
      routes: {
        '/': (context) => const HomeScreen(),
        // ... your routes
      },
    );
  }
}`} />
            </div>

            <div className="space-y-3">
              <p className="font-semibold text-slate-800">4. What happens automatically</p>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2">
                <p className="text-sm text-slate-700"><strong>First launch after install:</strong> SDK collects device fingerprint, calls the backend to match against stored browser fingerprints, and delivers the original link data via <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">onDeepLink</code>.</p>
                <p className="text-sm text-slate-700"><strong>Direct app links:</strong> When the app is already installed and the user clicks an AE-LINK URL, the SDK receives it via Universal Links (iOS) / App Links (Android) and delivers it through the same <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">onDeepLink</code> callback.</p>
                <p className="text-sm text-slate-700"><strong>Auto-confirmation:</strong> Deferred links are automatically confirmed as delivered, tracking the conversion in your analytics.</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-semibold text-slate-800">5. Available data in DeepLinkData</p>
              <CodeBlock language="dart" code={`onDeepLink: (data) {
  data.eventId;          // "12345"
  data.action;           // "view_event", "buy_ticket"
  data.destinationUrl;   // "https://allevents.in/event/..."
  data.isDeferred;       // true if from deferred matching
  data.deferredLinkId;   // ID for tracking
  data.linkId;           // Original link ID

  // UTM and tracking params
  data.linkParams?.utmSource;    // "email"
  data.linkParams?.utmCampaign;  // "summer-promo"
  data.linkParams?.utmMedium;    // "newsletter"

  // Special params
  data.couponCode;       // "SAVE20"
  data.referralCode;     // "REF123"
  data.userEmail;        // "user@example.com"
  data.customParams;     // Any custom key-value pairs
}`} />
            </div>
          </DocSection>

          {/* API Reference */}
          <DocSection id="api-reference" title="API Reference">
            <p>
              All API endpoints require authentication via the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">X-API-Key</code> header.
              The base URL is <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{appUrl}/api/v1</code>.
            </p>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200">Method</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200">Endpoint</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['POST', '/tenants', 'Register a new app/tenant'],
                    ['GET', '/tenants', 'Get current tenant details'],
                    ['POST', '/tenants/regenerate-key', 'Regenerate API key'],
                    ['POST', '/links', 'Create a new deep link'],
                    ['GET', '/links', 'List all links'],
                    ['GET', '/links/:id', 'Get a specific link'],
                    ['POST', '/campaigns', 'Create a new campaign'],
                    ['GET', '/campaigns', 'List campaigns'],
                    ['POST', '/fingerprint', 'Store a device fingerprint (web-side)'],
                    ['POST', '/deferred/match', 'Match a fingerprint (SDK-side)'],
                    ['POST', '/deferred/confirm', 'Confirm a deferred link was opened'],
                    ['GET', '/analytics/overview', 'Dashboard analytics overview'],
                    ['GET', '/analytics/links/:id', 'Analytics for a specific link'],
                    ['GET', '/analytics/campaigns/:id', 'Analytics for a specific campaign'],
                  ].map(([method, endpoint, desc], i) => (
                    <tr key={endpoint} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="px-4 py-2 border-b border-slate-100">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          method === 'GET' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {method}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b border-slate-100">
                        <code className="text-xs text-slate-700">{endpoint}</code>
                      </td>
                      <td className="px-4 py-2 text-slate-600 border-b border-slate-100">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3">
              <p className="font-semibold text-slate-800">Example: Create a deep link</p>
              <CodeBlock code={`curl -X POST ${appUrl}/api/v1/links \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Summer Music Festival",
    "destinationUrl": "https://allevents.in/event/summer-music-fest",
    "deepLinkPath": "/event/summer-music-fest",
    "params": {
      "source": "email",
      "campaign": "summer-promo"
    }
  }'`} />
            </div>
          </DocSection>

          {/* Deep Links */}
          <DocSection id="deep-links" title="Creating Deep Links">
            <p>
              Deep links are URLs that route users to specific content in your app. In AE-LINK,
              each link has a short code (e.g., <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{appHost}/abc123</code>)
              that resolves to your app or web fallback.
            </p>

            <div className="space-y-3">
              <p className="font-semibold text-slate-800">Link properties:</p>
              <ReferenceTable rows={[
                { field: 'title', where: 'Descriptive name for the link', example: 'Summer Festival 2026' },
                { field: 'destinationUrl', where: 'Web fallback URL', example: 'https://allevents.in/event/...' },
                { field: 'deepLinkPath', where: 'In-app path for routing', example: '/event/summer-fest-2026' },
                { field: 'params', where: 'Custom key-value pairs for tracking', example: '{"source": "email"}' },
              ]} />
            </div>

            <p>
              You can create links from the dashboard (Links page) or via the API. Each link
              automatically gets a unique short code and tracks clicks, platform detection, and
              conversions.
            </p>
          </DocSection>

          {/* Deferred Linking */}
          <DocSection id="deferred-linking" title="How Deferred Linking Works">
            <p>
              Deferred deep linking bridges the gap between a web click and a fresh app install.
              Here's the step-by-step flow:
            </p>

            <div className="bg-slate-50 rounded-xl p-5 space-y-4">
              {[
                {
                  step: '1',
                  title: 'User clicks an AE-LINK URL on the web',
                  desc: 'The redirect page captures device fingerprint data: IP address, browser, screen size, language, timezone, and more.',
                },
                {
                  step: '2',
                  title: 'Fingerprint is stored server-side',
                  desc: 'A DeferredLink record is created linking the fingerprint to the original deep link path and parameters.',
                },
                {
                  step: '3',
                  title: 'User is redirected to the app store',
                  desc: 'If the app is not installed, the user goes to the Play Store or App Store based on their device.',
                },
                {
                  step: '4',
                  title: 'User installs and opens the app',
                  desc: 'The Flutter SDK collects the device fingerprint and sends it to the /deferred/match endpoint.',
                },
                {
                  step: '5',
                  title: 'Fingerprint matching',
                  desc: 'The server compares the app fingerprint against stored web fingerprints using a scoring algorithm.',
                },
                {
                  step: '6',
                  title: 'Deep link delivered',
                  desc: 'If a match is found (score >= 70), the original link path and params are returned to the app, and the user is routed to the right content.',
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-200 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {item.step}
                  </span>
                  <div>
                    <p className="font-medium text-slate-800">{item.title}</p>
                    <p className="text-slate-600 text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="font-semibold text-slate-800">Fingerprint Matching Scores</p>
              <ReferenceTable rows={[
                { field: 'IP Address', where: 'Exact match of user IP', example: '40 points' },
                { field: 'User Agent', where: 'Browser/device string hash match', example: '30 points' },
                { field: 'Screen Resolution', where: 'Width x Height match', example: '10 points' },
                { field: 'Language', where: 'Browser/device locale match', example: '5 points' },
                { field: 'Timezone', where: 'Device timezone match', example: '5 points' },
                { field: 'Time Proximity', where: '10 minus hours since click', example: 'Up to 10 points' },
              ]} />
              <p>
                Total possible: 100 points. Minimum threshold for a match: <strong>70 points</strong> (configurable).
                Fingerprints expire after <strong>72 hours</strong> by default (also configurable).
              </p>
            </div>
          </DocSection>

          {/* Campaigns */}
          <DocSection id="campaigns" title="Campaigns">
            <p>
              Campaigns let you group multiple deep links together for organized tracking. For
              example, you might create a "Summer Newsletter" campaign and attach all event links
              used in that email blast.
            </p>
            <p>
              Create campaigns from the dashboard's Campaigns page. Each campaign gets its own
              analytics view showing total clicks, installs, and conversions across all its links.
            </p>
            <CodeBlock code={`curl -X POST ${appUrl}/api/v1/campaigns \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Summer Newsletter 2026",
    "description": "Links for the June email blast",
    "tags": ["email", "summer", "2026"]
  }'`} />
          </DocSection>

          {/* Analytics */}
          <DocSection id="analytics" title="Analytics">
            <p>AE-LINK tracks the following metrics in real-time:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { title: 'Clicks', desc: 'Total deep link clicks across all platforms' },
                { title: 'Installs', desc: 'App installs attributed via fingerprint matching' },
                { title: 'Conversions', desc: 'Users who completed the deferred deep link flow' },
                { title: 'Conversion Rate', desc: 'Percentage of clicks that result in conversions' },
                { title: 'Platform Split', desc: 'Android vs iOS vs Web breakdown' },
                { title: 'Top Links', desc: 'Your most-clicked and highest-converting links' },
              ].map((metric) => (
                <div key={metric.title} className="bg-slate-50 rounded-lg p-3">
                  <p className="font-medium text-slate-800 text-sm">{metric.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{metric.desc}</p>
                </div>
              ))}
            </div>
            <p>
              View analytics from the dashboard home page for an overview, or drill into specific
              links and campaigns for detailed metrics.
            </p>
          </DocSection>

          {/* Troubleshooting */}
          <DocSection id="troubleshooting" title="Troubleshooting">
            <div className="space-y-5">
              {[
                {
                  q: 'Deep links are not opening my app',
                  a: `Verify your Android package name + SHA256 (or iOS Bundle ID + Team ID) are correctly configured in Settings. On Android, ensure App Links verification passes. On iOS, check that Associated Domains is enabled in Xcode with "applinks:${appHost}".`,
                },
                {
                  q: 'Deferred deep links are not matching',
                  a: 'The fingerprint match requires at least 70 points. Ensure the user opens the app within 72 hours of clicking the link, and that they use the same network (IP address is worth 40 points). Check the Analytics page for match scores.',
                },
                {
                  q: 'API returns 401 Unauthorized',
                  a: 'Make sure you are sending the X-API-Key header with every request. If you regenerated your key, update it in your SDK configuration and any direct API calls.',
                },
                {
                  q: 'MongoDB connection error (querySrv ECONNREFUSED)',
                  a: 'This usually means your DNS server cannot resolve MongoDB Atlas SRV records. Switch to Google DNS (8.8.8.8, 8.8.4.4) or Cloudflare DNS (1.1.1.1). Also check that your IP is whitelisted in MongoDB Atlas under Network Access.',
                },
                {
                  q: 'Flutter SDK not receiving deferred links',
                  a: 'Ensure you call AeLinkSdk.instance.init() before runApp(). The SDK performs deferred link matching during initialization. Also check that your API key and base URL are correct.',
                },
              ].map((item) => (
                <div key={item.q} className="border-b border-slate-100 pb-4 last:border-0">
                  <p className="font-semibold text-slate-800">{item.q}</p>
                  <p className="text-slate-600 mt-1">{item.a}</p>
                </div>
              ))}
            </div>
          </DocSection>
        </main>
      </div>
    </div>
  );
}
