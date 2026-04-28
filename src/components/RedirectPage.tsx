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
      await fpResponse.json();
    } catch (err) {
      // Non-blocking — redirect should proceed even if fingerprint fails
      console.error('[SmartLink] ❌ Fingerprint collection error:', err);
    }

    setStatus('redirecting');

    // Step 2: Redirect based on platform
    if (!isMobile) {
      // Desktop — go straight to the web destination
      const webUrl = link.platformOverrides?.web?.url || link.destinationUrl;
      window.location.href = webUrl;
      setStatus('done');
      return;
    }

    // Mobile — try to open the app via deep link first.
    // If the app is installed, the intent/universal link will open it.
    // If not, after a short timeout we redirect to the store.

    if (isAndroid) {
      const appUrl = link.platformOverrides?.android?.url;
      const storeUrl =
        link.platformOverrides?.android?.fallback ||
        storeUrls.android;

      if (appUrl) {
        // Try app link — if app isn't installed, the intent will fail silently
        // and we fall back to the store after a timeout
        tryOpenApp(appUrl, storeUrl);
      } else {
        // No app deep link configured — go directly to Play Store
        window.location.href = storeUrl;
        setStatus('done');
      }
    } else if (isIOS) {
      const appUrl = link.platformOverrides?.ios?.url;
      const storeUrl =
        link.platformOverrides?.ios?.fallback ||
        storeUrls.ios;

      if (appUrl) {
        // Try universal link — if app isn't installed, fall back to store
        tryOpenApp(appUrl, storeUrl);
      } else {
        // No app deep link configured — go directly to App Store
        window.location.href = storeUrl;
        setStatus('done');
      }
    }
  };

  /**
   * Try to open the app via a deep link URL.
   * If the app is not installed the page stays visible — after a short
   * delay we redirect to the store. If the app opens, the page loses
   * focus/visibility and we skip the store redirect.
   */
  const tryOpenApp = (appUrl: string, storeUrl: string) => {
    let didLeave = false;

    const onBlur = () => { didLeave = true; };
    const onVisibilityChange = () => {
      if (document.hidden) didLeave = true;
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Attempt to open the app
    window.location.href = appUrl;

    // If we're still here after 1.5s, the app is not installed → go to store
    setTimeout(() => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);

      if (!didLeave) {
        window.location.href = storeUrl;
      }
      setStatus('done');
    }, 1500);
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
        backgroundColor: 'var(--color-bg)',
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
          backgroundColor: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          color: 'var(--color-bg)',
          fontWeight: 'bold',
          fontSize: 18,
        }}
      >
        SL
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
              stroke="var(--color-border)"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M16 3a13 13 0 0 1 13 13"
              stroke="var(--color-primary)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
      )}

      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 6px' }}>
        {status === 'loading' ? 'Preparing your link...' : 'Redirecting...'}
      </h1>

      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center' }}>
        {deviceOS === 'android' || deviceOS === 'ios'
          ? 'Taking you to the app store'
          : 'Taking you to the destination'}
      </p>

      {/* Manual fallback link */}
      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
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
            color: 'var(--color-primary)',
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
