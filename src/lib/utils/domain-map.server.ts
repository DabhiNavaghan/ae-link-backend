import AppModel from '@/lib/models/App';
import { APP_HOST_MAP, getLinkDomainsForPackages } from '@/lib/utils/domain-map';

export interface HostApp {
  _id: string;
  name: string;
  android?: { package?: string; sha256?: string; storeUrl?: string };
  ios?: { bundleId?: string; teamId?: string; appId?: string; storeUrl?: string };
}

/**
 * Resolve an inbound Host header to the app it represents (or null).
 * Used by well-known routes to scope association files to one app.
 * Server-only — relies on Mongoose, cannot run in Edge middleware.
 */
export async function getAppByHost(host: string): Promise<HostApp | null> {
  const appId = APP_HOST_MAP[host];
  if (!appId) return null;
  try {
    const doc = await AppModel.findById(appId).lean();
    if (!doc) return null;
    return {
      _id: doc._id.toString(),
      name: doc.name,
      android: doc.android ? {
        package: doc.android.package,
        sha256: doc.android.sha256,
        storeUrl: doc.android.storeUrl,
      } : undefined,
      ios: doc.ios ? {
        bundleId: doc.ios.bundleId,
        teamId: doc.ios.teamId,
        appId: doc.ios.appId,
        storeUrl: doc.ios.storeUrl,
      } : undefined,
    };
  } catch {
    return null;
  }
}

// ── Per-app link domains (SDK-facing) ───────────────────────────────
// The Flutter SDK asks for these at init instead of shipping the list inside
// the app binary. Two rules matter here:
//   1. Scope — only ever return the domains of the app that authenticated.
//      Never leak another tenant's hosts into an SDK response.
//   2. Safety — refuse entries that would make the SDK trust far too much
//      (a bare TLD, a wildcard on a TLD). A dashboard typo must not turn
//      every link on the internet into a first-party SmartLink.

/** Registrable-domain floor: an entry must have at least this many labels. */
const MIN_DOMAIN_LABELS = 2;

/** Hosts that legitimately have a single label — dev only. */
const SINGLE_LABEL_ALLOWLIST = new Set(['localhost']);

/**
 * Reject anything that is not a plausible, sufficiently specific host.
 * Applied to every domain before it leaves the server, so a bad dashboard
 * entry is contained here rather than in every installed app.
 */
export function isSafeLinkDomain(raw: string): boolean {
  const entry = raw.trim().toLowerCase();
  if (!entry || entry.length > 253) return false;

  const isWildcard = entry.startsWith('*.');
  const host = isWildcard ? entry.slice(2) : entry;
  if (!host || host.length > 253) return false;

  // No scheme, path, port, credentials or whitespace — bare hosts only.
  if (/[^a-z0-9.-]/.test(host)) return false;

  const labels = host.split('.');
  if (labels.some((l) => l.length === 0 || l.length > 63)) return false;
  if (labels.some((l) => l.startsWith('-') || l.endsWith('-'))) return false;

  if (labels.length < MIN_DOMAIN_LABELS) {
    // `localhost` is fine for local development; `com` / `*.io` are not.
    return !isWildcard && SINGLE_LABEL_ALLOWLIST.has(host);
  }

  return true;
}

/** Normalize, validate and dedupe a raw domain list. */
export function sanitizeLinkDomains(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const entry = item.trim().toLowerCase();
    if (isSafeLinkDomain(entry)) out.add(entry);
  }
  return [...out];
}

/**
 * The link hosts an SDK client authenticated for [appId] is allowed to know.
 *
 * Sources, unioned then sanitized:
 *   - the host **derived from the app's own identifiers** — `android.package`
 *     and `ios.bundleId`, e.g. `com.amitech.allevents` →
 *     `allevents.aelinks.io`. This is the normal path: registering an app is
 *     all it takes for its installs to be served the right domain.
 *   - `App.linkDomains` — an optional manual addition, for a host the rule
 *     cannot produce
 *   - `APP_HOST_MAP` — the existing env-var mapping, so deployments already
 *     relying on it keep working without a migration
 *
 * Returns an empty array when the app is unknown, which leaves the SDK
 * trusting only its configured `apiBaseUrl` host — the safe floor.
 */
