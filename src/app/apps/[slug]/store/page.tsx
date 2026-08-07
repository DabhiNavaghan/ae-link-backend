'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { generateQRCodeSVG } from '@/lib/utils/qr-code';
import AppIcon from '@/components/AppIcon';

interface AppInfo {
  id: string;
  name: string;
  androidStoreUrl: string | null;
  iosStoreUrl: string | null;
  tagline: string | null;
  description: string | null;
  marketingUrl: string | null;
  hasIcon: boolean;
  hasScreenshot: boolean;
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

/** Apple's mark, drawn inline so the page needs no external assets. */
function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 14.25 3.51 5.31 9.05 5.03c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.36zM12.03 4.97C11.88 2.69 13.73.81 15.85.63c.29 2.58-2.34 4.5-3.82 4.34z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M3.18 1.6C3.06 1.8 3 2.05 3 2.36v19.28c0 .31.06.56.18.76l.07.07 10.8-10.8v-.25L3.25 1.53l-.07.07z" fill="#00A0FF" />
      <path d="M17.64 15.28l-3.59-3.6v-.25l3.6-3.6.08.05 4.26 2.42c1.22.69 1.22 1.82 0 2.51l-4.26 2.42-.09.05z" fill="#FFBC00" />
      <path d="M17.73 15.23l-3.68-3.68-10.87 10.87c.4.43 1.07.48 1.82.06l12.73-7.25z" fill="#FF3A44" />
      <path d="M17.73 8.77L5 1.52C4.25 1.1 3.58 1.15 3.18 1.58l10.87 10.87 3.68-3.68z" fill="#00C852" />
    </svg>
  );
}

function StoreBadge({
  href,
  glyph,
  line1,
  line2,
}: {
  href: string;
  glyph: React.ReactNode;
  line1: string;
  line2: string;
}) {
  return (
    <a href={href} className="ae-badge">
      {/* Fixed box so the Apple and Play marks — which fill their viewBoxes
          differently — end up the same optical size next to the text. */}
      <span className="ae-badge-glyph">{glyph}</span>
      <span className="ae-badge-text">
        <span className="ae-badge-line1">{line1}</span>
        <span className="ae-badge-line2">{line2}</span>
      </span>
    </a>
  );
}

export default function StoreRedirectPage() {
  const { slug }    = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const [app, setApp]     = useState<AppInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'choose' | 'error'>('loading');
  const [qrSvg, setQrSvg] = useState('');

  useEffect(() => {
    fetch(`/api/v1/apps/public/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((data: AppInfo) => {
        setApp(data);

        const os = detectOS();
        const androidUrl = data.androidStoreUrl
          ? appendStoreParams(data.androidStoreUrl, searchParams, false)
          : null;
        const iosUrl = data.iosStoreUrl
          ? appendStoreParams(data.iosStoreUrl, searchParams, true)
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

  // Only the desktop "choose" screen shows a QR — a phone that got this far is
  // already holding the link. Generated client-side because this page has no
  // server render to hang it off.
  useEffect(() => {
    if (status !== 'choose' || !app) return;
    const logo = app.hasIcon
      ? `<image href="/app-asset/${app.id}/icon" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" />`
      : undefined;
    generateQRCodeSVG(window.location.href, 190, logo)
      .then(setQrSvg)
      .catch(() => setQrSvg(''));
  }, [status, app]);

  const androidHref = app?.androidStoreUrl
    ? appendStoreParams(app.androidStoreUrl, searchParams, false)
    : null;
  const iosHref = app?.iosStoreUrl
    ? appendStoreParams(app.iosStoreUrl, searchParams, true)
    : null;

  if (status === 'loading') {
    return (
      <div className="ae-page">
        <div className="ae-status">loading...</div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="ae-page">
        <div className="ae-status ae-status-error">app not found.</div>
      </div>
    );
  }

  if (status === 'redirecting') {
    return (
      <div className="ae-page">
        <main className="ae-card">
          {/* Quoted so the leading slashes read as the label they are. */}
          <div className="ae-eyebrow">{'// opening the store'}</div>
          <div className="ae-head">
            <AppIcon appId={app?.id} hasIcon={app?.hasIcon} name={app?.name || 'App'} size={64} />
            <div className="ae-head-text">
              <h1 className="ae-name">{app?.name}</h1>
              <p className="ae-tagline">taking you to the store…</p>
            </div>
          </div>
          <div className="ae-badges">
            {iosHref && (
              <StoreBadge href={iosHref} glyph={<AppleGlyph />} line1="Download on the" line2="App Store" />
            )}
            {androidHref && (
              <StoreBadge href={androidHref} glyph={<PlayGlyph />} line1="GET IT ON" line2="Google Play" />
            )}
          </div>
          <p className="ae-hint">not redirected? use a button above.</p>
        </main>
      </div>
    );
  }

  // choose — desktop, or an app that ships on both stores
  return (
    <div className="ae-page ae-page-wide">
      <main className="ae-card">
        {/* The eyebrow sits above the split so its rule spans the whole card —
            stopping it at the first column left the header looking severed. */}
        <div className="ae-eyebrow">{'// get the app'}</div>

        <div className="ae-card-split">
          <div className="ae-col">
            <div className="ae-head">
              <AppIcon appId={app?.id} hasIcon={app?.hasIcon} name={app?.name || 'App'} size={64} />
              <div className="ae-head-text">
                <h1 className="ae-name">{app?.name}</h1>
                {app?.tagline && <p className="ae-tagline">{app.tagline}</p>}
              </div>
            </div>

            {app?.description && <p className="ae-desc">{app.description}</p>}

            <div className="ae-get">
              {qrSvg && (
                <div className="ae-qr-inline">
                  <div className="ae-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                  <div className="ae-qr-label">scan to install</div>
                </div>
              )}
              <div className="ae-badges ae-badges-stacked">
                {iosHref && (
                  <StoreBadge href={iosHref} glyph={<AppleGlyph />} line1="Download on the" line2="App Store" />
                )}
                {androidHref && (
                  <StoreBadge href={androidHref} glyph={<PlayGlyph />} line1="GET IT ON" line2="Google Play" />
                )}
              </div>
            </div>

            {app?.marketingUrl && (
              <a className="ae-more ae-more-left" href={app.marketingUrl} target="_blank" rel="noopener noreferrer">
                learn more about {app.name} →
              </a>
            )}
          </div>

          {app?.hasScreenshot && (
            <div className="ae-shot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/app-asset/${app.id}/screenshot`}
                alt=""
                className="ae-shot-img"
                loading="eager"
                decoding="async"
                // A missing brand shot should collapse the column rather than
                // leave a broken frame next to the download buttons.
                onError={(e) => {
                  const col = (e.currentTarget.parentElement as HTMLElement | null);
                  if (col) col.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
