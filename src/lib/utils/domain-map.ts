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

  // Live tunnel hosts on navaghandabhi.dev. They serve the same apps as the
  // aelinks.io production hosts, so they publish the release certificates —
  // unlike the debug aliases below, which are kept out of this map.
  const alleventsTunnelId = process.env.NEXT_PUBLIC_DOMAIN_APP_ID_allevents_navaghandabhi_dev;
  if (alleventsTunnelId) map['allevents.navaghandabhi.dev'] = alleventsTunnelId;

  const organizerTunnelId = process.env.NEXT_PUBLIC_DOMAIN_APP_ID_alleventsorg_navaghandabhi_dev;
  if (organizerTunnelId) map['alleventsorg.navaghandabhi.dev'] = organizerTunnelId;

  // ▲ Add new subdomains here ▲

  return map;
}

function buildStoreUrlMap(): Record<string, string> {
  const map: Record<string, string> = {};

  // Allevents app → https://smartlink.apps.allevents.app/apps/allevents-allevents/store?...
  const alleventsStore = process.env.NEXT_PUBLIC_STORE_URL_allevents_aelinks_io;
  map['allevents.aelinks.io'] = alleventsStore ||
    'https://smartlink.apps.allevents.app/apps/allevents-allevents/store?utm_source=smartlink&utm_medium=store-link&utm_campaign=allevents';

  // Organizer app — replace SLUG with the actual organizer app slug
  const organizerStore = process.env.NEXT_PUBLIC_STORE_URL_organizer_aelinks_io;
  map['organizer.aelinks.io'] = organizerStore ||
    'https://smartlink.apps.allevents.app/apps/allevents-manager-app/store?utm_source=smartlink&utm_medium=store-link&utm_campaign=allevents-manager-app';

  // Live tunnel hosts mirror the aelinks.io store pages.
  map['allevents.navaghandabhi.dev'] =
    process.env.NEXT_PUBLIC_STORE_URL_allevents_navaghandabhi_dev ||
    map['allevents.aelinks.io'];
  map['alleventsorg.navaghandabhi.dev'] =
    process.env.NEXT_PUBLIC_STORE_URL_alleventsorg_navaghandabhi_dev ||
    map['organizer.aelinks.io'];

  // ▲ Add new subdomains with fallback store URLs here ▲

  // Debug hosts show the same store page as the production host they alias —
  // a debug link that misses still has to send the tester somewhere sensible.
  for (const [debugHost, productionHost] of Object.entries(DEBUG_HOST_ALIASES)) {
    if (map[productionHost]) map[debugHost] = map[productionHost];
  }

  return map;
}

// ── Debug-only hosts ────────────────────────────────────────────────
// Hosts that only ever exist in debug builds. Each one is an *alias* of the
// production host it shadows, rather than a second host → appId entry, for two
// reasons.
//
// It cannot leak. Two things reverse-scan APP_HOST_MAP and neither may ever
// see a debug host:
//   - APP_PRIMARY_HOST below, which picks the host every dashboard and API
//     response builds a link URL on. A debug host there would put production
//     links on a debug domain.
//   - getLinkDomainsForApp() / getLinkDomainsForTenant() in
//     domain-map.server.ts, which tell the SDK which hosts to trust. A debug
//     host there would be handed to *release* installs at /api/v1/sdk/init.
// An alias never names an appId, so there is no path by which either could
// emit one.
//
// And it needs no new env var. NEXT_PUBLIC_* is inlined at build time, and
// this repo has been bitten twice by a host that silently stopped resolving
// because its variable was absent from the build (9f9f8be, d836c60) —
// HARDCODED_LINK_HOSTS below exists for exactly that reason. An alias inherits
// whatever its production sibling already resolves to, so a debug host is
// broken only when the production one already is.
const DEBUG_HOST_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  // No entries yet. navaghandabhi.dev hosts are live tunnel hosts, not debug
  // aliases, so they stay out of this map and publish release certificates.
});

/** The production host a debug host stands in for; any other host unchanged. */
export function resolveHostAlias(host: string): string {
  const normalized = normalizeHost(host);
  return DEBUG_HOST_ALIASES[normalized] || normalized;
}

export const APP_HOST_MAP: Readonly<Record<string, string>> = Object.freeze(buildHostMap());
export const APP_STORE_URL_MAP: Readonly<Record<string, string>> = Object.freeze(buildStoreUrlMap());

// Reverse: first host found per appId → primary hostname.
// Deliberately built from APP_HOST_MAP alone — a debug host must never become
// the host a production link URL is generated on.
const primary: Record<string, string> = {};
for (const [host, id] of Object.entries(APP_HOST_MAP)) {
  if (!primary[id]) primary[id] = host;
}
export const APP_PRIMARY_HOST: Readonly<Record<string, string>> = Object.freeze(primary);
// Always-recognized link hosts (hardcoded so they work even if env vars are missing at build)
const HARDCODED_LINK_HOSTS = ['organizer.aelinks.io', 'allevents.aelinks.io'];
/** Link hosts that only debug builds ever see. */
export const DEBUG_LINK_HOSTS = new Set(Object.keys(DEBUG_HOST_ALIASES));