export async function getLinkDomainsForApp(
  appId?: string | null
): Promise<string[]> {
  if (!appId) return [];

  const fromEnv = Object.entries(APP_HOST_MAP)
    .filter(([, id]) => id === appId)
    .map(([host]) => host);

  let fromDb: string[] = [];
  let derived: string[] = [];
  try {
    const doc = await AppModel.findById(appId)
      .select('linkDomains android.package ios.bundleId')
      .lean();
    if (doc) {
      const app = doc as {
        linkDomains?: string[];
        android?: { package?: string };
        ios?: { bundleId?: string };
      };
      if (Array.isArray(app.linkDomains)) fromDb = app.linkDomains;
      // The identifiers the app already declares imply its host, so a newly
      // registered app is served the right domain with nothing to fill in.
      derived = getLinkDomainsForPackages([
        app.android?.package,
        app.ios?.bundleId,
      ]);
    }
  } catch {
    // Fall through to the env-derived list — a DB hiccup should degrade to
    // "fewer domains", never to "more".
  }

  return sanitizeLinkDomains([...fromDb, ...derived, ...fromEnv]);
}

/**
 * Every link host owned by [tenantId], across all of its active apps.
 *
 * Used as the fallback when an SDK client authenticated with a tenant-level
 * key that we could not narrow to a single app — an unregistered package
 * name, or a launch that sent none. Without it those installs receive an
 * empty list and silently classify every short link as external, which is
 * the failure that pushes integrators into hardcoding `linkDomains`.
 *
 * Still tenant-scoped: the union never crosses a tenant boundary, so the
 * guarantee that one tenant's hosts never reach another's app is unchanged.
 * The cost of the wider list is only that an app may trust a sibling app's
 * host — both belong to the same customer, and an unresolvable short code
 * is rejected by `/api/v1/links/resolve` anyway.
 */
export async function getLinkDomainsForTenant(
  tenantId?: string | null
): Promise<string[]> {
  if (!tenantId) return [];

  try {
    const docs = await AppModel.find({ tenantId, isActive: true })
      .select('_id linkDomains android.package ios.bundleId')
      .lean();

    const appIds = new Set(docs.map((d) => d._id.toString()));

    const apps = docs as Array<{
      linkDomains?: string[];
      android?: { package?: string };
      ios?: { bundleId?: string };
    }>;

    const fromDb = apps.flatMap((a) =>
      Array.isArray(a.linkDomains) ? a.linkDomains : []
    );

    const derived = getLinkDomainsForPackages(
      apps.flatMap((a) => [a.android?.package, a.ios?.bundleId])
    );

    const fromEnv = Object.entries(APP_HOST_MAP)
      .filter(([, id]) => appIds.has(id))
      .map(([host]) => host);

    return sanitizeLinkDomains([...fromDb, ...derived, ...fromEnv]);
  } catch {
    // A DB hiccup degrades to "fewer domains", never to "more".
    return [];
  }
}

/**
 * The link hosts to hand an SDK client on init.
 *
 * Prefers the authenticated app's own list and widens to the tenant's full
 * set only when that comes back empty, so a correctly registered app is
 * never handed a sibling's hosts.
 */
export async function getLinkDomainsForSdk({
  tenantId,
  appId,
  packageName,
}: {
  tenantId?: string | null;
  appId?: string | null;
  packageName?: string | null;
}): Promise<string[]> {
  const scoped = await getLinkDomainsForApp(appId);
  if (scoped.length > 0) return scoped;

  // Unresolved app — an unregistered package, or a launch that sent none.
  // Widen to the tenant, and derive from the identifier the caller reported
  // so an app that is not registered yet still classifies its own links.
  // Deriving from a client-supplied id is safe: the rule is deterministic,
  // the host still has to exist and serve the short code, and the OS only
  // delivers links for hosts already declared in the app's manifest.
  const tenantWide = await getLinkDomainsForTenant(tenantId);
  const fromCaller = sanitizeLinkDomains(
    getLinkDomainsForPackages([packageName])
  );

  return sanitizeLinkDomains([...tenantWide, ...fromCaller]);
}
