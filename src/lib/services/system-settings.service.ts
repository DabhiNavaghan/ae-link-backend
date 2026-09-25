import SystemSettingsModel, {
  ISystemSettings,
  SYSTEM_SETTINGS_ID,
  MATCH_ATTEMPT_MAX_RETENTION_DAYS,
  MATCH_ATTEMPT_MIN_RETENTION_DAYS,
  EVENT_MAX_RETENTION_DAYS,
  EVENT_MIN_RETENTION_DAYS,
} from '@/lib/models/SystemSettings';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ service: 'system-settings' });

/**
 * How long a process trusts its copy of the settings document.
 *
 * Short on purpose: the admin flips the event-tracking switch expecting the
 * API to stop writing, and thirty seconds is the longest anyone should have
 * to wait to see that happen. The document is tiny and the read is by _id,
 * so refreshing this often costs nothing measurable.
 */
export const SYSTEM_SETTINGS_CACHE_MS = 30_000;

let cache: { value: ISystemSettings; expiresAt: number } | null = null;

/**
 * The raw settings document, or an empty object when none has been saved.
 *
 * Never throws: a database hiccup here must not take the events endpoint
 * down, so a failed read falls back to the last good copy — or to defaults,
 * which reproduce the behaviour of a build that had no settings at all.
 */
export async function getSystemSettings(): Promise<ISystemSettings> {
  if (cache && Date.now() < cache.expiresAt) return cache.value;

  try {
    const doc = await SystemSettingsModel.findById(SYSTEM_SETTINGS_ID).lean();
    const value = (doc as ISystemSettings | null) ?? { _id: SYSTEM_SETTINGS_ID };
    cache = { value, expiresAt: Date.now() + SYSTEM_SETTINGS_CACHE_MS };
    return value;
  } catch (err) {
    logger.warn({ error: String(err) }, 'System settings load failed — using last known values');
    if (cache) {
      // Keep serving the stale copy, but retry soon.
      cache.expiresAt = Date.now() + 5_000;
      return cache.value;
    }
    return { _id: SYSTEM_SETTINGS_ID };
  }
}

/** Drop the cached copy. Tests and the settings writer use this. */
export function invalidateSystemSettings(): void {
  cache = null;
}

function clampDays(value: unknown, min: number, max: number): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Whether the platform accepts events at all. Defaults to on: a missing
 * document must never silently stop tracking.
 */
export async function isEventTrackingEnabled(): Promise<boolean> {
  const s = await getSystemSettings();
  return s.eventTracking?.enabled !== false;
}

/**
 * Admin-set match-attempt window in days, or undefined when the admin has
 * not set one — the caller then falls back to the env-driven policy in
 * MatchAttempt.ts.
 */
export async function getMatchAttemptRetentionDays(): Promise<number | undefined> {
  const s = await getSystemSettings();
  return clampDays(
    s.matchAttempts?.retentionDays,
    MATCH_ATTEMPT_MIN_RETENTION_DAYS,
    MATCH_ATTEMPT_MAX_RETENTION_DAYS
  );
}

/**
 * Admin-set default for raw event retention, in days, or undefined when unset.
 * A tenant's own `settings.eventRetentionDays` takes precedence over this.
 */
export async function getDefaultEventRetentionDays(): Promise<number | undefined> {
  const s = await getSystemSettings();
  return clampDays(
    s.eventTracking?.retentionDays,
    EVENT_MIN_RETENTION_DAYS,
    EVENT_MAX_RETENTION_DAYS
  );
}

const SystemSettingsService = {
  getSystemSettings,
  invalidateSystemSettings,
  isEventTrackingEnabled,
  getMatchAttemptRetentionDays,
  getDefaultEventRetentionDays,
};

export default SystemSettingsService;
