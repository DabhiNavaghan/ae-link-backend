/**
 * Browser-side fingerprint collection for deferred deep linking.
 *
 * Shared by every page that can precede an install — the redirect page and the
 * app-info interstitial — so the two always send the SDK the same signals to
 * match against. Browser-only: every export touches `window`.
 */

export interface BrowserFingerprint {
  screen: { width: number; height: number };
  /** Screen size in physical device pixels — the cross-context screen signal. */
  physicalScreen: { width: number; height: number };
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

export interface FingerprintPayload {
  linkId: string;
  tenantId: string;
  clickId?: string;
  mergedDestinationUrl?: string;
  mergedParams?: Record<string, any>;
}

export function collectFingerprint(): BrowserFingerprint {
  const nav = navigator as any;
  const tzOffsetMin = new Date().getTimezoneOffset();
  const tzSign = tzOffsetMin <= 0 ? '+' : '-';
  const tzHours = String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(2, '0');
  const tzMins = String(Math.abs(tzOffsetMin) % 60).padStart(2, '0');
  const timezoneOffset = `${tzSign}${tzHours}:${tzMins}`;

  // window.screen reports CSS pixels at the browser's own device-scale-
  // factor, which differs from Flutter's devicePixelRatio on most Android
  // devices. Multiplying back out by devicePixelRatio gives the panel's
  // real resolution, which both sides agree on.
  const dpr = window.devicePixelRatio || 1;

  return {
    screen: { width: window.screen.width, height: window.screen.height },
    physicalScreen: {
      width: Math.round(window.screen.width * dpr),
      height: Math.round(window.screen.height * dpr),
    },
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
}

/**
 * Post the fingerprint without blocking navigation. sendBeacon guarantees
 * delivery even when the OS is switching away to the app store mid-request;
 * the fetch path is only for browsers that lack it.
 */
export function sendFingerprint(payload: FingerprintPayload): void {
  try {
    const body = JSON.stringify({ ...payload, fingerprint: collectFingerprint() });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/v1/fingerprint',
        new Blob([body], { type: 'application/json' })
      );
    } else {
      fetch('/api/v1/fingerprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[SmartLink] Fingerprint collection error:', err);
  }
}
