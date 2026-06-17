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

// AllEvents brand colors
const AE_RED = '#E8344E';
const AE_RED_LIGHT = '#FF4D65';
const AE_BG = '#FFFFFF';
const AE_BG_CARD = '#F8F9FA';
const AE_TEXT = '#1A1A2E';
const AE_TEXT_SECONDARY = '#6B7280';
const AE_TEXT_TERTIARY = '#9CA3AF';
const AE_BORDER = '#E5E7EB';

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
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    handleRedirectFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress bar animation
  useEffect(() => {
    if (status === 'loading' || status === 'redirecting') {
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 95) return 95;
          return p + (status === 'loading' ? 2 : 5);
        });
      }, 100);
      return () => clearInterval(interval);
    }
    if (status === 'done') setProgress(100);
  }, [status]);

  const handleRedirectFlow = async () => {
    const isAndroid = deviceOS === 'android';
    const isIOS = deviceOS === 'ios';
    const isMobile = isAndroid || isIOS;

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
          mergedDestinationUrl: link.destinationUrl || undefined,
          mergedParams: link.params || undefined,
        }),
      });
      await fpResponse.json();
    } catch (err) {
      console.error('[SmartLink] Fingerprint collection error:', err);
    }

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
      const appUrl = link.platformOverrides?.android?.url;
      const rawStoreUrl =
        link.platformOverrides?.android?.fallback ||
        storeUrls.android;
      const storeUrl = appendStoreParams(rawStoreUrl, link.params, false);

      if (appUrl) {
        tryOpenApp(appUrl, storeUrl);
      } else {
        window.location.replace(storeUrl);
        setStatus('done');
      }
    } else if (isIOS) {
      const appUrl = link.platformOverrides?.ios?.url;
      const rawStoreUrl =
        link.platformOverrides?.ios?.fallback ||
        storeUrls.ios;
      const storeUrl = appendStoreParams(rawStoreUrl, link.params, true);

      if (appUrl) {
        tryOpenApp(appUrl, storeUrl);
      } else {
        window.location.replace(storeUrl);
        setStatus('done');
      }
    }
  };

  const tryOpenApp = (appUrl: string, storeUrl: string) => {
    let didLeave = false;

    const onBlur = () => { didLeave = true; };
    const onVisibilityChange = () => {
      if (document.hidden) didLeave = true;
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    window.location.href = appUrl;

    setTimeout(() => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);

      if (didLeave) {
        if (clickId) {
          fetch('/api/v1/clicks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clickId, action: 'app_opened' }),
          }).catch(() => {});
        }
      } else {
        window.location.replace(storeUrl);
      }
      setStatus('done');
    }, 1500);
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

  // === Build params list for display ===
  const params = link.params || {};
  const deepLink = link.destinationUrl;
  const isMobile = deviceOS === 'android' || deviceOS === 'ios';

  // Extract displayable deep link path
  let displayDeepLink = deepLink || '';
  try {
    if (displayDeepLink) {
      const u = new URL(displayDeepLink);
      displayDeepLink = u.pathname !== '/' ? u.host + u.pathname : u.host;
    }
  } catch {}

  // Collect param chips
  const paramChips: Array<{ label: string; value: string; color: string }> = [];
  if (params.ref) paramChips.push({ label: 'ref', value: params.ref, color: '#3B82F6' });
  if (params.utmSource) paramChips.push({ label: 'source', value: params.utmSource, color: '#8B5CF6' });
  if (params.utmMedium) paramChips.push({ label: 'medium', value: params.utmMedium, color: '#EC4899' });
  if (params.utmCampaign) paramChips.push({ label: 'campaign', value: params.utmCampaign, color: '#F59E0B' });
  if (params.utmTerm) paramChips.push({ label: 'term', value: params.utmTerm, color: '#10B981' });
  if (params.utmContent) paramChips.push({ label: 'content', value: params.utmContent, color: '#06B6D4' });
  if (params.action) paramChips.push({ label: 'action', value: params.action, color: '#6366F1' });
  if (params.eventId) paramChips.push({ label: 'event', value: params.eventId, color: AE_RED });

  // Custom params
  if (params.custom && typeof params.custom === 'object') {
    Object.entries(params.custom).forEach(([k, v]) => {
      paramChips.push({ label: k, value: String(v), color: AE_TEXT_SECONDARY });
    });
  }

  const hasParams = paramChips.length > 0 || displayDeepLink;

  const storeUrl = deviceOS === 'android'
    ? appendStoreParams(storeUrls.android, link.params, false)
    : deviceOS === 'ios'
    ? appendStoreParams(storeUrls.ios, link.params, true)
    : link.destinationUrl;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: AE_BG,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: 0,
    }}>
      {/* Progress bar at top */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: '#F3F4F6',
        zIndex: 100,
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          backgroundColor: AE_RED,
          transition: 'width 0.3s ease',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>

      {/* Main content */}
      <div style={{
        width: '100%',
        maxWidth: 420,
        padding: '60px 24px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>

        {/* AllEvents Logo / App Icon */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          background: `linear-gradient(135deg, ${AE_RED} 0%, ${AE_RED_LIGHT} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          boxShadow: '0 8px 24px rgba(232, 52, 78, 0.25)',
        }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <text x="18" y="24" textAnchor="middle" fill="white" fontWeight="800" fontSize="20" fontFamily="system-ui">AE</text>
          </svg>
        </div>

        {/* Status text */}
        <h1 style={{
          fontSize: 22,
          fontWeight: 700,
          color: AE_TEXT,
          margin: '0 0 6px',
          textAlign: 'center',
          letterSpacing: '-0.02em',
        }}>
          {status === 'loading' ? 'Preparing your link...' : 'Opening AllEvents...'}
        </h1>

        <p style={{
          fontSize: 14,
          color: AE_TEXT_SECONDARY,
          margin: '0 0 28px',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          {isMobile
            ? status === 'loading'
              ? 'Connecting you to the app'
              : 'Taking you to the right place'
            : 'Redirecting to the event page'
          }
        </p>

        {/* Spinner */}
        {status !== 'done' && (
          <div style={{ marginBottom: 28 }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
              <circle cx="18" cy="18" r="14" stroke="#F3F4F6" strokeWidth="3" fill="none" />
              <path d="M18 4a14 14 0 0 1 14 14" stroke={AE_RED} strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
          </div>
        )}

        {/* Deep Link & Params Card */}
        {hasParams && (
          <div style={{
            width: '100%',
            backgroundColor: AE_BG_CARD,
            border: `1px solid ${AE_BORDER}`,
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 24,
          }}>
            {/* Deep link URL */}
            {displayDeepLink && (
              <div style={{
                padding: '14px 16px',
                borderBottom: paramChips.length > 0 ? `1px solid ${AE_BORDER}` : 'none',
              }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: AE_TEXT_TERTIARY,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 6,
                }}>
                  Destination
                </div>
                <div style={{
                  fontSize: 13,
                  color: AE_TEXT,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                  wordBreak: 'break-all',
                  lineHeight: 1.4,
                }}>
                  {link.destinationUrl || 'App default'}
                </div>
              </div>
            )}

            {/* Param chips */}
            {paramChips.length > 0 && (
              <div style={{ padding: '14px 16px' }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: AE_TEXT_TERTIARY,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 10,
                }}>
                  Link Parameters
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {paramChips.map((chip, i) => (
                    <div key={`${chip.label}-${i}`} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 6,
                      backgroundColor: '#FFFFFF',
                      border: `1px solid ${AE_BORDER}`,
                      fontSize: 12,
                      lineHeight: 1.4,
                    }}>
                      <span style={{
                        fontWeight: 600,
                        color: chip.color,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}>
                        {chip.label}
                      </span>
                      <span style={{ color: AE_TEXT, fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace' }}>
                        {chip.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Platform info pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: 20,
          backgroundColor: AE_BG_CARD,
          border: `1px solid ${AE_BORDER}`,
          marginBottom: 28,
          fontSize: 12,
          color: AE_TEXT_SECONDARY,
        }}>
          {/* Platform icon */}
          {deviceOS === 'android' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 16V8a7 7 0 0 1 14 0v8" /><rect x="3" y="16" width="18" height="4" rx="1" /><path d="M7 4l-2-2M17 4l2-2" />
            </svg>
          )}
          {deviceOS === 'ios' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3c0 1.5.9 2.8 2.2 3.4A3 3 0 0 0 15 5a3 3 0 0 0-3-3z" /><path d="M12 8.5c-3.5 0-7 2-7 7.5 0 4 2.5 6 5 6 1 0 1.5-.5 2-.5s1 .5 2 .5c2.5 0 5-2 5-6 0-5.5-3.5-7.5-7-7.5z" />
            </svg>
          )}
          {deviceOS !== 'android' && deviceOS !== 'ios' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          )}
          <span>
            {deviceOS === 'android' ? 'Android' : deviceOS === 'ios' ? 'iOS' : 'Desktop'}
            {isMobile ? ' — Opening app' : ' — Opening website'}
          </span>
        </div>

        {/* CTA button — manual fallback */}
        <a
          href={storeUrl}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '14px 24px',
            borderRadius: 10,
            background: `linear-gradient(135deg, ${AE_RED} 0%, ${AE_RED_LIGHT} 100%)`,
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(232, 52, 78, 0.3)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            letterSpacing: '-0.01em',
          }}
        >
          {isMobile ? 'Open in App' : 'Continue to Event'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>

        {/* Store badges for mobile */}
        {isMobile && (
          <div style={{
            marginTop: 16,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}>
            {deviceOS === 'android' && (
              <a href={appendStoreParams(storeUrls.android, link.params, false)} style={{
                fontSize: 12,
                color: AE_TEXT_TERTIARY,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5V3.5c0-.47.2-.85.58-1.14L14.29 13 3.58 23.64c-.38-.29-.58-.67-.58-1.14zm16.54-5.97l-2.72-1.58-3.18 2.8 3.18 2.8 2.72-1.58c.72-.4 1.08-.92 1.08-1.54s-.36-1.14-1.08-1.54l.01.04zM5.47 2.05L16.12 8.2 13.29 11 5.47 2.05zM16.12 17.8L5.47 23.95l7.82-8.95 2.83 2.8z"/></svg>
                Get on Play Store
              </a>
            )}
            {deviceOS === 'ios' && (
              <a href={appendStoreParams(storeUrls.ios, link.params, true)} style={{
                fontSize: 12,
                color: AE_TEXT_TERTIARY,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Get on App Store
              </a>
            )}
          </div>
        )}

        {/* Short code reference */}
        <div style={{
          marginTop: 40,
          fontSize: 11,
          color: AE_TEXT_TERTIARY,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          textAlign: 'center',
        }}>
          /{shortCode}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 'auto',
        padding: '20px 24px',
        width: '100%',
        textAlign: 'center',
      }}>
        <a
          href="https://allevents.in"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11,
            color: AE_TEXT_TERTIARY,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Powered by AllEvents
        </a>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        a:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}
