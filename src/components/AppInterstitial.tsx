import { generateQRCodeSVG } from '@/lib/utils/qr-code';
import { safeHttpUrl, safeStoreUrl } from '@/lib/utils/url';
import FingerprintBeacon from '@/components/FingerprintBeacon';
import { IAppInfo } from '@/types';

const AE_RED = '#E8344E';

/**
 * Marks a load that is the *fallback* of an app-open attempt rather than a
 * fresh click: the Android intent's `browser_fallback_url` and the custom
 * scheme timeout both point here. Its presence means the app was tried and
 * declined, so this hop must not re-run the attempt, re-record the click, or
 * re-send the fingerprint — the load that fired the attempt already did.
 */
export const APP_INFO_PARAM = '_appinfo';

interface AppInterstitialProps {
  /** App name, shown as the heading. Falls back to a generic title when blank. */
  appName?: string;
  info?: IAppInfo;
  storeUrls: { android?: string; ios?: string };
  /**
   * The short link being served, query string included. Encoded into the QR so
   * scanning it on a phone replays this exact click — deep link, UTMs and all —
   * through the normal open-the-app-or-store flow.
   */
  smartLinkUrl: string;
  deviceOS: 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'other';
  /** Identifiers for the deferred-match fingerprint. Omitted for bots. */
  linkId: string;
  tenantId: string;
  clickId?: string;
  destinationUrl?: string;
  params?: Record<string, any>;
  /**
   * True when this load is the fallback of an app-open attempt (see
   * APP_INFO_PARAM). The load that fired the attempt already sent the
   * fingerprint for this click, so sending it again would double up.
   */
  isAppOpenFallback?: boolean;
}

/** Apple's mark, drawn inline so the page needs no external assets. */
function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 14.25 3.51 5.31 9.05 5.03c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.36zM12.03 4.97C11.88 2.69 13.73.81 15.85.63c.29 2.58-2.34 4.5-3.82 4.34z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
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
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="ae-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 18px',
        borderRadius: 10,
        textDecoration: 'none',
        border: '1px solid var(--ae-badge-border)',
        background: 'var(--ae-badge-bg)',
        color: 'var(--ae-badge-fg)',
        minWidth: 160,
      }}
    >
      {glyph}
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, textAlign: 'left' }}>
        <span style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.04em' }}>{line1}</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{line2}</span>
      </span>
    </a>
  );
}

/**
 * The page a click lands on when app-store navigation is switched off and the
 * link has no web destination to open — nothing to redirect to, so instead of
 * a dead end the visitor gets the app itself: what it is, and how to get it.
 *
 * Desktop sees a QR of this same short link, which carries the click's deep
 * link across to the phone. Phones skip the QR — they can just tap a badge.
 */
export default async function AppInterstitial({
  appName,
  info,
  storeUrls,
  smartLinkUrl,
  deviceOS,
  linkId,
  tenantId,
  clickId,
  destinationUrl,
  params,
  isAppOpenFallback = false,
}: AppInterstitialProps) {
  const isMobile = deviceOS === 'android' || deviceOS === 'ios';

  // Scanning is pointless on the device already holding the link.
  let qrSvg = '';
  if (!isMobile) {
    try {
      qrSvg = await generateQRCodeSVG(smartLinkUrl, 200);
    } catch {
      // A failed QR is not worth failing the page over — the badges still work.
    }
  }

  const title = appName || 'Get the app';
  const tagline = info?.tagline;
  const description = info?.description;

  // Operator-supplied and rendered on a public page, so nothing here is
  // trusted to be http(s) just because it was saved.
  const iconUrl = safeHttpUrl(info?.iconUrl);
  const marketingUrl = safeHttpUrl(info?.marketingUrl);
  // A phone can only install from its own store; showing the other one is
  // noise. Desktop has no store of its own, so it gets both.
  const iosUrl = deviceOS === 'android' ? undefined : safeStoreUrl(storeUrls.ios);
  const androidUrl = deviceOS === 'ios' ? undefined : safeStoreUrl(storeUrls.android);

  return (
    <div className="ae-interstitial">
      {/* Phones can still install from here, so keep them in the deferred
          match pool; desktop visitors never install and would only add
          false positives on a shared IP. Skipped when this load is an
          app-open fallback — that click was fingerprinted a hop ago. */}
      {isMobile && !isAppOpenFallback && (
        <FingerprintBeacon
          linkId={linkId}
          tenantId={tenantId}
          clickId={clickId}
          mergedDestinationUrl={destinationUrl || undefined}
          mergedParams={params || undefined}
        />
      )}

      <main className="ae-card">
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt=""
            width={88}
            height={88}
            style={{ borderRadius: 20, display: 'block', margin: '0 auto 20px', objectFit: 'cover' }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: 88, height: 88, borderRadius: 20, margin: '0 auto 20px',
              background: AE_RED, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 38, fontWeight: 700,
            }}
          >
            {title.trim().charAt(0).toUpperCase()}
          </div>
        )}

        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h1>

        {tagline && (
          <p style={{ margin: '10px 0 0', fontSize: 16, color: 'var(--ae-fg-muted)' }}>{tagline}</p>
        )}

        {description && (
          <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.65, color: 'var(--ae-fg-muted)' }}>
            {description}
          </p>
        )}

        {qrSvg && (
          <div style={{ marginTop: 28 }}>
            <div
              style={{
                display: 'inline-block', padding: 12, borderRadius: 14,
                background: '#fff', border: '1px solid var(--ae-border)',
              }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--ae-fg-muted)' }}>
              Scan with your phone to open this in the app
            </p>
          </div>
        )}

        {(iosUrl || androidUrl) && (
          <div
            style={{
              marginTop: 28, display: 'flex', flexWrap: 'wrap',
              gap: 12, justifyContent: 'center',
            }}
          >
            {iosUrl && (
              <StoreBadge href={iosUrl} glyph={<AppleGlyph />} line1="Download on the" line2="App Store" />
            )}
            {androidUrl && (
              <StoreBadge href={androidUrl} glyph={<PlayGlyph />} line1="GET IT ON" line2="Google Play" />
            )}
          </div>
        )}

        {marketingUrl && (
          <p style={{ margin: '26px 0 0' }}>
            <a
              href={marketingUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: AE_RED, textDecoration: 'none', fontWeight: 600 }}
            >
              Learn more about {title} →
            </a>
          </p>
        )}
      </main>

      <style>{`
        .ae-interstitial {
          --ae-bg: #ffffff;
          --ae-card: #ffffff;
          --ae-fg: #0b0d12;
          --ae-fg-muted: #5b6472;
          --ae-border: #e6e8ec;
          --ae-badge-bg: #0b0d12;
          --ae-badge-fg: #ffffff;
          --ae-badge-border: #0b0d12;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;
          background: var(--ae-bg);
          color: var(--ae-fg);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        @media (prefers-color-scheme: dark) {
          .ae-interstitial {
            --ae-bg: #0b0d12;
            --ae-card: #12151c;
            --ae-fg: #f4f6fa;
            --ae-fg-muted: #9aa3b2;
            --ae-border: #242a35;
            --ae-badge-bg: #f4f6fa;
            --ae-badge-fg: #0b0d12;
            --ae-badge-border: #f4f6fa;
          }
        }
        .ae-card {
          width: 100%;
          max-width: 440px;
          text-align: center;
          background: var(--ae-card);
          border: 1px solid var(--ae-border);
          border-radius: 20px;
          padding: 40px 28px;
        }
        .ae-badge { transition: opacity 0.15s ease; }
        .ae-badge:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
