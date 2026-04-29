'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GeoData {
  ip?: string;
  country_name?: string;
  country_code?: string;
  region?: string;
  region_code?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  org?: string;
  asn?: string;
  timezone?: string;
  postal?: string;
  utc_offset?: string;
  continent_code?: string;
  in_eu?: boolean;
  currency?: string;
  currency_name?: string;
  country_calling_code?: string;
  country_capital?: string;
  network?: string;
  error?: boolean;
  reason?: string;
}

interface DeviceInfoResponse {
  server: {
    ip: string;
    host: string;
    origin: string;
    referer: string;
    acceptLanguage: string;
    cfCountry: string | null;
    cfConnectingIp: string | null;
    isPrivateIp: boolean;
  };
  geo: GeoData | null;
  ua: {
    raw: string;
    browser: { name: string | null; version: string | null; major: string | null };
    os: { name: string | null; version: string | null };
    device: { type: string; model: string | null; vendor: string | null };
    cpu: { architecture: string | null };
    engine: { name: string | null; version: string | null };
  };
}

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
}

interface NetworkInformation {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface ExtendedNavigator extends Navigator {
  deviceMemory?: number;
  getBattery?: () => Promise<BatteryManager>;
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
  buildID?: string;
}

interface BrowserSnapshot {
  // Screen & Display
  screenWidth: number;
  screenHeight: number;
  availScreenWidth: number;
  availScreenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  pixelRatio: number;
  colorDepth: number;
  pixelDepth: number;
  orientation: string;
  // Platform
  platform: string;
  vendor: string;
  appName: string;
  appVersion: string;
  product: string;
  productSub: string;
  buildID: string | null;
  // Capabilities
  cpuCores: number;
  deviceMemory: number | null;
  maxTouchPoints: number;
  touchSupport: boolean;
  pointerEvents: boolean;
  // GPU
  gpuVendor: string;
  gpuRenderer: string;
  webGLVersion: string;
  webGLSupport: boolean;
  webGL2Support: boolean;
  canvas2DSupport: boolean;
  // Language
  language: string;
  languages: string[];
  timezoneIana: string;
  timeOffset: number;
  currentTime: string;
  // Storage
  cookiesEnabled: boolean;
  localStorageAvailable: boolean;
  sessionStorageAvailable: boolean;
  indexedDBAvailable: boolean;
  cacheStorageAvailable: boolean;
  // PWA
  isStandalone: boolean;
  serviceWorkerSupport: boolean;
  displayMode: string;
  pushSupport: boolean;
  notificationSupport: boolean;
  // Network
  isOnline: boolean;
  // Request context
  browserOrigin: string;
  browserHost: string;
  browserPathname: string;
  browserProtocol: string;
  browserReferrer: string;
  browserSearch: string;
  // Features
  webRTCSupport: boolean;
  webAssemblySupport: boolean;
  sharedArrayBufferSupport: boolean;
  // Input
  keyboardSupport: boolean;
  gamepadSupport: boolean;
  // Misc
  doNotTrack: string | null;
  pdfViewerEnabled: boolean;
  javaEnabled: boolean;
  scrollX: number;
  scrollY: number;
}

interface BatterySnapshot {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
}

interface MediaSnapshot {
  cameras: number;
  microphones: number;
  audioOutputs: number;
  cameraLabels: string[];
  requiresPermission: boolean;
}

interface NetworkSnapshot {
  type: string | null;
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
  saveData: boolean | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type RowValue = string | number | boolean | null | undefined;

function ValueBadge({ value }: { value: RowValue }) {
  if (value === null || value === undefined) {
    return <span className="text-slate-400 italic text-xs">—</span>;
  }
  if (value === '') {
    return <span className="text-slate-400 italic text-xs">empty</span>;
  }
  if (typeof value === 'boolean') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
          value ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-600'
        }`}
      >
        {value ? '✓' : '✗'} {value ? 'Yes' : 'No'}
      </span>
    );
  }
  return <span className="text-slate-800 text-xs font-mono break-all">{String(value)}</span>;
}

function SkeletonRow() {
  return <div className="h-3.5 w-28 bg-slate-200 rounded animate-pulse" />;
}

function InfoRow({
  label,
  value,
  loading = false,
  mono = true,
}: {
  label: string;
  value: RowValue;
  loading?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-2 hover:bg-slate-50 transition-colors group">
      <span className="text-xs text-slate-500 font-medium w-40 flex-shrink-0 pt-0.5 leading-tight">
        {label}
      </span>
      <div className="flex-1 min-w-0">
        {loading ? (
          <SkeletonRow />
        ) : mono ? (
          <ValueBadge value={value} />
        ) : (
          <span className="text-xs text-slate-700 break-words">{value as string}</span>
        )}
      </div>
    </div>
  );
}

const SECTION_COLORS: Record<string, { header: string; dot: string }> = {
  blue:   { header: 'from-primary-50 to-primary-100 border-primary-200', dot: 'bg-primary-400' },
  teal:   { header: 'from-secondary-50 to-secondary-100 border-secondary-200', dot: 'bg-secondary-400' },
  orange: { header: 'from-accent-50 to-accent-100 border-accent-200', dot: 'bg-accent-400' },
  green:  { header: 'from-success-50 to-success-100 border-success-200', dot: 'bg-success-400' },
  yellow: { header: 'from-warning-50 to-warning-100 border-warning-200', dot: 'bg-warning-400' },
  red:    { header: 'from-danger-50 to-danger-100 border-danger-200', dot: 'bg-danger-400' },
  slate:  { header: 'from-slate-50 to-slate-100 border-slate-200', dot: 'bg-slate-400' },
};

function Section({
  title,
  icon,
  color = 'blue',
  loading = false,
  children,
}: {
  title: string;
  icon: string;
  color?: keyof typeof SECTION_COLORS;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const c = SECTION_COLORS[color] ?? SECTION_COLORS.blue;
  return (
    <div className="overflow-hidden rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className={`px-4 py-2.5 bg-gradient-to-r ${c.header} border-b flex items-center gap-2`}>
        <span className="text-base leading-none">{icon}</span>
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</h3>
        {loading && (
          <div className="ml-auto flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-bounce`} style={{ animationDelay: '0ms' }} />
            <div className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-bounce`} style={{ animationDelay: '150ms' }} />
            <div className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-bounce`} style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GetDevicePage() {
  const [apiData, setApiData] = useState<DeviceInfoResponse | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [browser, setBrowser] = useState<BrowserSnapshot | null>(null);
  const [battery, setBattery] = useState<BatterySnapshot | null>(null);
  const [batteryLoading, setBatteryLoading] = useState(true);
  const [batterySupported, setBatterySupported] = useState(true);
  const [media, setMedia] = useState<MediaSnapshot | null>(null);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [netInfo, setNetInfo] = useState<NetworkSnapshot | null>(null);
  const [clientGeo, setClientGeo] = useState<GeoData | null>(null);
  const [clientGeoLoading, setClientGeoLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Collect sync browser data immediately ────────────────────────────────
  const collectBrowser = useCallback(() => {
    if (typeof window === 'undefined') return;

    const nav = navigator as ExtendedNavigator;

    // GPU via WebGL
    let gpuVendor = 'Unknown';
    let gpuRenderer = 'Unknown';
    let webGLSupport = false;
    let webGL2Support = false;
    let webGLVersion = 'None';
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') ?? (c.getContext('experimental-webgl') as WebGLRenderingContext | null);
      if (gl) {
        webGLSupport = true;
        webGLVersion = 'WebGL 1.0';
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          gpuVendor = (gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string) || 'Unknown';
          gpuRenderer = (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string) || 'Unknown';
        }
      }
      const c2 = document.createElement('canvas');
      const gl2 = c2.getContext('webgl2') as WebGL2RenderingContext | null;
      if (gl2) {
        webGL2Support = true;
        webGLVersion = 'WebGL 2.0';
        if (!webGLSupport) {
          const dbg = gl2.getExtension('WEBGL_debug_renderer_info');
          if (dbg) {
            gpuVendor = (gl2.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string) || 'Unknown';
            gpuRenderer = (gl2.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string) || 'Unknown';
          }
        }
      }
    } catch { /* WebGL not available */ }

    let canvas2DSupport = false;
    try {
      canvas2DSupport = !!document.createElement('canvas').getContext('2d');
    } catch { /* not available */ }

    let localStorageAvailable = false;
    let sessionStorageAvailable = false;
    try { localStorage.setItem('__probe__', '1'); localStorage.removeItem('__probe__'); localStorageAvailable = true; } catch { /* blocked */ }
    try { sessionStorage.setItem('__probe__', '1'); sessionStorage.removeItem('__probe__'); sessionStorageAvailable = true; } catch { /* blocked */ }

    let displayMode = 'browser';
    try {
      if (window.matchMedia('(display-mode: standalone)').matches) displayMode = 'standalone';
      else if (window.matchMedia('(display-mode: fullscreen)').matches) displayMode = 'fullscreen';
      else if (window.matchMedia('(display-mode: minimal-ui)').matches) displayMode = 'minimal-ui';
    } catch { /* not supported */ }

    const tzOptions = Intl.DateTimeFormat().resolvedOptions();

    const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    if (conn) {
      setNetInfo({
        type: conn.type ?? null,
        effectiveType: conn.effectiveType ?? null,
        downlink: conn.downlink ?? null,
        rtt: conn.rtt ?? null,
        saveData: conn.saveData ?? null,
      });
    } else {
      setNetInfo({ type: null, effectiveType: null, downlink: null, rtt: null, saveData: null });
    }

    const orientation = (() => {
      try { return screen.orientation?.type ?? 'unknown'; } catch { return 'unknown'; }
    })();

    setBrowser({
      screenWidth: screen.width,
      screenHeight: screen.height,
      availScreenWidth: screen.availWidth,
      availScreenHeight: screen.availHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth ?? screen.colorDepth,
      orientation,
      platform: nav.platform,
      vendor: nav.vendor || 'Unknown',
      appName: nav.appName,
      appVersion: nav.appVersion,
      product: nav.product,
      productSub: nav.productSub ?? '',
      buildID: nav.buildID ?? null,
      cpuCores: nav.hardwareConcurrency || 0,
      deviceMemory: nav.deviceMemory ?? null,
      maxTouchPoints: nav.maxTouchPoints,
      touchSupport: nav.maxTouchPoints > 0 || 'ontouchstart' in window,
      pointerEvents: 'PointerEvent' in window,
      gpuVendor,
      gpuRenderer,
      webGLVersion,
      webGLSupport,
      webGL2Support,
      canvas2DSupport,
      language: nav.language,
      languages: Array.from(nav.languages ?? [nav.language]),
      timezoneIana: tzOptions.timeZone,
      timeOffset: -new Date().getTimezoneOffset(),
      currentTime: new Date().toISOString(),
      cookiesEnabled: nav.cookieEnabled,
      localStorageAvailable,
      sessionStorageAvailable,
      indexedDBAvailable: !!window.indexedDB,
      cacheStorageAvailable: 'caches' in window,
      isStandalone: displayMode === 'standalone',
      serviceWorkerSupport: 'serviceWorker' in nav,
      displayMode,
      pushSupport: 'PushManager' in window,
      notificationSupport: 'Notification' in window,
      isOnline: nav.onLine,
      browserOrigin: window.location.origin,
      browserHost: window.location.host,
      browserPathname: window.location.pathname,
      browserProtocol: window.location.protocol,
      browserReferrer: document.referrer,
      browserSearch: window.location.search,
      webRTCSupport: !!(window.RTCPeerConnection ?? (window as unknown as Record<string, unknown>).webkitRTCPeerConnection),
      webAssemblySupport: typeof WebAssembly !== 'undefined',
      sharedArrayBufferSupport: typeof SharedArrayBuffer !== 'undefined',
      keyboardSupport: 'keyboard' in nav,
      gamepadSupport: 'getGamepads' in nav,
      doNotTrack: nav.doNotTrack ?? null,
      pdfViewerEnabled: nav.pdfViewerEnabled ?? false,
      javaEnabled: false,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    });
  }, []);

  const fetchApi = useCallback(async () => {
    setApiLoading(true);
    try {
      const res = await fetch('/api/device-info', { cache: 'no-store' });
      if (res.ok) setApiData(await res.json());
    } catch { /* API unreachable */ }
    finally { setApiLoading(false); }
  }, []);

  // Calls ipapi.co directly from the browser — it sees the real public IP
  // regardless of whether the server is behind localhost/NAT.
  const fetchClientGeo = useCallback(async () => {
    setClientGeoLoading(true);
    try {
      const res = await fetch('https://ipapi.co/json/', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (res.ok) {
        const data: GeoData = await res.json();
        if (!data.error) setClientGeo(data);
      }
    } catch { /* network error */ }
    finally { setClientGeoLoading(false); }
  }, []);

  const collectBattery = useCallback(async () => {
    setBatteryLoading(true);
    const nav = navigator as ExtendedNavigator;
    if (nav.getBattery) {
      try {
        const bat = await nav.getBattery();
        setBattery({
          level: Math.round(bat.level * 100),
          charging: bat.charging,
          chargingTime: bat.chargingTime,
          dischargingTime: bat.dischargingTime,
        });
      } catch { setBatterySupported(false); }
    } else {
      setBatterySupported(false);
    }
    setBatteryLoading(false);
  }, []);

  const collectMedia = useCallback(async () => {
    setMediaLoading(true);
    if (navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === 'videoinput');
        const mics = devices.filter(d => d.kind === 'audioinput');
        const outs = devices.filter(d => d.kind === 'audiooutput');
        const requiresPermission = cams.every(d => !d.label);
        setMedia({
          cameras: cams.length,
          microphones: mics.length,
          audioOutputs: outs.length,
          cameraLabels: cams.map(d => d.label || 'Camera (permission needed)'),
          requiresPermission,
        });
      } catch { /* permission denied or not supported */ }
    }
    setMediaLoading(false);
  }, []);

  useEffect(() => {
    collectBrowser();
    fetchApi();
    fetchClientGeo();
    collectBattery();
    collectMedia();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleRefresh = () => {
    setApiData(null);
    setBrowser(null);
    setBattery(null);
    setMedia(null);
    setNetInfo(null);
    setClientGeo(null);
    setClientGeoLoading(true);
    setBatterySupported(true);
    setRefreshKey(k => k + 1);
  };

  const handleCopyAll = () => {
    const snapshot = {
      timestamp: new Date().toISOString(),
      publicIp: clientGeo?.ip ?? apiData?.server.ip,
      serverIp: apiData?.server.ip,
      geo: clientGeo ?? apiData?.geo,
      userAgent: apiData?.ua,
      server: apiData?.server,
      browser,
      battery,
      media,
      network: netInfo,
    };
    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const fmt = (v: number | undefined | null, unit = '') =>
    v !== null && v !== undefined ? `${v}${unit}` : null;

  const fmtTime = (secs: number) => {
    if (!isFinite(secs)) return 'N/A';
    const m = Math.floor(secs / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m`;
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center text-white text-sm font-bold bg-primary-600" style={{ borderRadius: '50%' }}>
              🔍
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Device Inspector</h1>
              <p className="text-xs text-slate-500">
                {apiLoading ? 'Collecting device info…' : `Collected ${new Date().toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors"
            >
              <span>↺</span> Refresh
            </button>
            <button
              onClick={handleCopyAll}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                copied
                  ? 'bg-success-100 text-success-700 border border-success-200'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {copied ? '✓ Copied!' : '⧉ Copy All JSON'}
            </button>
          </div>
        </div>
      </div>

      {/* IP + UA quick summary bar */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-2">
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 flex flex-wrap gap-x-6 gap-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Public IP</span>
            {clientGeoLoading ? <SkeletonRow /> : (
              <span className="font-mono font-semibold text-slate-800">
                {clientGeo?.ip ?? apiData?.server.ip ?? '—'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Location</span>
            {clientGeoLoading ? <SkeletonRow /> : (
              <span className="font-mono font-semibold text-slate-800">
                {(clientGeo ?? apiData?.geo)?.city ?? '—'}
                {(clientGeo ?? apiData?.geo)?.country_code ? `, ${(clientGeo ?? apiData?.geo)?.country_code}` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Browser</span>
            {apiLoading ? <SkeletonRow /> : (
              <span className="font-mono font-semibold text-slate-800">
                {[apiData?.ua.browser.name, apiData?.ua.browser.version].filter(Boolean).join(' ') || '—'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">OS</span>
            {apiLoading ? <SkeletonRow /> : (
              <span className="font-mono font-semibold text-slate-800">
                {[apiData?.ua.os.name, apiData?.ua.os.version].filter(Boolean).join(' ') || '—'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Device</span>
            {apiLoading ? <SkeletonRow /> : (
              <span className="font-mono font-semibold text-slate-800 capitalize">
                {apiData?.ua.device.type ?? '—'}
                {apiData?.ua.device.model ? ` · ${apiData.ua.device.model}` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Online</span>
            <span className={`w-2 h-2 rounded-full ${browser?.isOnline ? 'bg-success-500' : 'bg-danger-500'}`} />
            <span className="font-mono font-semibold text-slate-800">
              {browser ? (browser.isOnline ? 'Online' : 'Offline') : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* 📱 Device & Browser */}
        <Section title="Device & Browser" icon="📱" color="blue" loading={apiLoading}>
          <InfoRow label="User Agent" value={apiData?.ua.raw} loading={apiLoading} />
          <InfoRow label="Device Type" value={apiData?.ua.device.type} loading={apiLoading} />
          <InfoRow label="Device Model" value={apiData?.ua.device.model} loading={apiLoading} />
          <InfoRow label="Device Vendor" value={apiData?.ua.device.vendor} loading={apiLoading} />
          <InfoRow label="OS" value={apiData?.ua.os.name} loading={apiLoading} />
          <InfoRow label="OS Version" value={apiData?.ua.os.version} loading={apiLoading} />
          <InfoRow label="Browser" value={apiData?.ua.browser.name} loading={apiLoading} />
          <InfoRow label="Browser Version" value={apiData?.ua.browser.version} loading={apiLoading} />
          <InfoRow label="Browser Engine" value={apiData?.ua.engine.name} loading={apiLoading} />
          <InfoRow label="Engine Version" value={apiData?.ua.engine.version} loading={apiLoading} />
          <InfoRow label="CPU Arch" value={apiData?.ua.cpu.architecture} loading={apiLoading} />
          <InfoRow label="Platform" value={browser?.platform} loading={!browser} />
          <InfoRow label="Vendor" value={browser?.vendor} loading={!browser} />
          <InfoRow label="App Name" value={browser?.appName} loading={!browser} />
          <InfoRow label="Product" value={browser?.product} loading={!browser} />
          <InfoRow label="Build ID" value={browser?.buildID} loading={!browser} />
        </Section>

        {/* 🌍 Network & Location */}
        {(() => {
          // clientGeo is authoritative for IP (browser makes the request, ipapi.co sees real public IP).
          // apiData?.geo is authoritative in production; falls back to clientGeo on localhost.
          const geo = clientGeo ?? apiData?.geo;
          const geoLoading = clientGeoLoading;
          return (
            <Section title="Network & Location" icon="🌍" color="teal" loading={geoLoading}>
              <InfoRow label="Public IP" value={clientGeo?.ip ?? null} loading={clientGeoLoading} />
              <InfoRow label="Server-Detected IP" value={apiData?.server.ip} loading={apiLoading} />
              <InfoRow label="CF Connecting IP" value={apiData?.server.cfConnectingIp} loading={apiLoading} />
              <InfoRow label="Country" value={geo?.country_name} loading={geoLoading} />
              <InfoRow label="Country Code" value={geo?.country_code} loading={geoLoading} />
              <InfoRow label="Continent" value={geo?.continent_code} loading={geoLoading} />
              <InfoRow label="Region" value={geo?.region} loading={geoLoading} />
              <InfoRow label="Region Code" value={geo?.region_code} loading={geoLoading} />
              <InfoRow label="City" value={geo?.city} loading={geoLoading} />
              <InfoRow label="Postal Code" value={geo?.postal} loading={geoLoading} />
              <InfoRow label="Latitude" value={fmt(geo?.latitude, '°')} loading={geoLoading} />
              <InfoRow label="Longitude" value={fmt(geo?.longitude, '°')} loading={geoLoading} />
              <InfoRow label="ISP / Org" value={geo?.org} loading={geoLoading} />
              <InfoRow label="ASN" value={geo?.asn} loading={geoLoading} />
              <InfoRow label="Timezone" value={geo?.timezone} loading={geoLoading} />
              <InfoRow label="UTC Offset" value={geo?.utc_offset} loading={geoLoading} />
              <InfoRow label="Currency" value={geo?.currency ? `${geo.currency} (${geo.currency_name ?? ''})` : null} loading={geoLoading} />
              <InfoRow label="Calling Code" value={geo?.country_calling_code} loading={geoLoading} />
              <InfoRow label="Capital" value={geo?.country_capital} loading={geoLoading} />
              <InfoRow label="In EU" value={geo?.in_eu} loading={geoLoading} />
              <InfoRow label="CF Country" value={apiData?.server.cfCountry} loading={apiLoading} />
              <InfoRow label="Is Private IP" value={apiData?.server.isPrivateIp} loading={apiLoading} />
            </Section>
          );
        })()}

        {/* 🖥️ Screen & Display */}
        <Section title="Screen & Display" icon="🖥️" color="orange" loading={!browser}>
          <InfoRow label="Screen Width" value={fmt(browser?.screenWidth, 'px')} loading={!browser} />
          <InfoRow label="Screen Height" value={fmt(browser?.screenHeight, 'px')} loading={!browser} />
          <InfoRow label="Avail Width" value={fmt(browser?.availScreenWidth, 'px')} loading={!browser} />
          <InfoRow label="Avail Height" value={fmt(browser?.availScreenHeight, 'px')} loading={!browser} />
          <InfoRow label="Viewport Width" value={fmt(browser?.viewportWidth, 'px')} loading={!browser} />
          <InfoRow label="Viewport Height" value={fmt(browser?.viewportHeight, 'px')} loading={!browser} />
          <InfoRow label="Pixel Ratio" value={browser?.pixelRatio} loading={!browser} />
          <InfoRow label="Color Depth" value={fmt(browser?.colorDepth, '-bit')} loading={!browser} />
          <InfoRow label="Pixel Depth" value={fmt(browser?.pixelDepth, '-bit')} loading={!browser} />
          <InfoRow label="Orientation" value={browser?.orientation} loading={!browser} />
        </Section>

        {/* ⚙️ Device Capabilities */}
        <Section title="Device Capabilities" icon="⚙️" color="slate" loading={!browser}>
          <InfoRow label="CPU Cores" value={browser?.cpuCores} loading={!browser} />
          <InfoRow label="Device Memory" value={browser?.deviceMemory !== null && browser?.deviceMemory !== undefined ? `${browser.deviceMemory} GB (approx)` : null} loading={!browser} />
          <InfoRow label="Touch Support" value={browser?.touchSupport} loading={!browser} />
          <InfoRow label="Max Touch Points" value={browser?.maxTouchPoints} loading={!browser} />
          <InfoRow label="Pointer Events" value={browser?.pointerEvents} loading={!browser} />
          <InfoRow label="GPU Vendor" value={browser?.gpuVendor} loading={!browser} />
          <InfoRow label="GPU Renderer" value={browser?.gpuRenderer} loading={!browser} />
          <InfoRow label="WebGL Version" value={browser?.webGLVersion} loading={!browser} />
          <InfoRow label="WebGL Support" value={browser?.webGLSupport} loading={!browser} />
          <InfoRow label="WebGL 2.0" value={browser?.webGL2Support} loading={!browser} />
          <InfoRow label="Canvas 2D" value={browser?.canvas2DSupport} loading={!browser} />
          <InfoRow label="WebAssembly" value={browser?.webAssemblySupport} loading={!browser} />
          <InfoRow label="SharedArrayBuffer" value={browser?.sharedArrayBufferSupport} loading={!browser} />
          <InfoRow label="WebRTC" value={browser?.webRTCSupport} loading={!browser} />
          <InfoRow label="Gamepad API" value={browser?.gamepadSupport} loading={!browser} />
          <InfoRow label="Keyboard API" value={browser?.keyboardSupport} loading={!browser} />
          <InfoRow label="PDF Viewer" value={browser?.pdfViewerEnabled} loading={!browser} />
        </Section>

        {/* 🔋 Battery */}
        <Section title="Battery" icon="🔋" color="green" loading={batteryLoading}>
          {!batterySupported && !batteryLoading ? (
            <div className="px-4 py-3 text-xs text-slate-500 italic">Battery API not supported in this browser.</div>
          ) : (
            <>
              <InfoRow label="Battery Level"
                value={battery ? `${battery.level}%` : null}
                loading={batteryLoading}
              />
              <InfoRow label="Charging" value={battery?.charging} loading={batteryLoading} />
              <InfoRow
                label="Charging Time"
                value={battery?.charging === false ? 'N/A' : battery ? fmtTime(battery.chargingTime) : null}
                loading={batteryLoading}
              />
              <InfoRow
                label="Discharging Time"
                value={battery?.charging ? 'N/A' : battery ? fmtTime(battery.dischargingTime) : null}
                loading={batteryLoading}
              />
            </>
          )}
        </Section>

        {/* 📡 Network Quality */}
        <Section title="Network Quality" icon="📡" color="yellow" loading={!browser}>
          <InfoRow label="Online" value={browser?.isOnline} loading={!browser} />
          <InfoRow label="Connection Type" value={netInfo?.type} loading={!browser} />
          <InfoRow label="Effective Type" value={netInfo?.effectiveType} loading={!browser} />
          <InfoRow label="Downlink Speed" value={netInfo?.downlink !== null && netInfo?.downlink !== undefined ? `${netInfo.downlink} Mbps` : null} loading={!browser} />
          <InfoRow label="RTT Latency" value={netInfo?.rtt !== null && netInfo?.rtt !== undefined ? `${netInfo.rtt} ms` : null} loading={!browser} />
          <InfoRow label="Save Data Mode" value={netInfo?.saveData} loading={!browser} />
        </Section>

        {/* 🌐 Language & Locale */}
        <Section title="Language & Locale" icon="🌐" color="blue" loading={!browser}>
          <InfoRow label="Language" value={browser?.language} loading={!browser} />
          <InfoRow label="All Languages" value={browser?.languages.join(', ')} loading={!browser} />
          <InfoRow label="Timezone (IANA)" value={browser?.timezoneIana} loading={!browser} />
          <InfoRow label="Time Offset" value={browser?.timeOffset !== undefined ? `UTC${browser.timeOffset >= 0 ? '+' : ''}${Math.floor(browser.timeOffset / 60)}:${String(Math.abs(browser.timeOffset % 60)).padStart(2, '0')}` : null} loading={!browser} />
          <InfoRow label="Current Time" value={browser?.currentTime} loading={!browser} />
          <InfoRow label="Accept-Language" value={apiData?.server.acceptLanguage} loading={apiLoading} />
        </Section>

        {/* 🎧 Media Devices */}
        <Section title="Media Devices" icon="🎧" color="teal" loading={mediaLoading}>
          <InfoRow label="Camera Count" value={media?.cameras} loading={mediaLoading} />
          <InfoRow label="Microphone Count" value={media?.microphones} loading={mediaLoading} />
          <InfoRow label="Audio Outputs" value={media?.audioOutputs} loading={mediaLoading} />
          <InfoRow label="Labels Available" value={media !== null ? !media.requiresPermission : null} loading={mediaLoading} />
          {media?.cameraLabels.map((label, i) => (
            <InfoRow key={i} label={`Camera ${i + 1}`} value={label} loading={false} />
          ))}
          {media === null && !mediaLoading && (
            <div className="px-4 py-3 text-xs text-slate-500 italic">Media devices API not available.</div>
          )}
        </Section>

        {/* 🍪 Storage & Session */}
        <Section title="Storage & Session" icon="🍪" color="orange" loading={!browser}>
          <InfoRow label="Cookies Enabled" value={browser?.cookiesEnabled} loading={!browser} />
          <InfoRow label="LocalStorage" value={browser?.localStorageAvailable} loading={!browser} />
          <InfoRow label="SessionStorage" value={browser?.sessionStorageAvailable} loading={!browser} />
          <InfoRow label="IndexedDB" value={browser?.indexedDBAvailable} loading={!browser} />
          <InfoRow label="Cache Storage" value={browser?.cacheStorageAvailable} loading={!browser} />
          <InfoRow label="Do Not Track" value={browser?.doNotTrack} loading={!browser} />
        </Section>

        {/* 📲 PWA / App Info */}
        <Section title="PWA / App Info" icon="📲" color="green" loading={!browser}>
          <InfoRow label="Display Mode" value={browser?.displayMode} loading={!browser} />
          <InfoRow label="Standalone" value={browser?.isStandalone} loading={!browser} />
          <InfoRow label="Service Worker" value={browser?.serviceWorkerSupport} loading={!browser} />
          <InfoRow label="Push Support" value={browser?.pushSupport} loading={!browser} />
          <InfoRow label="Notifications" value={browser?.notificationSupport} loading={!browser} />
        </Section>

        {/* 🔗 Request Context */}
        <Section title="Request Context" icon="🔗" color="slate" loading={apiLoading || !browser}>
          <InfoRow label="Origin" value={browser?.browserOrigin} loading={!browser} />
          <InfoRow label="Host" value={browser?.browserHost} loading={!browser} />
          <InfoRow label="Protocol" value={browser?.browserProtocol} loading={!browser} />
          <InfoRow label="Pathname" value={browser?.browserPathname} loading={!browser} />
          <InfoRow label="Query String" value={browser?.browserSearch || null} loading={!browser} />
          <InfoRow label="Referrer (JS)" value={browser?.browserReferrer || null} loading={!browser} />
          <InfoRow label="Referrer (HTTP)" value={apiData?.server.referer || null} loading={apiLoading} />
          <InfoRow label="Server Host" value={apiData?.server.host} loading={apiLoading} />
          <InfoRow label="Scroll X" value={fmt(browser?.scrollX, 'px')} loading={!browser} />
          <InfoRow label="Scroll Y" value={fmt(browser?.scrollY, 'px')} loading={!browser} />
        </Section>

      </div>

      {/* Raw User Agent */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="overflow-hidden rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 to-slate-100 border-b flex items-center gap-2">
            <span>🔤</span>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Raw User Agent</h3>
          </div>
          <div className="px-4 py-3">
            {apiLoading ? (
              <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
            ) : (
              <p className="text-xs font-mono text-slate-700 break-all leading-relaxed">
                {apiData?.ua.raw || '—'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
