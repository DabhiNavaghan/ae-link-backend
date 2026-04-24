'use client';

import Link from 'next/link';
import { useAuth, SignInButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const FEATURES = [
  {
    title: 'Deferred deep links',
    desc: 'Users click a link, install the app, and land on the exact content — no context lost.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    title: 'Fingerprint matching',
    desc: 'No cookies, no ad IDs. Match users across web-to-app with IP, screen, timezone, and locale signals.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.864 4.243A17.888 17.888 0 0112 3c4.222 0 7.964 1.647 10.092 4.243M12 12a3 3 0 100-6 3 3 0 000 6zm0 0v9" />
      </svg>
    ),
  },
  {
    title: 'Real-time analytics',
    desc: 'Track clicks, installs, conversions, and match scores. Know exactly which links drive results.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    title: 'Campaign tracking',
    desc: 'Group links into campaigns. Track attribution across email, social, SMS, and paid channels.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
  },
  {
    title: 'Multi-app support',
    desc: 'Register multiple Android and iOS apps. Each link routes to the right store automatically.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
  },
  {
    title: 'Flutter SDK',
    desc: 'Drop-in SDK for Flutter apps. One service file handles everything — init, matching, and routing.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
];

const STEPS = [
  { step: '1', title: 'Create a link', desc: 'Add your destination URL, event params, and UTM tracking in the dashboard.' },
  { step: '2', title: 'Share anywhere', desc: 'Put the short link in emails, social posts, SMS, ads, or QR codes.' },
  { step: '3', title: 'User clicks', desc: 'SmartLink detects the platform, collects a fingerprint, and redirects to the app store.' },
  { step: '4', title: 'App opens with context', desc: 'After install, the SDK matches the fingerprint and delivers the original link data to your app.' },
];

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) {
      router.push('/dashboard');
    }
  }, [isSignedIn, router]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* ─── Nav ─── */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(248, 250, 252, 0.9)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 logo-gradient rounded-xl flex items-center justify-center text-white font-bold text-base">
              SL
            </div>
            <span className="text-xl font-bold font-heading">
              Smart<span className="font-normal">Link</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SignInButton mode="modal">
              <button className="px-4 py-2 text-sm font-medium rounded-lg transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
                Sign in
              </button>
            </SignInButton>
            <Link
              href="/sign-up"
              className="px-4 py-2 text-sm font-medium text-white rounded-lg logo-gradient transition-opacity hover:opacity-90"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
          <span className="w-1.5 h-1.5 rounded-full logo-gradient"></span>
          Deep linking for mobile apps
        </div>

        <h1 className="text-5xl md:text-6xl font-bold font-heading tracking-tight leading-tight mb-6">
          Every click finds<br />
          <span className="text-gradient">its way home</span>
        </h1>

        <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          SmartLink bridges the gap between web and app. Create short links that survive
          the install boundary — delivering users to the right screen, every time.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="px-8 py-3 text-base font-semibold text-white rounded-xl logo-gradient transition-opacity hover:opacity-90 shadow-lg"
          >
            Start for free
          </Link>
          <Link
            href="#how-it-works"
            className="px-8 py-3 text-base font-medium rounded-xl transition-colors"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            See how it works
          </Link>
        </div>

        {/* Hero visual */}
        <div className="mt-16 max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl" style={{ border: '1px solid var(--color-border)' }}>
          <div className="p-1 logo-gradient">
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <span className="text-xs font-mono ml-4" style={{ color: 'var(--color-text-tertiary)' }}>smartlink.vercel.app/dashboard</span>
              </div>
              <div className="px-8 py-12 text-center">
                <p className="text-3xl font-bold font-heading mb-2">📊 Dashboard</p>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Links, campaigns, analytics, and SDK integration — all in one place</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold font-heading mb-4">Everything you need for app attribution</h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
            From link creation to conversion tracking — SmartLink handles the full journey.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-xl transition-all duration-200 hover:shadow-md"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                {f.icon}
              </div>
              <h3 className="text-base font-semibold font-heading mb-2">{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how-it-works" className="py-20" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-heading mb-4">How SmartLink works</h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
              Four steps from click to in-app content — even through an app install.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 logo-gradient rounded-2xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="text-base font-semibold font-heading mb-2">{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">
          Ready to connect your links to your app?
        </h2>
        <p className="text-lg mb-10 max-w-lg mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
          Set up in minutes. No credit card required.
        </p>
        <Link
          href="/sign-up"
          className="px-8 py-3 text-base font-semibold text-white rounded-xl logo-gradient transition-opacity hover:opacity-90 shadow-lg"
        >
          Get started free
        </Link>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 logo-gradient rounded-lg flex items-center justify-center text-white font-bold text-xs">
              SL
            </div>
            <span className="text-sm font-heading font-medium">SmartLink</span>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>by AllEvents</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            &copy; {new Date().getFullYear()} AllEvents. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
