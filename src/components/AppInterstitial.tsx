import { generateQRCodeSVG } from '@/lib/utils/qr-code';
import { safeHttpUrl, safeStoreUrl } from '@/lib/utils/url';
import FingerprintBeacon from '@/components/FingerprintBeacon';
import AppIcon from '@/components/AppIcon';
import { IAppInfo } from '@/types';

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
  /** Identifies the app whose icon to serve from our own origin. */
  appId?: string;
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
    <a href={href} target="_blank" rel="noopener noreferrer" className="ae-badge">
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

/**
 * The page a click lands on when app-store navigation is switched off and
 * there is nothing to redirect to — so instead of a dead end the visitor gets
 * the app itself: what it is, and how to get it.
 *
 * Desktop sees a QR of this same short link, which carries the click's deep
 * link across to the phone. Phones skip the QR — they can just tap a badge.
 */
export default async function AppInterstitial({
  appName,
  appId,
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

  const title = appName || 'Get the app';
  // Operator-supplied and rendered on a public page, so nothing here is
  // trusted to be http(s) just because it was saved.
  const iconUrl = safeHttpUrl(info?.iconUrl);

  // Scanning is pointless on the device already holding the link.
  let qrSvg = '';
  if (!isMobile) {
    // The app's own icon sits in the middle, so the code reads as this app's
    // rather than as an anonymous black square. The generator reserves a white
    // gutter for it and encodes at H error correction (30% recoverable), and
    // the mark covers ~7% of the area — well inside that budget.
    //
    // Referencing the icon route rather than inlining the bytes keeps the
    // markup small and reuses the cached, same-origin proxy; the SVG is inline
    // in the document, so the relative URL resolves against the page.
    const logo =
      appId && iconUrl
        ? `<image href="/app-asset/${appId}/icon" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" />`
        : undefined;
    try {
      qrSvg = await generateQRCodeSVG(smartLinkUrl, 190, logo);
    } catch {
      // A failed QR is not worth failing the page over — the badges still work.
    }
  }

  const marketingUrl = safeHttpUrl(info?.marketingUrl);
  // A phone can only install from its own store; showing the other one is
  // noise. Desktop has no store of its own, so it gets both.
  const iosUrl = deviceOS === 'android' ? undefined : safeStoreUrl(storeUrls.ios);
  const androidUrl = deviceOS === 'ios' ? undefined : safeStoreUrl(storeUrls.android);

  // The URL the QR encodes, shown as text so it can be read, typed or copied
  // when a camera is not an option.
  const displayLink = smartLinkUrl.replace(/^https?:\/\//, '');

  return (
    <div className="ae-page">
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
        {/* Quoted so the leading slashes read as the label they are, not as a
            stray JSX comment. */}
        <div className="ae-eyebrow">{'// get the app'}</div>

        <div className="ae-head">
          <AppIcon appId={appId} hasIcon={Boolean(iconUrl)} name={title} size={64} />
          <div className="ae-head-text">
            <h1 className="ae-name">{title}</h1>
            {info?.tagline && <p className="ae-tagline">{info.tagline}</p>}
          </div>
        </div>

        {info?.description && <p className="ae-desc">{info.description}</p>}

        {qrSvg && (
          <div className="ae-qr-block">
            <div className="ae-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div className="ae-qr-label">scan to open in the app</div>
            {/* Clamped to two lines in CSS; the title keeps the full value
                reachable on hover for anyone who needs to read it. */}
            <div className="ae-qr-url" title={smartLinkUrl}>{displayLink}</div>
          </div>
        )}

        {(iosUrl || androidUrl) && (
          <div className="ae-badges">
            {iosUrl && (
              <StoreBadge href={iosUrl} glyph={<AppleGlyph />} line1="Download on the" line2="App Store" />
            )}
            {androidUrl && (
              <StoreBadge href={androidUrl} glyph={<PlayGlyph />} line1="GET IT ON" line2="Google Play" />
            )}
          </div>
        )}

        {marketingUrl && (
          <a className="ae-more" href={marketingUrl} target="_blank" rel="noopener noreferrer">
            learn more about {title} →
          </a>
        )}
      </main>
    </div>
  );
}
