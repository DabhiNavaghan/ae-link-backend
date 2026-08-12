// ── Host → App Mapping ──────────────────────────────────────────────
// Build-time constants, safe for Edge middleware and client bundles.
//
// Each entry must be a direct process.env reference so Next.js can inline
// it at build time. Object.entries() iteration does not work in the client
// bundle because process.env is not a real JavaScript object there.
//
// To add a new subdomain: add a line below and the corresponding env var.
// Promote to a Domain DB collection when the full multi-domain migration
// is done.

function buildHostMap(): Record<string, string> {
  const map: Record<string, string> = {};

  // ── Subdomain entries ──
  const alleventsId = process.env.NEXT_PUBLIC_DOMAIN_APP_ID_allevents_aelinks_io;
  if (alleventsId) map['allevents.aelinks.io'] = alleventsId;

  const organizerId = process.env.NEXT_PUBLIC_DOMAIN_APP_ID_organizer_aelinks_io;
  if (organizerId) map['organizer.aelinks.io'] = organizerId;

  // ▲ Add new subdomains here ▲

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
