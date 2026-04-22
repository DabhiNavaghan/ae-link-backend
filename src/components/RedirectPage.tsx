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

interface FingerprintData {
  screen: { width: number; height: number };
  language: string;
  timezone: string;
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
  const [redirected, setRedirected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const attemptDeepLink = async () => {
      const isAndroid = deviceOS === 'android';
      const isIOS = deviceOS === 'ios';
      const isMobile = isAndroid || isIOS;

      if (!isMobile) {
        // Direct redirect to web destination
        const webUrl = link.platformOverrides?.web?.url || link.destinationUrl;
        window.location.href = webUrl;
        setRedirected(true);
        return;
      }

      // Mobile: try to open via deep link first
      if (isAndroid && link.platformOverrides?.android?.url) {
        const appUrl = link.platformOverrides.android.url;
        const intentUrl = `intent://${appUrl}#Intent;scheme=https;end`;

        // Create iframe to trigger intent
        const iframe = document.createElement('iframe');
        iframe.src = intentUrl;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        // Set timeout to fallback
        const timeoutId = setTimeout(() => {
          collectFingerprintAndRedirect();
        }, 2500);

        return () => clearTimeout(timeoutId);
      }

      if (isIOS && link.platformOverrides?.ios?.url) {
        const appUrl = link.platformOverrides.ios.url;

        const iframe = document.createElement('iframe');
        iframe.src = appUrl;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const timeoutId = setTimeout(() => {
          collectFingerprintAndRedirect();
        }, 2500);

        return () => clearTimeout(timeoutId);
      }

      // Fallback: collect fingerprint and redirect to store
      collectFingerprintAndRedirect();
    };

    const collectFingerprintAndRedirect = async () => {
      try {
        const fingerprint = collectFingerprint();

        // Send fingerprint to backend (creates fingerprint + deferred link)
        try {
          await fetch('/api/v1/fingerprint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              linkId,
              tenantId,
              clickId,
              fingerprint,
            }),
          });
        } catch (err) {
          console.error('Fingerprint error:', err);
        }

        // Redirect to the appropriate app store
        const fallbackUrl =
          (deviceOS === 'android'
            ? link.platformOverrides?.android?.fallback || storeUrls.android
            : link.platformOverrides?.ios?.fallback || storeUrls.ios) ||
          link.destinationUrl;

        window.location.href = fallbackUrl;
        setRedirected(true);
      } catch (err) {
        console.error('Redirect error:', err);
        window.location.href = link.destinationUrl;
        setRedirected(true);
      }
    };

    attemptDeepLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const collectFingerprint = (): FingerprintData => {
    const nav = navigator as any;

    return {
      screen: {
        width: window.screen.width,
        height: window.screen.height,
      },
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      deviceMemory: nav.deviceMemory,
      connectionType: (nav.connection || nav.mozConnection || nav.webkitConnection)
        ?.effectiveType,
      platform: navigator.platform,
      vendor: navigator.vendor,
      hardwareConcurrency: nav.hardwareConcurrency,
      touchSupport: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (nav.msMaxTouchPoints > 0),
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
        backgroundColor: '#f5f5f5',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {!redirected && (
        <>
          <div
            style={{
              animation: 'spin 1s linear infinite',
              marginBottom: '20px',
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              stroke="#FF6B35"
              strokeWidth="3"
            >
              <circle cx="24" cy="24" r="20" />
            </svg>
          </div>
          <h1 style={{ fontSize: '24px', marginBottom: '8px', color: '#333' }}>
            Opening AllEvents
          </h1>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
            Please wait...
          </p>
          <p
            style={{
              fontSize: '12px',
              color: '#999',
              marginTop: '40px',
              maxWidth: '300px',
              textAlign: 'center',
            }}
          >
            If the app doesn&apos;t open, you&apos;ll be redirected to the App Store.
          </p>
        </>
      )}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
