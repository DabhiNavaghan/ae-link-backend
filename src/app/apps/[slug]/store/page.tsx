'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface AppInfo {
  name: string;
  androidStoreUrl: string | null;
  iosStoreUrl: string | null;
}

function detectOS(): 'android' | 'ios' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}

/**
 * Append UTM + ct/pt/mt params to a store URL.
 * Play Store: encode utm_* into `referrer` param.
 * App Store:  append utm_* + ct/pt/mt directly.
 */
function appendStoreParams(
  baseUrl: string,
  qs: URLSearchParams,
  isIos: boolean,
): string {
  const utmSource   = qs.get('utm_source');
  const utmMedium   = qs.get('utm_medium');
  const utmCampaign = qs.get('utm_campaign');
  const utmTerm     = qs.get('utm_term');
  const utmContent  = qs.get('utm_content');
  const ct          = qs.get('ct');
  const pt          = qs.get('pt');
  const mt          = qs.get('mt');

  const hasUtm   = utmSource || utmMedium || utmCampaign || utmTerm || utmContent;
  const hasStore = ct || pt;
  if (!hasUtm && !hasStore) return baseUrl;

  try {
    const url = new URL(baseUrl);
    if (isIos) {
      if (utmSource)   url.searchParams.set('utm_source',   utmSource);
      if (utmMedium)   url.searchParams.set('utm_medium',   utmMedium);
      if (utmCampaign) url.searchParams.set('utm_campaign', utmCampaign);
      if (utmTerm)     url.searchParams.set('utm_term',     utmTerm);
      if (utmContent)  url.searchParams.set('utm_content',  utmContent);
      if (ct)          url.searchParams.set('ct', ct);
      if (pt)          url.searchParams.set('pt', pt);
      url.searchParams.set('mt', mt || '8');
    } else {
      const ref = new URLSearchParams();
      if (utmSource)   ref.set('utm_source',   utmSource);
      if (utmMedium)   ref.set('utm_medium',   utmMedium);
      if (utmCampaign) ref.set('utm_campaign', utmCampaign);
      if (utmTerm)     ref.set('utm_term',     utmTerm);
      if (utmContent)  ref.set('utm_content',  utmContent);
      const refStr = ref.toString();
      if (refStr) url.searchParams.set('referrer', refStr);
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export default function StoreRedirectPage() {
  const { slug }    = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const [app, setApp]     = useState<AppInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'choose' | 'error'>('loading');

  useEffect(() => {
    fetch(`/api/v1/apps/public/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((data) => {
        const info: AppInfo = {
          name: data.name,
          androidStoreUrl: data.androidStoreUrl,
          iosStoreUrl: data.iosStoreUrl,
        };
        setApp(info);

        const os = detectOS();
        const isIos = os === 'ios';

        const androidUrl = info.androidStoreUrl
          ? appendStoreParams(info.androidStoreUrl, searchParams, false)
          : null;
        const iosUrl = info.iosStoreUrl
          ? appendStoreParams(info.iosStoreUrl, searchParams, true)
          : null;

        if (os === 'android' && androidUrl) {
          setStatus('redirecting');
          window.location.href = androidUrl;
        } else if (os === 'ios' && iosUrl) {
          setStatus('redirecting');
          window.location.href = iosUrl;
        } else if (androidUrl && !iosUrl) {
          setStatus('redirecting');
          window.location.href = androidUrl;
        } else if (iosUrl && !androidUrl) {
          setStatus('redirecting');
          window.location.href = iosUrl;
        } else {
          setStatus('choose');
        }
      })
      .catch(() => setStatus('error'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ─── Shared shell ────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#e5e5e5',
        fontFamily: 'var(--font-mono, monospace)',
        padding: '2rem',
        gap: '1.5rem',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );

  if (status === 'loading') {
    return (
      <Shell>
        <div style={{ fontSize: 13, color: '#666', letterSpacing: '0.08em' }}>loading...</div>
      </Shell>
    );
  }

  if (status === 'error') {
    return (
      <Shell>
        <p style={{ fontSize: 13, color: '#ef4444' }}>app not found.</p>
      </Shell>
    );
  }

  if (status === 'redirecting') {
    return (
      <Shell>
        <p style={{ fontSize: 13, color: '#666', letterSpacing: '0.08em' }}>
          redirecting to {app?.name}...
        </p>
        {app?.androidStoreUrl && (
          <a
            href={appendStoreParams(app.androidStoreUrl, searchParams, false)}
            style={{ color: '#22c55e', fontSize: 12 }}
          >
            tap here if not redirected (Play Store)
          </a>
        )}
        {app?.iosStoreUrl && (
          <a
            href={appendStoreParams(app.iosStoreUrl, searchParams, true)}
            style={{ color: '#a3a3a3', fontSize: 12 }}
          >
            tap here if not redirected (App Store)
          </a>
        )}
      </Shell>
    );
  }

  // choose — desktop or both stores available
  return (
    <Shell>
      <p style={{ fontSize: 11, letterSpacing: '0.12em', color: '#666', textTransform: 'uppercase' }}>
        download
      </p>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#fff' }}>
        {app?.name}
      </h1>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
        {app?.androidStoreUrl && (
          <a
            href={appendStoreParams(app.androidStoreUrl, searchParams, false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              border: '1px solid #22c55e',
              color: '#22c55e',
              textDecoration: 'none',
              fontSize: 13,
              letterSpacing: '0.06em',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#22c55e';
              (e.currentTarget as HTMLElement).style.color = '#000';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#22c55e';
            }}
          >
            <AndroidIcon /> Play Store
          </a>
        )}
        {app?.iosStoreUrl && (
          <a
            href={appendStoreParams(app.iosStoreUrl, searchParams, true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              border: '1px solid #a3a3a3',
              color: '#a3a3a3',
              textDecoration: 'none',
              fontSize: 13,
              letterSpacing: '0.06em',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#a3a3a3';
              (e.currentTarget as HTMLElement).style.color = '#000';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#a3a3a3';
            }}
          >
            <AppleIcon /> App Store
          </a>
        )}
      </div>
    </Shell>
  );
}

const AndroidIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.523 15.341c-.5 0-.902-.402-.902-.902s.402-.902.902-.902.901.402.901.902-.401.902-.901.902zm-11.046 0c-.5 0-.902-.402-.902-.902s.402-.902.902-.902.902.402.902.902-.402.902-.902.902zm11.4-6.052l1.997-3.46a.416.416 0 00-.152-.567.416.416 0 00-.568.152L17.12 8.93c-1.46-.67-3.1-1.044-5.12-1.044s-3.66.374-5.12 1.044L4.846 5.414a.416.416 0 00-.568-.152.416.416 0 00-.152.567l1.997 3.46C2.688 11.186.343 14.654 0 18.76h24c-.343-4.106-2.688-7.574-6.123-9.471z" />
  </svg>
);

const AppleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);
