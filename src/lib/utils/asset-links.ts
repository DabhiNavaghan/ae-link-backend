// ── Digital Asset Links payload rules ───────────────────────────────
// Extracted from the route so the parts that are easy to get subtly wrong —
// which fingerprints a host publishes, and which relations an app grants — can
// be read and checked on their own. An assetlinks.json that is merely *wrong*
// does not error: App Links verification just quietly stops succeeding.

import { isDebugLinkHost } from '@/lib/utils/domain-map';

export interface AndroidAssetConfig {
  sha256?: string;
  debugSha256?: string;
  allowLoginCreds?: boolean;
}

/**
 * `sha256_cert_fingerprints` is an array, and an app usually needs more than
 * one entry in it: Play App Signing gives the upload key and the Play signing
 * key different fingerprints, and a build verified against only one of them
 * fails silently. The stored field holds them comma- or whitespace-separated.
 */
export function parseFingerprints(raw?: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,\s]+/)) {
    const fingerprint = part.trim().toUpperCase();
    if (fingerprint) seen.add(fingerprint);
  }
  return [...seen];
}

/**
 * A debug host publishes the *debug* signing certificate and nothing else, so
 * a release build can never verify itself against it — and a debug build can
 * never verify itself against a production host. That separation is the whole
 * point of having a debug domain, and it is enforced here rather than relying
 * on the two builds declaring different hosts.
 */
export function fingerprintsForHost(
  host: string,
  android?: AndroidAssetConfig
): string[] {
  return isDebugLinkHost(host)
    ? parseFingerprints(android?.debugSha256)
    : parseFingerprints(android?.sha256);
}

/**
 * `handle_all_urls` is what App Links verification needs. `get_login_creds` is
 * separate: it lets Google Smart Lock and Autofill share saved credentials
 * between the site and the app. An app that has it and quietly loses it stops
 * offering saved logins, with nothing in the app to explain why.
 */
export function relationsFor(android?: AndroidAssetConfig): string[] {
  const relations = ['delegate_permission/common.handle_all_urls'];
  if (android?.allowLoginCreds) {
    relations.push('delegate_permission/common.get_login_creds');
  }
  return relations;
}

/**
 * Kept short on a debug host, where the file changes while an app is still
 * being wired up — a wrong one otherwise stays pinned for an hour at every CDN
 * hop and at Google's verification fetcher.
 */
export function cacheHeaderForHost(host: string): string {
  return isDebugLinkHost(host)
    ? 'public, max-age=300, s-maxage=300'
    : 'public, max-age=3600, s-maxage=3600';
}
