/**
 * Shared client-IP extraction.
 *
 * WHY `cf-connecting-ip` is checked first: this app runs behind
 * Cloudflare → Traefik (Coolify) → Docker. Docker's userland proxy NATs the
 * connection, so Traefik sees the Docker gateway (172.23.0.1) as the peer and
 * writes that into `x-forwarded-for` / `x-real-ip`, making them useless on
 * this infra. Cloudflare's `cf-connecting-ip` carries the real client IP and
 * survives the proxy chain untouched, so it always takes priority; the other
 * headers are best-effort fallbacks only.
 *
 * Private/reserved addresses (the Docker gateway case) are skipped in favor
 * of the next source; if every source is private, the first value is still
 * returned and `getClientIpInfo` flags it with `isPrivate: true`.
 */

/**
 * Anything with a `get(name)` — covers `Headers` (from `Request`/`NextRequest`)
 * and the `ReadonlyHeaders` returned by `headers()` from `next/headers`.
 */
interface HeaderGetter {
  get(name: string): string | null;
}

/** A `Request`/`NextRequest`, or a bare headers object. */
export type IpSource = HeaderGetter | { headers: HeaderGetter };

export interface ClientIpInfo {
  ip: string | null;
  /** ISO 3166-1 alpha-2 code from Cloudflare's `cf-ipcountry`, if present. */
  country: string | null;
  /** True when the resolved IP is a private/reserved address (all sources were). */
  isPrivate: boolean;
}

function resolveHeaders(source: IpSource): HeaderGetter {
  // A bare headers object (Web `Headers`, or Next's `ReadonlyHeaders` from
  // `headers()`) exposes `get` directly — use it as-is. Only a
  // `Request`/`NextRequest` carries the headers under `.headers`.
  //
  // Do NOT branch on `'headers' in source`: Next's `ReadonlyHeaders` also has
  // an internal `headers` member, so that check unwraps it to a non-Headers
  // value whose `.get` is undefined — which threw `h.get is not a function`
  // and 404'd every short-link resolve.
  const s = source as { get?: unknown; headers?: HeaderGetter };
  if (typeof s.get === 'function') return source as HeaderGetter;
  if (s.headers && typeof s.headers.get === 'function') return s.headers;
  // Defensive fallback: never throw from IP extraction.
  return { get: () => null };
}

/** 10.x, 172.16-31.x, 192.168.x, 127.x, ::1, fc00::/7 (incl. IPv4-mapped IPv6). */
function isPrivateIp(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return (
    /^10\./.test(v4) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v4) ||
    /^192\.168\./.test(v4) ||
    /^127\./.test(v4) ||
    ip === '::1' ||
    /^f[cd][0-9a-f]{2}:/i.test(ip)
  );
}

/** Candidate IPs in priority order: cf-connecting-ip → x-forwarded-for[0] → x-real-ip. */
function candidateIps(h: HeaderGetter): string[] {
  const candidates: string[] = [];
  const cf = h.get('cf-connecting-ip')?.trim();
  if (cf) candidates.push(cf);
  const xff = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (xff) candidates.push(xff);
  const real = h.get('x-real-ip')?.trim();
  if (real) candidates.push(real);
  return candidates;
}

/**
 * Extract the client IP. Prefers the first public address across sources;
 * falls back to the highest-priority private one; null if no source is set.
 */
export function getClientIp(source: IpSource): string | null {
  const candidates = candidateIps(resolveHeaders(source));
  return candidates.find((ip) => !isPrivateIp(ip)) ?? candidates[0] ?? null;
}

/** Client IP plus Cloudflare geo country and a private-address flag. */
export function getClientIpInfo(source: IpSource): ClientIpInfo {
  const h = resolveHeaders(source);
  const ip = getClientIp(h);
  return {
    ip,
    country: h.get('cf-ipcountry')?.trim() || null,
    isPrivate: ip !== null && isPrivateIp(ip),
  };
}
