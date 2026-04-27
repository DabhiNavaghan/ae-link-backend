'use client';

import { useEffect, useState } from 'react';

interface RedirectPageProps {
  shortCode: string;
  linkId: string;
  link: {
    destinationUrl: string;
    params?: Record<string, any>;
    platformOverrides?: {
      android?: { url: string; fallback?: string };
      ios?: { url: string; fallback?: string };
      web?: { url: string };
    };
  };
  deviceOS: 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'other';
  tenantId: string;
  clickId?: string;
  storeUrls: {
    android: string;
    ios: string;
  };
}

interface BrowserFingerprint {
  screen: { width: number; height: number };
  language: string;
  timezone: string;
  timezoneOffset: string;
  deviceMemory?: number;
  connectionType?: string;
  platform: string;
  vendor: string;
  hardwareConcurrency?: number;
  touchSupport: boolean;
  colorDepth: number;
  pixelRatio: number;
}

export default function RedirectPage({
  shortCode,
  linkId,
  link,
  deviceOS,
  tenantId,
  clickId,
  storeUrls,
}: RedirectPageProps) {
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'done'>('loading');

  useEffect(() => {
    handleRedirectFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Main redirect flow:
   * 1. Always collect fingerprint and create deferred link (for attribution)
   * 2. Then redirect to the appropriate destination
   */
  const handleRedirectFlow = async () => {
    const isAndroid = deviceOS === 'android';
    const isIOS = deviceOS === 'ios';
    const isMobile = isAndroid || isIOS;

    // Step 1: ALWAYS collect fingerprint first (even for web users)
    // This creates a DeferredLink record server-side for attribution
    const fingerprint = collectFingerprint();

    // === DEBUG: Log collected browser fingerprint ===
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[SmartLink] 🌐 BROWSER FINGERPRINT COLLECTED:');
    console.log('  screen (CSS pixels):', fingerprint.screen.width, 'x', fingerprint.screen.height);
    console.log('  pixelRatio:', fingerprint.pixelRatio);
    console.log('  physical pixels:', fingerprint.screen.width * fingerprint.pixelRatio, 'x', fingerprint.screen.height * fingerprint.pixelRatio);
    console.log('  language:', fingerprint.language);
    console.log('  timezone:', fingerprint.timezone);
    console.log('  timezoneOffset:', fingerprint.timezoneOffset);
    console.log('  platform:', fingerprint.platform);
    console.log('  vendor:', fingerprint.vendor);
    console.log('  Full data:', JSON.stringify(fingerprint, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const fpResponse = await fetch('/api/v1/fingerprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId,
          tenantId,
          clickId,
          fingerprint,
        }),
      });
      const fpResult = await fpResponse.json();

      // === DEBUG: Log what was stored in DB ===
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[SmartLink] 💾 FINGERPRINT STORED IN DB:');
      console.log(JSON.stringify(fpResult, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (err) {
      // Non-blocking — redirect should proceed even if fingerprint fails
      console.error('[SmartLink] ❌ Fingerprint collection error:', err);
    }

    setStatus('redirecting');

    // Step 2: Redirect based on platform
    if (!isMobile) {
      // Desktop/web: go to web destination
      const webUrl = link.platformOverrides?.web?.url || link.destinationUrl;
      window.location.href = webUrl;
      setStatus('done');
      return;
    }

    // Mobile: redirect to app store
    // The fingerprint + DeferredLink is already created above,
    // so the Flutter SDK will match it after install + first launch
    if (isAndroid) {
      const storeUrl =
        link.platformOverrides?.android?.fallback ||
        storeUrls.android ||
        link.destinationUrl;
      window.location.href = storeUrl;
    } else if (isIOS) {
      const storeUrl =
        link.platformOverrides?.ios?.fallback ||
        storeUrls.ios ||
        link.destinationUrl;
      window.location.href = storeUrl;
    }

    setStatus('done');
  };

  const collectFingerprint = (): BrowserFingerprint => {
    const nav = navigator as any;

    // Compute timezone offset in ±HH:MM format for cross-format matching
    const tzOffsetMin = new Date().getTimezoneOffset();
    const tzSign = tzOffsetMin <= 0 ? '+' : '-';
    const tzHours = String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(2, '0');
    const tzMins = String(Math.abs(tzOffsetMin) % 60).padStart(2, '0');
    const timezoneOffset = `${tzSign}${tzHours}:${tzMins}`;

    return {
      screen: {
        width: window.screen.width,
        height: window.screen.height,
      },
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset,
      deviceMemory: nav.deviceMemory,
      connectionType: (nav.connection || nav.mozConnection || nav.webkitConnection)
        ?.effectiveType,
      platform: navigator.platform,
      vendor: navigator.vendor,
      hardwareConcurrency: nav.hardwareConcurrency,
      touchSupport:
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        nav.msMaxTouchPoints > 0,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
    };
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: '20px',
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          color: '#fff',
          fontWeight: 'bold',
          fontSize: 18,
        }}
      >
        AE
      </div>

      {/* Spinner */}
      {status !== 'done' && (
        <div style={{ marginBottom: 16 }}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            style={{ animation: 'spin 0.8s linear infinite' }}
          >
            <circle
              cx="16"
              cy="16"
              r="13"
              stroke="#e2e8f0"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M16 3a13 13 0 0 1 13 13"
              stroke="#6366f1"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
      )}

      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1e293b', margin: '0 0 6px' }}>
        {status === 'loading' ? 'Preparing your link...' : 'Redirecting...'}
      </h1>

      <p style={{ fontSize: 14, color: '#64748b', margin: 0, textAlign: 'center' }}>
        {deviceOS === 'android' || deviceOS === 'ios'
          ? 'Taking you to the app store'
          : 'Taking you to the destination'}
      </p>

      {/* Manual fallback link */}
      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
          Not redirecting?
        </p>
        <a
          href={
            deviceOS === 'android'
              ? storeUrls.android
              : deviceOS === 'ios'
              ? storeUrls.ios
              : link.destinationUrl
          }
          style={{
            fontSize: 13,
            color: '#6366f1',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Tap here to continue
        </a>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
