'use client';

import { useEffect, useState } from 'react';
import { sendFingerprint } from '@/lib/utils/fingerprint-beacon';

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
  androidPackage?: string;
  /**
   * True when this load is a browser falling back from our own intent rather
   * than a fresh click. Go straight to the store — retrying the intent is what
   * causes the loop.
   */
  isStoreFallback?: boolean;
  /**
   * False when this link (or this click) must never end at the app store.
   * Every branch that would otherwise hand off to the store sends the user to
   * `webFallbackUrl` instead. The app-open attempt still runs first, so a
   * device with the app installed is unaffected.
   */
  storeRedirectEnabled?: boolean;
  /**
   * Where a device without the app lands when `storeRedirectEnabled` is false.
   * Resolved server-side, preferring this click's dynamic deep link over the
   * link's stored destination and over the static web override.
   */
  webFallbackUrl?: string;
}

const AE_RED = '#E8344E';
const AE_BG = '#FFFFFF';

/**
 * Marks a page load that is a browser's mishandled fallback from our own
 * Android intent, rather than a fresh user click. Kept in sync with the
 * server-side check in app/[shortCode]/page.tsx.
 */
export const STORE_FALLBACK_PARAM = '_slfb';

export default function RedirectPage({
  shortCode,
  linkId,
  link,
  deviceOS,
  tenantId,
  clickId,
  storeUrls,
  androidPackage,
  isStoreFallback = false,
  storeRedirectEnabled = true,
  webFallbackUrl,
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

    // App-store navigation is off and we have somewhere on the web to send a
    // device that turns out not to have the app. The server only ever clears
    // the flag when it also resolved a URL, but a missing one here would mean
    // a dead end — so the store stays the fallback of last resort.
    const skipStore = !storeRedirectEnabled && Boolean(webFallbackUrl);

    // Fire fingerprint in background — but ONLY for mobile users.
    // Desktop users don't install apps, so creating deferred links for
    // them causes false-positive matches when they later open the app
    // on the same network (shared IP → inflated install count).
    // sendBeacon guarantees delivery even during page unload.
    // Skipped on a store fallback: the fingerprint was already sent by the
    // load that fired the intent, and this hop has no click of its own.
    if (isMobile && !isStoreFallback) {
      sendFingerprint({
        linkId,
        tenantId,
        clickId,
        mergedDestinationUrl: link.destinationUrl || undefined,
        mergedParams: link.params || undefined,
      });
    }

    // Redirect immediately — no waiting
    setStatus('redirecting');

    if (!isMobile) {
      // With the store off, webFallbackUrl leads — it already put this click's
      // dynamic deep link ahead of the link's static web override, which would
      // otherwise send every click of a dynamic link to the same static page.
      const webUrl = skipStore
        ? webFallbackUrl
        : link.platformOverrides?.web?.url || link.destinationUrl;
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
      // Where the user goes when the app does not take the link — the store,
      // or the web destination when store navigation is off. Store params are
      // only meaningful on a store URL, so the web fallback skips them; it
      // already carries this click's own query string.
      const noAppUrl = skipStore
        ? webFallbackUrl!
        : appendStoreParams(rawStoreUrl, link.params, false);

      // Check for explicit app scheme URL (e.g. allevents://, myapp://)
      const overrideUrl = link.platformOverrides?.android?.url;
      const isAppScheme = overrideUrl && !overrideUrl.startsWith('http');

      if (isStoreFallback) {
        // The intent already ran and the app did not take it. Retrying it here
        // is exactly what loops the redirect.
        window.location.replace(noAppUrl);
        setStatus('done');
      } else if (isAppScheme) {
        // Explicit custom scheme → use tryOpenApp with blur detection
        tryOpenApp(overrideUrl, noAppUrl);
      } else if (androidPackage) {
        // Use destination URL in intent so the app's own domain (e.g. allevents.in)
        // resolves via its existing App Links intent filter. With no http
        // destination we target this page's own URL, which the app also claims
        // via /.well-known/assetlinks.json — that is what makes "open the app"
        // links work when the app is installed.
        //
        // The catch: when the app is NOT installed, some browsers (Samsung
        // Internet in particular) honour `scheme=https` + our host by simply
        // navigating to that https URL instead of using browser_fallback_url.
        // That reloads this page and re-fires the whole flow. The STORE_FALLBACK
        // marker below makes that second load detectable, so the server skips
        // recording it and we go straight to noAppUrl instead of looping.
        const destUrl = link.destinationUrl;
        let intentTarget: string;
        if (destUrl && destUrl.startsWith('http')) {
          intentTarget = destUrl;
        } else {
          const selfUrl = new URL(`${window.location.origin}/${shortCode}${window.location.search}`);
          selfUrl.searchParams.set(STORE_FALLBACK_PARAM, '1');
          intentTarget = selfUrl.toString();
        }
        const intentUrl =
          `intent://${intentTarget.replace(/^https?:\/\//, '')}` +
          `#Intent;scheme=https;package=${androidPackage}` +
          `;S.browser_fallback_url=${encodeURIComponent(noAppUrl)};end`;
        window.location.replace(intentUrl);
        setStatus('done');
      } else {
        // No app scheme and no package name → nothing can open the app from
        // here, so go straight to noAppUrl. The fingerprint + deferred link
        // will handle deep linking after install via the Flutter SDK match flow.
        window.location.replace(noAppUrl);
        setStatus('done');
      }
    } else if (isIOS) {
      const rawStoreUrl =
        link.platformOverrides?.ios?.fallback ||
        storeUrls.ios;
      const noAppUrl = skipStore
        ? webFallbackUrl!
        : appendStoreParams(rawStoreUrl, link.params, true);

      // Check for explicit app scheme URL (e.g. allevents://, myapp://)
      const overrideUrl = link.platformOverrides?.ios?.url;
      const isAppScheme = overrideUrl && !overrideUrl.startsWith('http');

      if (isAppScheme) {
        // Custom URL scheme → use tryOpenApp with timer fallback
        tryOpenApp(overrideUrl, noAppUrl);
      } else {
        // iOS doesn't support intent:// — rely on Universal Links. Reaching
        // this line means they did not intercept (app not installed, or the
        // user opened the link in Safari manually), so send them to noAppUrl:
        // the App Store, or the web destination when the store is off.
        // Deferred deep linking handles post-install navigation.
        window.location.replace(noAppUrl);
        setStatus('done');
      }
    }
  };

  const tryOpenApp = (appUrl: string, fallbackUrl: string) => {
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
    // 1s), redirect to fallbackUrl instead — the store, or the web
    // destination when store navigation is off. Modern phones switch within
    // ~300ms if the app is installed, so 1s is a safe threshold.
    setTimeout(() => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);

      if (!didLeave) {
        window.location.replace(fallbackUrl);
      }
      setStatus('done');
    }, 1000);
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
