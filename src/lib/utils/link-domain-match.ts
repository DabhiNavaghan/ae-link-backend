// ── Link-domain matching ────────────────────────────────────────────
// The rule that decides "is this host one of ours?". Deliberately mirrored
// by the Flutter SDK (lib/src/services/link_domain_registry.dart) so a link
// is classified the same way on both sides.
//
// No mongoose, no env — safe for Edge middleware and the client bundle.

/** Strip a URL, host:port or trailing root dot down to a bare hostname. */
export function toBareHost(raw: string): string {
  let host = raw.trim().toLowerCase();
  if (!host) return '';
  if (host.includes('://')) {
    try {
      host = new URL(host).hostname;
    } catch {
      return '';
    }
  }
  host = host.split('/')[0].split(':')[0];
  while (host.endsWith('.')) host = host.slice(0, -1);
  return host;
}

/**
 * Whether [host] matches any entry in [domains].
 *
 * A bare entry (`organizer.aelinks.io`) matches that host exactly.
 * A `*.` entry (`*.aelinks.io`) matches the domain and any subdomain.
 *
 * Matching is anchored on a label boundary, so `evil-aelinks.io` and
 * `aelinks.io.attacker.com` never match `*.aelinks.io`.
 */
export function hostMatchesLinkDomains(
  host: string | null | undefined,
  domains: readonly string[]
): boolean {
  const target = toBareHost(host || '');
  if (!target || domains.length === 0) return false;

  for (const raw of domains) {
    const entry = raw.trim().toLowerCase();
    if (!entry) continue;

    if (entry.startsWith('*.')) {
      const base = toBareHost(entry.slice(2));
      if (base && (target === base || target.endsWith(`.${base}`))) return true;
      continue;
    }

    if (target === toBareHost(entry)) return true;
  }

  return false;
}
