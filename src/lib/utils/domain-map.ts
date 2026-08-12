// ── Host → App Mapping ──────────────────────────────────────────────
// Build-time constants, safe for Edge middleware.
//
// Only NEXT_PUBLIC_* env vars are available in Edge runtime. All values
// must be set at build time — changing them at runtime has no effect on
// the middleware unless it runs in Node.js mode.
//
// New subdomains: add a NEXT_PUBLIC_DOMAIN_APP_ID_<host> = <mongoId> pair.
// Example: NEXT_PUBLIC_DOMAIN_APP_ID_allevents_aelinks_io=69e9ae1298ff1451d33d865a
//
// Promote to a Domain DB collection when the full multi-domain migration
// is done.

function buildHostMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('NEXT_PUBLIC_DOMAIN_APP_ID_') || !value) continue;
    // NEXT_PUBLIC_DOMAIN_APP_ID_allevents_aelinks_io → allevents.aelinks.io
    const host = key.slice('NEXT_PUBLIC_DOMAIN_APP_ID_'.length).replace(/_/g, '.');
    map[host] = value;
  }
  return map;
}

export const APP_HOST_MAP: Readonly<Record<string, string>> = Object.freeze(buildHostMap());

// Reverse: first host found per appId → primary hostname
const primary: Record<string, string> = {};
for (const [host, id] of Object.entries(APP_HOST_MAP)) {
  if (!primary[id]) primary[id] = host;
}
export const APP_PRIMARY_HOST: Readonly<Record<string, string>> = Object.freeze(primary);
export const APP_LINK_HOSTS = new Set(Object.keys(APP_HOST_MAP));

export const PLATFORM_HOSTS = new Set([
  'smartlink.apps.allevents.app',
  'smartlink.vercel.app',
  'localhost:3000',
  'localhost:3001',
]);

export const ALL_ALLOWED_HOSTS = new Set([
  ...APP_LINK_HOSTS,
  ...PLATFORM_HOSTS,
]);

export function getPrimaryHostForApp(appId?: string | null): string {
  if (appId && APP_PRIMARY_HOST[appId]) return APP_PRIMARY_HOST[appId];
  return 'smartlink.apps.allevents.app';
}

export function getProtocolForHost(host: string): 'http' | 'https' {
  return host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
}
