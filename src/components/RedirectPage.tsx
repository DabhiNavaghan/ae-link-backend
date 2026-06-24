'use client';

import { useEffect, useState } from 'react';

/**
 * Append UTM params (and App Store ct/pt/mt) to a store URL.
 * Play Store: encodes utm_* into the `referrer` param.
 * App Store:  adds utm_* + ct/pt/mt directly as query params.
 */
function appendStoreParams(
  baseUrl: string,
  params: Record<string, any> | undefined,
  isIos: boolean,
): string {
  if (!params) return baseUrl;
  const { utmSource, utmMedium, utmCampaign, utmTerm, utmContent, ct, pt, mt } = params;
  const hasUtm = utmSource || utmMedium || utmCampaign || utmTerm || utmContent;
  const hasStore = ct || pt;
  if (!hasUtm && !hasStore) return baseUrl;
  try {
    const url = new URL(baseUrl);
    if (isIos) {
      if (utmSource) url.searchParams.set('utm_source', utmSource);
      if (utmMedium) url.searchParams.set('utm_medium', utmMedium);
      if (utmCampaign) url.searchParams.set('utm_campaign', utmCampaign);
      if (utmTerm) url.searchParams.set('utm_term', utmTerm);
      if (utmContent) url.searchParams.set('utm_content', utmContent);
      if (ct) url.searchParams.set('ct', ct);
      if (pt) url.searchParams.set('pt', pt);
      url.searchParams.set('mt', mt || '8');
    } else {
      // Play Store expects utm params inside the `referrer` query param (URL-encoded)
      const ref = new URLSearchParams();
      if (utmSource) ref.set('utm_source', utmSource);
      if (utmMedium) ref.set('utm_medium', utmMedium);
      if (utmCampaign) ref.set('utm_campaign', utmCampaign);
      if (utmTerm) ref.set('utm_term', utmTerm);
      if (utmContent) ref.set('utm_content', utmContent);
      const refStr = ref.toString();
      if (refStr) url.searchParams.set('referrer', refStr);
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}

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

const AE_RED = '#E8344E';
const AE_BG = '#FFFFFF';

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

  const handleRedirectFlow = () => {
    const isAndroid = deviceOS === 'android';
    const isIOS = deviceOS === 'ios';
    const isMobile = isAndroid || isIOS;

    // Fire fingerprint in background — but ONLY for mobile users.
    // Desktop users don't install apps, so creating deferred links for
    // them causes false-positive matches when they later open the app
    // on the same network (shared IP → inflated install count).
    // sendBeacon guarantees delivery even during page unload.
    if (isMobile) {
      try {
        const fingerprint = collectFingerprint();
        const payload = JSON.stringify({
          linkId,
          tenantId,
          clickId,
          fingerprint,
          mergedDestinationUrl: link.destinationUrl || undefined,
          mergedParams: link.params || undefined,
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/v1/fingerprint', new Blob([payload], { type: 'application/json' }));
        } else {
          fetch('/api/v1/fingerprint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch (err) {
        console.error('[SmartLink] Fingerprint collection error:', err);
      }
    }

    // Redirect immediately — no waiting
    setStatus('redirecting');

    if (!isMobile) {
      const webUrl = link.platformOverrides?.web?.url || link.destinationUrl;
      if (webUrl) {
        window.location.replace(webUrl);
      } else {
        const fallbackStore = storeUrls.android || storeUrls.ios;
        if (fallbackStore) window.location.replace(fallbackStore);
      }
      setStatus('done');
      return;
    }

    if (isAndroid) {
      const rawStoreUrl =
        link.platformOverrides?.android?.fallback ||
        storeUrls.android;
      const storeUrl = appendStoreParams(rawStoreUrl, link.params, false);

      // Only attempt to open the app if we have an explicit app scheme URL
      // (e.g. intent://, allevents://, myapp://).
      // NEVER pass a regular https:// URL to tryOpenApp — the browser will
      // navigate to it, blur fires, and we falsely think the app opened.
      // The user then never reaches the Play Store.
      const appUrl = link.platformOverrides?.android?.url;
      const isAppScheme = appUrl && !appUrl.startsWith('http');

      if (isAppScheme) {
        tryOpenApp(appUrl, storeUrl);
      } else {
        // No app scheme configured → go straight to store.
        // The fingerprint + deferred link will handle deep linking
        // after install via the Flutter SDK match flow.
        window.location.replace(storeUrl);
        setStatus('done');
      }
    } else if (isIOS) {
      const rawStoreUrl =
        link.platformOverrides?.ios?.fallback ||
        storeUrls.ios;
      const storeUrl = appendStoreParams(rawStoreUrl, link.params, true);

      // Same logic: only try app scheme URLs, not https:// web URLs.
      const appUrl = link.platformOverrides?.ios?.url;
      const isAppScheme = appUrl && !appUrl.startsWith('http');

      if (isAppScheme) {
        tryOpenApp(appUrl, storeUrl);
      } else {
        window.location.replace(storeUrl);
        setStatus('done');
      }
    }
  };

  const tryOpenApp = (appUrl: string, storeUrl: string) => {
    let didLeave = false;
    let patchSent = false;

    // Send app_opened PATCH as soon as we detect the user left the page.
    // Uses sendBeacon for reliability — on mobile the browser may kill the
    // page the instant the OS switches to the native app.
    const sendAppOpenedPatch = () => {
      if (patchSent || !clickId) return;
      patchSent = true;
      const payload = JSON.stringify({ clickId, action: 'app_opened' });
      // sendBeacon is fire-and-forget; the browser guarantees delivery
      // even if the page is being unloaded.
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/v1/clicks', blob);
      } else {
        fetch('/api/v1/clicks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    const onBlur = () => {
      didLeave = true;
      sendAppOpenedPatch();
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        didLeave = true;
        sendAppOpenedPatch();
      }
    };
    const onPageHide = () => {
      didLeave = true;
      sendAppOpenedPatch();
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    window.location.href = appUrl;

    // Fallback: if the app didn't open (no blur/visibility change after
    // 1s), redirect to the store instead. Modern phones switch within
    // ~300ms if the app is installed, so 1s is a safe threshold.
    setTimeout(() => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);

      if (!didLeave) {
        window.location.replace(storeUrl);
      }
      setStatus('done');
    }, 1000);
  };

  const collectFingerprint = (): BrowserFingerprint => {
    const nav = navigator as any;
    const tzOffsetMin = new Date().getTimezoneOffset();
    const tzSign = tzOffsetMin <= 0 ? '+' : '-';
    const tzHours = String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(2, '0');
    const tzMins = String(Math.abs(tzOffsetMin) % 60).padStart(2, '0');
    const timezoneOffset = `${tzSign}${tzHours}:${tzMins}`;

    return {
      screen: { width: window.screen.width, height: window.screen.height },
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset,
      deviceMemory: nav.deviceMemory,
      connectionType: (nav.connection || nav.mozConnection || nav.webkitConnection)?.effectiveType,
      platform: navigator.platform,
      vendor: navigator.vendor,
      hardwareConcurrency: nav.hardwareConcurrency,
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0 || nav.msMaxTouchPoints > 0,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
    };
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: AE_BG,
    }}>
      {/* Three bouncing dots */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: AE_RED, animation: 'bounce 1.2s ease-in-out infinite' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: AE_RED, animation: 'bounce 1.2s ease-in-out 0.15s infinite' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: AE_RED, animation: 'bounce 1.2s ease-in-out 0.3s infinite' }} />
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
