'use client';

import Link from 'next/link';
import { useAuth, SignInButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import './landing.css';

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [activeLang, setActiveLang] = useState('flutter');
  const [billingMode, setBillingMode] = useState<'monthly' | 'annual'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (isSignedIn) {
      router.push('/dashboard');
    }
  }, [isSignedIn, router]);

  const toggleFaq = useCallback((idx: number) => {
    setOpenFaq((prev) => (prev === idx ? null : idx));
  }, []);

  const prices: Record<string, { monthly: string; annual: string }> = {
    hobby: { monthly: '0', annual: '0' },
    pro: { monthly: '99', annual: '79' },
    scale: { monthly: '499', annual: '399' },
  };

  const faqs = [
    {
      q: 'What counts as a "routed link"?',
      a: 'Each successful resolution of a SmartLink URL by an end user counts as one routed link. Generating links via API, dashboard previews, and bot traffic flagged by our fraud shield don\'t count.',
    },
    {
      q: 'Can I switch tiers mid-month?',
      a: 'Yes. Upgrades take effect immediately and are prorated. Downgrades take effect at the next billing cycle, and any unused credit rolls forward.',
    },
    {
      q: 'What happens if I exceed my plan limit?',
      a: 'We\'ll never block your links. You\'ll be notified at 80% usage, and overage is billed at $0.5 per 1k links above your plan -- no surprise bills, capped at 2x your monthly subscription.',
    },
    {
      q: 'Do you support migration from Branch or AppsFlyer?',
      a: 'Yes -- we provide migration scripts, parallel-run support, and dedicated engineers for Pro+ tiers. Most teams migrate in under a week with zero attribution gaps.',
    },
    {
      q: 'Is there a free trial for paid plans?',
      a: 'Pro and Scale come with a 14-day free trial -- full feature access, no credit card required. Enterprise trials are scoped during the sales conversation.',
    },
  ];

  return (
    <div className="landing">
      {/* ============= NAV ============= */}
      <header className="tl-nav">
        <div className="tl-container tl-nav-inner">
          <Link href="/" className="tl-logo">
            <span className="tl-logo-mark" />
            smartlink<span className="slash">/</span>
          </Link>
          <nav className="tl-nav-links">
            <a href="#how">How</a>
            <a href="#features">Features</a>
            <a href="#code">Devs</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="tl-nav-cta">
            <SignInButton mode="modal">
              <button className="tl-btn">Sign in</button>
            </SignInButton>
            <Link href="/sign-up" className="tl-btn tl-btn-primary">
              Start free &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* ============= HERO ============= */}
      <section className="tl-hero">
        <div className="tl-container">
          <div className="tl-hero-meta reveal d1">
            <span><span className="live-dot" /> SYS / OPERATIONAL</span>
            <span>VER / 1.0.0</span>
            <span>UPTIME / 99.998%</span>
            <span>REGION / GLOBAL</span>
          </div>

          <h1 className="reveal d1">
            <span>Route every</span><br />
            <span className="accent">tap.</span>{' '}
            <span className="stroke">Attribute</span><br />
            <span>
              every <span className="tl-magenta">install.</span>
            </span>
          </h1>

          <div className="tl-hero-row">
            <div className="reveal d3">
              <p className="tl-hero-sub">
                <strong>SmartLink</strong> is the link layer for modern apps. Deep links,
                deferred deep links, and attribution -- engineered for product teams who
                refuse to lose users between web and app.{' '}
                <strong>One SDK. Every platform. Zero dropped sessions.</strong>
              </p>
              <div className="tl-hero-actions">
                <Link href="/sign-up" className="tl-btn tl-btn-primary">
                  &rarr; Start free
                </Link>
                <a href="#code" className="tl-btn">
                  View SDK &nearr;
                </a>
                <a href="#pricing" className="tl-btn">
                  See pricing
                </a>
              </div>
            </div>

            {/* Hero terminal */}
            <div className="tl-terminal reveal d4">
              <div className="tl-terminal-bar">
                <div className="dots">
                  <span /><span /><span />
                </div>
                <div className="title">trail link &bull; routing engine</div>
                <div className="title">[ live ]</div>
              </div>
              <div className="tl-terminal-body">
                <div className="term-line">
                  <span className="term-prompt">$</span>
                  <span className="term-cmd">
                    smartlink resolve{' '}
                    <span className="term-str">&quot;trl.lk/launch&quot;</span>
                  </span>
                </div>
                <div className="term-line">
                  <span className="term-out dim">{'// resolving routes...'}</span>
                </div>
                <div className="term-line">
                  <span className="term-out">&rarr; device:</span>
                  <span className="term-key">Android 14 &middot; Pixel</span>
                </div>
                <div className="term-line">
                  <span className="term-out">&rarr; install:</span>
                  <span className="term-key">true</span>
                  <span className="term-status">DETECTED</span>
                </div>
                <div className="term-line">
                  <span className="term-out">&rarr; route:</span>
                  <span className="term-str">&quot;/events/music-fest-42&quot;</span>
                </div>
                <div className="term-line">
                  <span className="term-out">&rarr; campaign:</span>
                  <span className="term-str">&quot;summer-launch-ig&quot;</span>
                </div>
                <div className="term-line">
                  <span className="term-out">&rarr; latency:</span>
                  <span className="term-num">
                    118<span style={{ color: 'var(--tl-muted)' }}>ms</span>
                  </span>
                </div>
                <div className="term-line">
                  <span className="term-out">&rarr; status:</span>
                  <span className="term-str">200 OK</span>
                  <span className="term-status">OPENED</span>
                </div>
                <div className="term-line">
                  <span className="term-prompt">$</span>
                  <span className="cursor-blink" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============= MARQUEE ============= */}
      <div className="tl-marquee">
        <div className="tl-marquee-track">
          <span>universal links</span>
          <span>android app links</span>
          <span>deferred routing</span>
          <span>attribution</span>
          <span>fingerprint matching</span>
          <span>qr &middot; og &middot; webhooks</span>
          <span>flutter sdk</span>
          <span>universal links</span>
          <span>android app links</span>
          <span>deferred routing</span>
          <span>attribution</span>
          <span>fingerprint matching</span>
          <span>qr &middot; og &middot; webhooks</span>
          <span>flutter sdk</span>
        </div>
      </div>

      {/* ============= STATS ============= */}
      <div className="tl-stats">
        <div className="tl-container">
          <div className="tl-stats-grid">
            <div className="tl-stat">
              <div className="tl-stat-num">
                <em>118</em><span className="unit">ms</span>
              </div>
              <div className="tl-stat-label">Median resolve</div>
            </div>
            <div className="tl-stat">
              <div className="tl-stat-num">
                <em>99.99</em><span className="unit">%</span>
              </div>
              <div className="tl-stat-label">Routing accuracy</div>
            </div>
            <div className="tl-stat">
              <div className="tl-stat-num">
                <em>6</em><span className="unit">hr</span>
              </div>
              <div className="tl-stat-label">Fingerprint TTL</div>
            </div>
            <div className="tl-stat">
              <div className="tl-stat-num">
                <em>60</em><span className="unit">pt</span>
              </div>
              <div className="tl-stat-label">Match threshold</div>
            </div>
          </div>
        </div>
      </div>

      {/* ============= HOW ============= */}
      <section className="tl-section" id="how">
        <div className="tl-container">
          <div className="tl-section-head">
            <div className="tl-section-meta">
              <span className="num">01</span> // HOW IT WORKS
            </div>
            <h2 className="tl-section-title">
              Three steps. <em>No edge cases</em> left behind.
            </h2>
          </div>
          <div className="tl-steps">
            <div className="tl-step">
              <div className="tl-step-num">STEP_01 / generate</div>
              <h3 className="tl-step-title">
                Create a <em>trail</em> link.
              </h3>
              <p className="tl-step-body">
                A single URL holding your destination, fallback, campaign, and parameters.
                Generate by hand, by API, or in bulk via CSV.
              </p>
              <div className="tl-step-visual">
                <svg width="80%" height="60%" viewBox="0 0 240 80">
                  <rect x="10" y="30" width="220" height="20" fill="none" stroke="#E8EAED" strokeWidth="1" />
                  <rect x="14" y="34" width="60" height="12" fill="#C9FF3D" />
                  <text x="80" y="44" fontFamily="JetBrains Mono" fontSize="9" fill="#E8EAED">
                    trl.lk/launch
                  </text>
                  <text x="190" y="44" fontFamily="JetBrains Mono" fontSize="9" fill="#C9FF3D">
                    &#9658; ok
                  </text>
                </svg>
              </div>
            </div>
            <div className="tl-step">
              <div className="tl-step-num">STEP_02 / route</div>
              <h3 className="tl-step-title">
                Open <em>anywhere</em>, intelligently.
              </h3>
              <p className="tl-step-body">
                Tap on iOS opens the app. Android with no install? Send to store, then route
                post-install. Desktop? Web fallback.
              </p>
              <div className="tl-step-visual">
                <svg width="85%" height="75%" viewBox="0 0 240 100">
                  <circle cx="20" cy="50" r="5" fill="#C9FF3D" />
                  <path d="M 25 50 L 90 50 L 110 25 L 215 25" stroke="#7A8290" fill="none" strokeWidth="1" strokeDasharray="3 3" />
                  <path d="M 25 50 L 215 50" stroke="#7A8290" fill="none" strokeWidth="1" strokeDasharray="3 3" />
                  <path d="M 25 50 L 90 50 L 110 75 L 215 75" stroke="#7A8290" fill="none" strokeWidth="1" strokeDasharray="3 3" />
                  <rect x="216" y="20" width="14" height="10" fill="#C9FF3D" />
                  <rect x="216" y="45" width="14" height="10" fill="#C9FF3D" />
                  <rect x="216" y="70" width="14" height="10" fill="#FF3D8A" />
                  <text x="118" y="20" fontFamily="JetBrains Mono" fontSize="7" fill="#7A8290">iOS</text>
                  <text x="118" y="45" fontFamily="JetBrains Mono" fontSize="7" fill="#7A8290">ANDROID</text>
                  <text x="118" y="95" fontFamily="JetBrains Mono" fontSize="7" fill="#7A8290">WEB</text>
                </svg>
              </div>
            </div>
            <div className="tl-step">
              <div className="tl-step-num">STEP_03 / attribute</div>
              <h3 className="tl-step-title">
                Know <em>exactly</em> what worked.
              </h3>
              <p className="tl-step-body">
                Every install, click, conversion tied to its origin. Slice by campaign,
                channel, creative -- stream events to your warehouse.
              </p>
              <div className="tl-step-visual">
                <svg width="85%" height="70%" viewBox="0 0 240 100">
                  <path d="M 10 80 L 35 65 L 60 70 L 85 50 L 110 55 L 135 35 L 160 40 L 185 25 L 210 18 L 230 10" stroke="#C9FF3D" strokeWidth="1.4" fill="none" />
                  <path d="M 10 80 L 35 65 L 60 70 L 85 50 L 110 55 L 135 35 L 160 40 L 185 25 L 210 18 L 230 10 L 230 90 L 10 90 Z" fill="rgba(201, 255, 61, 0.12)" />
                  <circle cx="230" cy="10" r="3" fill="#FF3D8A" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============= FEATURES ============= */}
      <section className="tl-section" id="features">
        <div className="tl-container">
          <div className="tl-section-head">
            <div className="tl-section-meta">
              <span className="num">02</span> // FEATURES
            </div>
            <h2 className="tl-section-title">
              Everything Branch &amp; AppsFlyer do -- <em>without the bloat.</em>
            </h2>
          </div>
          <div className="tl-feat-grid">
            {/* Deferred deep links */}
            <div className="tl-feat span-6">
              <div className="tl-feat-tag">
                DEFERRED_DEEP_LINKS <span className="id">#01</span>
              </div>
              <h3>
                Survive the <em>install gap.</em>
              </h3>
              <p>
                A user clicks a link, hits the App Store, installs your app, opens it --
                and lands exactly where the link pointed. We hold their context across the
                install boundary so attribution doesn&apos;t break and onboarding doesn&apos;t
                reset.
              </p>
              <div className="tl-feat-visual">
                <svg width="100%" height="50" viewBox="0 0 400 50">
                  <text x="0" y="18" fontFamily="JetBrains Mono" fontSize="11" fill="#7A8290">
                    {'click → store → install → open → /event/87'}
                  </text>
                  <line x1="0" y1="35" x2="400" y2="35" stroke="#232831" strokeWidth="1" />
                  <rect x="16" y="31" width="8" height="8" fill="#C9FF3D" />
                  <rect x="120" y="31" width="8" height="8" fill="#C9FF3D" />
                  <rect x="220" y="31" width="8" height="8" fill="#C9FF3D" />
                  <rect x="320" y="31" width="8" height="8" fill="#C9FF3D" />
                  <rect x="386" y="29" width="12" height="12" fill="#FF3D8A" />
                </svg>
              </div>
            </div>

            {/* Universal coverage */}
            <div className="tl-feat span-6">
              <div className="tl-feat-tag">
                UNIVERSAL_COVERAGE <span className="id">#02</span>
              </div>
              <h3>
                One link. <em>Every</em> platform.
              </h3>
              <p>
                Apple Universal Links, Android App Links, custom URI schemes, and a graceful
                web fallback for everything else. We handle manifest files, AASA configs,
                and edge cases so your team ships once.
              </p>
              <div className="tl-feat-visual" style={{ gap: 16, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--tl-lime)' }}>&#9658; iOS</span>
                <span style={{ color: 'var(--tl-lime)' }}>&#9658; Android</span>
                <span style={{ color: 'var(--tl-lime)' }}>&#9658; Web</span>
                <span style={{ color: 'var(--tl-lime)' }}>&#9658; macOS</span>
                <span style={{ color: 'var(--tl-lime)' }}>&#9658; Windows</span>
              </div>
            </div>

            {/* Attribution */}
            <div className="tl-feat span-4">
              <div className="tl-feat-tag">
                ATTRIBUTION <span className="id">#03</span>
              </div>
              <h3>
                Multi-touch, in <em>real time.</em>
              </h3>
              <p>
                Every click attributed to a campaign, channel, and creative. Stream events
                into BigQuery, Snowflake, or your webhook of choice.
              </p>
              <div className="tl-feat-visual">
                <svg className="tl-spark" viewBox="0 0 300 60" preserveAspectRatio="none">
                  <path className="area" d="M 0 50 L 30 42 L 60 38 L 90 28 L 120 32 L 150 18 L 180 22 L 210 12 L 240 14 L 270 8 L 300 10 L 300 60 L 0 60 Z" />
                  <path d="M 0 50 L 30 42 L 60 38 L 90 28 L 120 32 L 150 18 L 180 22 L 210 12 L 240 14 L 270 8 L 300 10" />
                </svg>
              </div>
            </div>

            {/* Fingerprint matching */}
            <div className="tl-feat span-4">
              <div className="tl-feat-tag">
                FINGERPRINT <span className="id">#04</span>
              </div>
              <h3>
                <em>Subnet</em> IP matching.
              </h3>
              <p>
                No cookies, no ad IDs. Match users across web-to-app with IP subnet,
                screen resolution, timezone, and locale signals. CGNAT-aware.
              </p>
              <div className="tl-feat-visual">
                <svg width="80%" height="60" viewBox="0 0 200 60">
                  <polygon points="100,5 175,30 100,55 25,30" fill="none" stroke="#7A8290" strokeWidth="1" />
                  <polygon points="100,15 160,30 100,45 40,30" fill="none" stroke="#FFB84D" strokeWidth="1" />
                  <rect x="94" y="24" width="12" height="12" fill="#C9FF3D" />
                </svg>
              </div>
            </div>

            {/* Campaign tracking */}
            <div className="tl-feat span-4">
              <div className="tl-feat-tag">
                CAMPAIGNS <span className="id">#05</span>
              </div>
              <h3>
                Track <em>every</em> channel.
              </h3>
              <p>
                Group links into campaigns. Track attribution across email, social, SMS,
                and paid channels with real-time conversion data.
              </p>
              <div className="tl-feat-visual">
                <svg width="100%" height="60" viewBox="0 0 240 60">
                  <rect x="14" y="26" width="10" height="10" fill="#C9FF3D" />
                  <line x1="28" y1="30" x2="100" y2="15" stroke="#4A5061" strokeDasharray="3 3" />
                  <line x1="28" y1="30" x2="100" y2="30" stroke="#4A5061" strokeDasharray="3 3" />
                  <line x1="28" y1="30" x2="100" y2="45" stroke="#4A5061" strokeDasharray="3 3" />
                  <text x="106" y="18" fontFamily="JetBrains Mono" fontSize="9" fill="#B8BDC7">email &middot; 42%</text>
                  <text x="106" y="33" fontFamily="JetBrains Mono" fontSize="9" fill="#B8BDC7">social &middot; 35%</text>
                  <text x="106" y="48" fontFamily="JetBrains Mono" fontSize="9" fill="#B8BDC7">sms &middot; 23%</text>
                </svg>
              </div>
            </div>

            {/* Developer DX */}
            <div className="tl-feat span-8">
              <div className="tl-feat-tag">
                DEVELOPER_DX <span className="id">#06</span>
              </div>
              <h3>
                SDKs that don&apos;t <em>fight you.</em>
              </h3>
              <p>
                Flutter SDK with separated callbacks for direct and deferred deep links.
                Five lines to install, one method to handle a route. Open source, semver
                discipline, no surprise breaking changes.
              </p>
              <div className="tl-feat-visual" style={{ gap: 24, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--tl-cyan)' }}>[flutter]</span>
                <span style={{ color: 'var(--tl-cyan)' }}>[swift]</span>
                <span style={{ color: 'var(--tl-cyan)' }}>[kotlin]</span>
                <span style={{ color: 'var(--tl-cyan)' }}>[react-native]</span>
                <span style={{ color: 'var(--tl-cyan)' }}>[js / ts]</span>
              </div>
            </div>

            {/* Real-time analytics */}
            <div className="tl-feat span-4">
              <div className="tl-feat-tag">
                ANALYTICS <span className="id">#07</span>
              </div>
              <h3>
                <em>Real-time</em> conversions.
              </h3>
              <p>
                Track clicks, installs, conversions, and match scores. Know exactly which
                links drive results with live dashboard.
              </p>
              <div className="tl-feat-visual">
                <svg width="85%" height="70%" viewBox="0 0 240 100">
                  <path d="M 10 80 L 35 65 L 60 70 L 85 50 L 110 55 L 135 35 L 160 40 L 185 25 L 210 18 L 230 10" stroke="#C9FF3D" strokeWidth="1.4" fill="none" />
                  <path d="M 10 80 L 35 65 L 60 70 L 85 50 L 110 55 L 135 35 L 160 40 L 185 25 L 210 18 L 230 10 L 230 90 L 10 90 Z" fill="rgba(201, 255, 61, 0.12)" />
                  <circle cx="230" cy="10" r="3" fill="#FF3D8A" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============= CODE DEMO ============= */}
      <section className="tl-section" id="code">
        <div className="tl-container">
          <div className="tl-section-head">
            <div className="tl-section-meta">
              <span className="num">03</span> // FOR DEVELOPERS
            </div>
            <h2 className="tl-section-title">
              Five lines to <em>install.</em>
              <br />
              One method to <em>route.</em>
            </h2>
          </div>
          <div className="tl-code-grid">
            <div className="tl-code-copy">
              <p>
                Drop-in Flutter SDK with separated callbacks for direct and deferred deep
                links. Open source, no vendor lock-in.
              </p>
              <Link href="/sign-up" className="tl-btn tl-btn-primary">
                &rarr; Browse SDK reference
              </Link>
            </div>
            <div>
              <div className="tl-lang-tabs">
                <button
                  className={activeLang === 'flutter' ? 'active' : ''}
                  onClick={() => setActiveLang('flutter')}
                >
                  flutter
                </button>
                <button
                  className={activeLang === 'js' ? 'active' : ''}
                  onClick={() => setActiveLang('js')}
                >
                  javascript
                </button>
                <button
                  className={activeLang === 'kotlin' ? 'active' : ''}
                  onClick={() => setActiveLang('kotlin')}
                >
                  kotlin
                </button>
                <button
                  className={activeLang === 'swift' ? 'active' : ''}
                  onClick={() => setActiveLang('swift')}
                >
                  swift
                </button>
              </div>
              <div className="tl-code-block">
                {/* Flutter */}
                <div className={`tl-code-pane ${activeLang === 'flutter' ? 'active' : ''}`}>
                  <pre>
                    <span className="ln">01</span>
                    <span className="kw">final</span> <span className="var">sdk</span> = <span className="fn">SmartLinkSdk</span>();{'\n'}
                    <span className="ln">02</span>{'\n'}
                    <span className="ln">03</span>
                    <span className="com">{'// initialize with separated callbacks'}</span>{'\n'}
                    <span className="ln">04</span>
                    <span className="kw">await</span> <span className="var">sdk</span>.<span className="fn">initialize</span>({'{'}{'\n'}
                    <span className="ln">05</span>
                    {'  '}<span className="pn">apiKey</span>: <span className="str">&apos;sk_live_...&apos;</span>,{'\n'}
                    <span className="ln">06</span>
                    {'  '}<span className="pn">onDeepLink</span>: (<span className="var">data</span>) {'{'}{'\n'}
                    <span className="ln">07</span>
                    {'    '}<span className="com">{'// direct deep link (app installed)'}</span>{'\n'}
                    <span className="ln">08</span>
                    {'    '}<span className="fn">navigate</span>(<span className="var">data</span>.<span className="pn">path</span>);{'\n'}
                    <span className="ln">09</span>
                    {'  }'},{'\n'}
                    <span className="ln">10</span>
                    {'  '}<span className="pn">onDeferredDeepLink</span>: (<span className="var">data</span>) {'{'}{'\n'}
                    <span className="ln">11</span>
                    {'    '}<span className="com">{'// deferred (post-install match)'}</span>{'\n'}
                    <span className="ln">12</span>
                    {'    '}<span className="fn">navigate</span>(<span className="var">data</span>.<span className="pn">path</span>);{'\n'}
                    <span className="ln">13</span>
                    {'  }'},{'\n'}
                    <span className="ln">14</span>
                    {'}'});
                  </pre>
                </div>

                {/* JavaScript */}
                <div className={`tl-code-pane ${activeLang === 'js' ? 'active' : ''}`}>
                  <pre>
                    <span className="ln">01</span>
                    <span className="kw">import</span> <span className="var">{'{ smartlink }'}</span> <span className="kw">from</span> <span className="str">&apos;@smartlink/sdk&apos;</span>{'\n'}
                    <span className="ln">02</span>{'\n'}
                    <span className="ln">03</span>
                    <span className="com">{'// create a link with deferred routing'}</span>{'\n'}
                    <span className="ln">04</span>
                    <span className="kw">const</span> <span className="var">link</span> = <span className="kw">await</span> <span className="fn">smartlink.create</span>({'{'}{'\n'}
                    <span className="ln">05</span>
                    {'  '}<span className="pn">destination</span>: <span className="str">&apos;/events/music-fest-42&apos;</span>,{'\n'}
                    <span className="ln">06</span>
                    {'  '}<span className="pn">fallback</span>:{'    '}<span className="str">&apos;https://allevents.in&apos;</span>,{'\n'}
                    <span className="ln">07</span>
                    {'  '}<span className="pn">campaign</span>:{'    '}<span className="str">&apos;summer-launch-ig&apos;</span>,{'\n'}
                    <span className="ln">08</span>
                    {'  '}<span className="pn">defer</span>:{'       '}<span className="kw">true</span>,{'\n'}
                    <span className="ln">09</span>
                    {'})'}{'\n'}
                    <span className="ln">10</span>{'\n'}
                    <span className="ln">11</span>
                    <span className="fn">console.log</span>(<span className="var">link</span>.<span className="pn">url</span>) <span className="com">{'// → trl.lk/8aB3z'}</span>
                  </pre>
                </div>

                {/* Kotlin */}
                <div className={`tl-code-pane ${activeLang === 'kotlin' ? 'active' : ''}`}>
                  <pre>
                    <span className="ln">01</span>
                    <span className="kw">import</span> <span className="var">io.smartlink.sdk.TrailLink</span>{'\n'}
                    <span className="ln">02</span>{'\n'}
                    <span className="ln">03</span>
                    <span className="com">{'// in your Application onCreate'}</span>{'\n'}
                    <span className="ln">04</span>
                    <span className="var">TrailLink</span>.<span className="fn">init</span>(<span className="kw">this</span>, <span className="str">&quot;sk_live_...&quot;</span>){'\n'}
                    <span className="ln">05</span>{'\n'}
                    <span className="ln">06</span>
                    <span className="var">TrailLink</span>.<span className="fn">onRoute</span> {'{'} <span className="var">route</span> -&gt;{'\n'}
                    <span className="ln">07</span>
                    {'  '}<span className="var">navController</span>.<span className="fn">navigate</span>(<span className="var">route</span>.<span className="pn">path</span>){'\n'}
                    <span className="ln">08</span>
                    {'  '}<span className="var">analytics</span>.<span className="fn">track</span>(<span className="str">&quot;link_opened&quot;</span>, <span className="var">route</span>.<span className="pn">params</span>){'\n'}
                    <span className="ln">09</span>
                    {'}'}
                  </pre>
                </div>

                {/* Swift */}
                <div className={`tl-code-pane ${activeLang === 'swift' ? 'active' : ''}`}>
                  <pre>
                    <span className="ln">01</span>
                    <span className="kw">import</span> <span className="var">TrailLink</span>{'\n'}
                    <span className="ln">02</span>{'\n'}
                    <span className="ln">03</span>
                    <span className="com">{'// in your AppDelegate or SceneDelegate'}</span>{'\n'}
                    <span className="ln">04</span>
                    <span className="fn">TrailLink.shared.handle</span>(<span className="var">url</span>) {'{'} <span className="var">route</span> <span className="kw">in</span>{'\n'}
                    <span className="ln">05</span>
                    {'  '}<span className="kw">guard let</span> <span className="var">path</span> = <span className="var">route</span>.<span className="pn">path</span> <span className="kw">else</span> {'{'} <span className="kw">return</span> {'}'}{'\n'}
                    <span className="ln">06</span>
                    {'  '}<span className="var">router</span>.<span className="fn">navigate</span>({'\n'}
                    <span className="ln">07</span>
                    {'    '}<span className="pn">to</span>: <span className="var">path</span>,{'\n'}
                    <span className="ln">08</span>
                    {'    '}<span className="pn">params</span>: <span className="var">route</span>.<span className="pn">params</span>{'\n'}
                    <span className="ln">09</span>
                    {'  )}'}{'\n'}
                    <span className="ln">10</span>
                    {'}'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============= PRICING ============= */}
      <section className="tl-section" id="pricing">
        <div className="tl-container">
          <div className="tl-section-head">
            <div className="tl-section-meta">
              <span className="num">04</span> // PRICING
            </div>
            <div>
              <h2 className="tl-section-title">
                Pay for <em>links routed.</em>
                <br />
                Not for <span className="stroke">seats.</span>
              </h2>
              <div style={{ marginTop: 28, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="tl-pricing-toggle">
                  <button
                    className={billingMode === 'monthly' ? 'active' : ''}
                    onClick={() => setBillingMode('monthly')}
                  >
                    Monthly
                  </button>
                  <button
                    className={billingMode === 'annual' ? 'active' : ''}
                    onClick={() => setBillingMode('annual')}
                  >
                    Annual <span className="save">&minus;20%</span>
                  </button>
                </div>
                <span style={{
                  fontFamily: 'var(--tl-mono)',
                  fontSize: 12,
                  color: 'var(--tl-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}>
                  // usd &middot; billed automatically
                </span>
              </div>
            </div>
          </div>

          <div className="tl-price-grid">
            {/* HOBBY */}
            <div className="tl-tier">
              <div className="tl-tier-name">[ hobby ]</div>
              <div className="tl-tier-tagline">Personal projects, side experiments, weekend hacks.</div>
              <div className="tl-tier-price">
                <span className="currency">$</span>
                <span>{prices.hobby[billingMode]}</span>
                <span className="period">/mo</span>
              </div>
              <div className="tl-tier-billed">Free forever</div>
              <Link href="/sign-up" className="tl-tier-cta">Start free &rarr;</Link>
              <div className="tl-tier-divider">includes</div>
              <ul className="tl-tier-features">
                <li><strong>10K</strong> routed links / month</li>
                <li>Universal &amp; App Links</li>
                <li>Web fallbacks</li>
                <li>1 SDK platform</li>
                <li>Basic attribution (7-day)</li>
                <li>Community support</li>
                <li className="muted">Deferred deep links</li>
                <li className="muted">Fraud shield</li>
              </ul>
            </div>

            {/* PRO */}
            <div className="tl-tier featured">
              <div className="tl-tier-name">[ pro ]</div>
              <div className="tl-tier-tagline">Growing apps that need real attribution and DDLs.</div>
              <div className="tl-tier-price">
                <span className="currency">$</span>
                <span>{prices.pro[billingMode]}</span>
                <span className="period">{billingMode === 'annual' ? '/mo*' : '/mo'}</span>
              </div>
              <div className="tl-tier-billed">
                {billingMode === 'annual'
                  ? 'Billed $948/yr · save $240'
                  : 'Billed monthly · cancel anytime'}
              </div>
              <Link href="/sign-up" className="tl-tier-cta">Start 14-day trial &rarr;</Link>
              <div className="tl-tier-divider">everything in hobby, plus</div>
              <ul className="tl-tier-features">
                <li><strong>250K</strong> routed links / month</li>
                <li><strong>Deferred deep links</strong></li>
                <li>Full attribution (90-day)</li>
                <li>All SDK platforms</li>
                <li>QR + OG previews</li>
                <li>Webhooks &amp; warehouse export</li>
                <li>Email support &middot; 24h SLA</li>
                <li className="muted">Fraud shield (ML)</li>
              </ul>
            </div>

            {/* SCALE */}
            <div className="tl-tier">
              <div className="tl-tier-name">[ scale ]</div>
              <div className="tl-tier-tagline">High-volume apps with serious attribution needs.</div>
              <div className="tl-tier-price">
                <span className="currency">$</span>
                <span>{prices.scale[billingMode]}</span>
                <span className="period">{billingMode === 'annual' ? '/mo*' : '/mo'}</span>
              </div>
              <div className="tl-tier-billed">
                {billingMode === 'annual'
                  ? 'Billed $4788/yr · save $1200'
                  : 'Billed monthly · cancel anytime'}
              </div>
              <Link href="/sign-up" className="tl-tier-cta">Start scaling &rarr;</Link>
              <div className="tl-tier-divider">everything in pro, plus</div>
              <ul className="tl-tier-features">
                <li><strong>2M</strong> routed links / month</li>
                <li><strong>Fraud shield</strong> (ML-driven)</li>
                <li>Custom subdomains + SSL</li>
                <li>Multi-touch attribution</li>
                <li>Real-time event streaming</li>
                <li>Priority support &middot; 4h SLA</li>
                <li>99.95% uptime SLA</li>
              </ul>
            </div>

            {/* ENTERPRISE */}
            <div className="tl-tier">
              <div className="tl-tier-name">[ enterprise ]</div>
              <div className="tl-tier-tagline">Custom infra for fintech, gaming, and global retail.</div>
              <div className="tl-tier-price custom">Custom</div>
              <div className="tl-tier-billed">Annual contracts &middot; MSA</div>
              <a href="#" className="tl-tier-cta">Talk to sales &rarr;</a>
              <div className="tl-tier-divider">everything in scale, plus</div>
              <ul className="tl-tier-features">
                <li><strong>Unlimited</strong> routed links</li>
                <li>Dedicated infrastructure</li>
                <li>SOC 2 Type II + HIPAA</li>
                <li>On-prem / VPC deployment</li>
                <li>Custom data residency</li>
                <li>Dedicated CSM</li>
                <li>99.99% uptime SLA</li>
                <li>White-label options</li>
              </ul>
            </div>
          </div>

          <div className="tl-price-footnote">
            <span>10k links free, every month, forever</span>
            <span>No credit card to start</span>
            <span>Cancel anytime, prorated</span>
            <span>GDPR + CCPA compliant</span>
          </div>

          {/* FAQ */}
          <div className="tl-faq">
            <div className="tl-faq-grid">
              <div>
                <div className="tl-section-meta" style={{ marginBottom: 16 }}>
                  <span className="num">04.1</span> // FAQ
                </div>
                <h3 style={{
                  fontFamily: 'var(--tl-display)',
                  fontWeight: 600,
                  fontSize: 32,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  textTransform: 'uppercase',
                }}>
                  Common <em style={{ fontStyle: 'normal', color: 'var(--tl-lime)' }}>questions.</em>
                </h3>
              </div>
              <div className="tl-faq-list">
                {faqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className={`tl-faq-item ${openFaq === idx ? 'open' : ''}`}
                    onClick={() => toggleFaq(idx)}
                  >
                    <div className="tl-faq-q">
                      {faq.q}
                      <span className="toggle">{openFaq === idx ? '−' : '+'}</span>
                    </div>
                    <div className="tl-faq-a">{faq.a}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============= CTA ============= */}
      <section className="tl-cta">
        <div className="tl-container">
          <h2>
            Ship a smarter <em>link</em>
            <br />
            <span className="stroke">today.</span>
          </h2>
          <p>
            10,000 routes free, every month, forever. No card. No sales call. No SDK lock-in.
          </p>
          <div className="tl-cta-actions">
            <Link href="/sign-up" className="tl-btn tl-btn-primary">
              &rarr; Start free
            </Link>
            <a href="#" className="tl-btn">
              Talk to engineering
            </a>
          </div>
        </div>
      </section>

      {/* ============= FOOTER ============= */}
      <footer className="tl-footer">
        <div className="tl-container">
          <div className="tl-footer-grid">
            <div className="tl-footer-brand">
              <a href="#" className="tl-logo">
                <span className="tl-logo-mark" />
                smartlink<span className="slash">/</span>
              </a>
              <p>The link layer for modern apps. Built by AllEvents.</p>
              <div className="tl-system-status">All systems operational</div>
            </div>
            <div className="tl-footer-col">
              <h4>// product</h4>
              <ul>
                <li><a href="#features">Deep links</a></li>
                <li><a href="#features">Deferred routing</a></li>
                <li><a href="#features">Attribution</a></li>
                <li><a href="#pricing">Pricing</a></li>
              </ul>
            </div>
            <div className="tl-footer-col">
              <h4>// developers</h4>
              <ul>
                <li><a href="#code">SDK reference</a></li>
                <li><a href="#">API status</a></li>
                <li><a href="#">Changelog</a></li>
                <li><a href="#">GitHub &nearr;</a></li>
              </ul>
            </div>
            <div className="tl-footer-col">
              <h4>// company</h4>
              <ul>
                <li><a href="https://allevents.in" target="_blank" rel="noopener noreferrer">AllEvents</a></li>
                <li><a href="#">About</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
            <div className="tl-footer-col">
              <h4>// resources</h4>
              <ul>
                <li><a href="#">Migration guide</a></li>
                <li><a href="#">vs. Branch</a></li>
                <li><a href="#">vs. AppsFlyer</a></li>
                <li><a href="#">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="tl-footer-bottom">
            <span>&copy; {new Date().getFullYear()} AllEvents, Inc. All rights reserved.</span>
            <div className="links">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Security</a>
            </div>
          </div>
        </div>
        <div className="tl-footer-glyph">smartlink</div>
      </footer>
    </div>
  );
}
