import { NextRequest } from 'next/server';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ module: 'rate-limit' });

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const limits = new Map<string, RateLimitEntry>();

const WINDOW_MS =
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const PUBLIC_LIMIT = parseInt(
  process.env.RATE_LIMIT_PUBLIC_REQUESTS || '100',
  10
);
const AUTH_LIMIT = parseInt(
  process.env.RATE_LIMIT_AUTH_REQUESTS || '1000',
  10
);

/**
 * Get rate limit key from request
 */
function getRateLimitKey(request: NextRequest, tenantId?: string): string {
  // Use tenant ID if authenticated, otherwise use IP
  if (tenantId) {
    return `auth:${tenantId}`;
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  return `public:${ip}`;
}

/**
 * Check if request is rate limited
 */
export function checkRateLimit(
  request: NextRequest,
  tenantId?: string
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = getRateLimitKey(request, tenantId);
  const limit = tenantId ? AUTH_LIMIT : PUBLIC_LIMIT;
  const now = Date.now();

  let entry = limits.get(key);

  // Create new window if needed
  if (!entry || now >= entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + WINDOW_MS,
    };
    limits.set(key, entry);
  }

  entry.count++;

  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);
  const resetAt = entry.resetAt;

  if (!allowed) {
    logger.warn(
      { key, count: entry.count, limit },
      'Rate limit exceeded'
    );
  }

  return { allowed, remaining, resetAt };
}

/**
 * Clean up old entries (call periodically)
 */
export function cleanupRateLimitEntries(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of limits.entries()) {
    if (now >= entry.resetAt + WINDOW_MS) {
      limits.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug({ cleaned }, 'Cleaned up rate limit entries');
  }
}

// Clean up every hour
// @ts-ignore
if (typeof globalThis !== 'undefined') {
  // @ts-ignore
  if (!globalThis.rateLimitCleanupInterval) {
    // @ts-ignore
    globalThis.rateLimitCleanupInterval = setInterval(
      cleanupRateLimitEntries,
      3600000
    );
  }
}
