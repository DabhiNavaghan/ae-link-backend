import AppModel from '@/lib/models/App';
import { APP_HOST_MAP } from '@/lib/utils/domain-map';

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
 *   - `App.linkDomains` — the dashboard-managed list (authoritative)
 *   - `APP_HOST_MAP` — the existing env-var mapping, so deployments that have
 *     not populated the DB field yet keep working without a migration
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
  try {
    const doc = await AppModel.findById(appId).select('linkDomains').lean();
    if (doc && Array.isArray((doc as { linkDomains?: string[] }).linkDomains)) {
      fromDb = (doc as { linkDomains?: string[] }).linkDomains as string[];
    }
  } catch {
    // Fall through to the env-derived list — a DB hiccup should degrade to
    // "fewer domains", never to "more".
  }

  return sanitizeLinkDomains([...fromDb, ...fromEnv]);
}