export const APP_LINK_HOSTS = new Set([
  ...Object.keys(APP_HOST_MAP),
  ...HARDCODED_LINK_HOSTS,
  ...DEBUG_LINK_HOSTS,
]);

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

// ── Package/bundle id → link domain ─────────────────────────────────
// The SDK is told which hosts serve its links at init. Nobody wants to
// maintain that list per app, so it is *derived* from the identifier the app
// already declares — `com.amitech.allevents` → `allevents.aelinks.io` — and
// only the handful of apps whose domain does not follow the rule are named
// explicitly below.

/** Registrable domain every derived link host sits under. */
export const LINK_DOMAIN_BASE =
  process.env.NEXT_PUBLIC_LINK_DOMAIN_BASE || 'aelinks.io';

/**
 * Apps whose link host does not match their package id.
 *
 * Keep this as small as it can be: an entry here is a promise that a human
 * remembers to update it. Everything absent is derived by the rule above.
 */
export const PACKAGE_LINK_DOMAIN_OVERRIDES: Readonly<Record<string, string>> =
  Object.freeze({
    // Ships as `alleventsorg`, but the domain in service is `organizer`.
    'com.amitech.alleventsorg': `organizer.${LINK_DOMAIN_BASE}`,
  });

/**
 * Build-variant labels stripped before deriving, so a debug flavor
 * (`com.amitech.allevents.debug`) resolves to the same host as release
 * rather than to `debug.aelinks.io`.
 */
const BUILD_VARIANT_LABELS = new Set([
  'debug', 'dev', 'development', 'staging', 'stage',
  'alpha', 'beta', 'qa', 'test', 'internal', 'release',
]);

/**
 * The link host for an Android applicationId or iOS bundleId, or null when
 * the identifier yields nothing usable as a hostname label.
 *
 * Pure and free of DB or env lookups so the dashboard can show the same
 * answer the SDK will be served.
 */
export function getLinkDomainForPackage(
  packageId?: string | null
): string | null {
  if (!packageId) return null;

  const normalized = packageId.trim().toLowerCase();
  if (PACKAGE_LINK_DOMAIN_OVERRIDES[normalized]) {
    return PACKAGE_LINK_DOMAIN_OVERRIDES[normalized];
  }

  const labels = normalized.split('.').filter(Boolean);
  // Drop trailing flavor labels, never the last remaining one — a bare
  // `debug` as the whole identifier is malformed, not a variant.
  while (labels.length > 1 && BUILD_VARIANT_LABELS.has(labels[labels.length - 1])) {
    labels.pop();
  }

  // Re-check after stripping so a debug flavor of an overridden app
  // (`com.amitech.alleventsorg.debug`) resolves to the override too, rather
  // than falling through to the derived host.
  const stripped = labels.join('.');
  if (PACKAGE_LINK_DOMAIN_OVERRIDES[stripped]) {
    return PACKAGE_LINK_DOMAIN_OVERRIDES[stripped];
  }

  const last = labels[labels.length - 1];
  if (!last) return null;

  // Hostname labels allow letters, digits and hyphens only. Underscores are
  // legal in a package id, so map them across rather than dropping them.
  const slug = last.replace(/_/g, '-').replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
  if (!slug || slug.length > 63) return null;

  return `${slug}.${LINK_DOMAIN_BASE}`;
}

/** Every link host implied by an app's Android and iOS identifiers. */
export function getLinkDomainsForPackages(
  packageIds: Array<string | null | undefined>
): string[] {
  const out = new Set<string>();
  for (const id of packageIds) {
    const domain = getLinkDomainForPackage(id);
    if (domain) out.add(domain);
  }
  return [...out];
}

export function getProtocolForHost(host: string): 'http' | 'https' {
  return host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
}

export function isLinkHost(host: string): boolean {
  return APP_LINK_HOSTS.has(normalizeHost(host));
}

/**
 * True for a host that only debug builds are meant to reach. The association
 * files served on one carry the *debug* signing certificate, so a release
 * build can never verify it — which is the point.
 */
export function isDebugLinkHost(host: string): boolean {
  return DEBUG_LINK_HOSTS.has(normalizeHost(host));
}

/**
 * The app-store page a link host falls back to: its root, and any path on it
 * that does not resolve to a link. Undefined for the platform host, which has
 * its own pages to show.
 */
export function getStoreUrlForHost(host: string): string | undefined {
  return APP_STORE_URL_MAP[normalizeHost(host)];
}

/** Host header may carry a port (localhost:3000) or uppercase characters. */
export function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}
