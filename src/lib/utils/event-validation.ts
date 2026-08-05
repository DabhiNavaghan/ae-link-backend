import crypto from 'crypto';

/**
 * Validation and sanitisation for everything that crosses the ingest boundary.
 *
 * Every function here assumes the input is hostile: it comes from a mobile app
 * that anyone can decompile, repackage and point at this API with a valid key.
 * Nothing is trusted for shape, size, type or depth.
 */

// ── Limits ─────────────────────────────────────────────────────────────────

export const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export const LIMITS = {
  /** Events per request. Keeps a single request's work bounded and predictable. */
  BATCH_MAX: 50,
  /** Serialized size of `properties`. */
  PROPERTIES_MAX_BYTES: 8 * 1024,
  PROPERTIES_MAX_KEYS: 50,
  PROPERTY_KEY_MAX_LENGTH: 64,
  PROPERTY_STRING_MAX_LENGTH: 500,
  /** Nested objects/arrays are flattened away past this depth. */
  PROPERTIES_MAX_DEPTH: 3,
  PROPERTIES_MAX_ARRAY_ITEMS: 20,

  TRAITS_MAX_KEYS: 30,
  TRAITS_MAX_BYTES: 4 * 1024,

  /** How far occurredAt may drift from server time before we reject it. */
  CLOCK_SKEW_MAX_MS: 24 * 60 * 60 * 1000,

  /** Distinct event names per tenant. Unbounded names make a dataset unqueryable. */
  EVENT_NAME_CARDINALITY_MAX: 200,

  DEVICE_ID_MAX_LENGTH: 128,
  SESSION_ID_MAX_LENGTH: 128,
  USER_ID_MAX_LENGTH: 128,
  IDEMPOTENCY_KEY_MAX_LENGTH: 128,

  /** Guards against absurd or negative revenue being summed into reports. */
  VALUE_MAX: 1_000_000_000,
} as const;

export const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 7;
export const DEFAULT_EVENT_RETENTION_DAYS = 90;

/**
 * Names the SDK emits by itself. Registered as system definitions so a tenant
 * gets a usable dashboard without writing any tracking code, and so they don't
 * consume the tenant's cardinality budget by surprise.
 */
export const SYSTEM_EVENT_NAMES = [
  'app_install',
  'app_open',
  'session_start',
  'deep_link_opened',
  'user_identified',
  'user_logged_out',
] as const;

/**
 * Keys that must never be stored in `properties`.
 *
 * `properties` is for product facts, not people. Personal data belongs in
 * Identity.traits, where it is allowlisted, hashable and erasable by userId.
 * Anything matching these is dropped at ingest and reported back to the caller
 * so it surfaces during integration rather than in an audit.
 */
const PII_KEY_PATTERN =
  /(^|_)(email|e_mail|mail|phone|mobile|msisdn|password|passwd|secret|token|ssn|aadhaar|aadhar|pan|passport|credit_?card|card_?number|cvv|iban|address_line|full_?name|first_?name|last_?name|dob|date_of_birth)($|_)/i;

// ── Results ────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface SanitizeResult<T> {
  value: T;
  /** Fields silently dropped or coerced. Returned to the caller, never thrown. */
  warnings: string[];
}

// ── Primitives ─────────────────────────────────────────────────────────────

export function isValidEventName(name: unknown): name is string {
  return typeof name === 'string' && EVENT_NAME_PATTERN.test(name);
}

/** Trim to a max length and reject empties. Returns undefined when unusable. */
export function safeString(
  value: unknown,
  maxLength: number
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

/**
 * Turn a human-readable label out of a snake_case event name.
 * `ticket_purchase` → `Ticket Purchase`
 */
export function humanizeEventName(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** sha256 of the lowercased, trimmed value. Used for emails so they stay matchable without being readable. */
export function hashIdentifier(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value.trim().toLowerCase())
    .digest('hex');
}

// ── Properties ─────────────────────────────────────────────────────────────

function sanitizeScalar(value: unknown): unknown | undefined {
  if (value === null) return null;
  const t = typeof value;
  if (t === 'boolean') return value;
  if (t === 'number') {
    return Number.isFinite(value as number) ? value : undefined;
  }
  if (t === 'string') {
    const s = value as string;
    return s.length > LIMITS.PROPERTY_STRING_MAX_LENGTH
      ? s.slice(0, LIMITS.PROPERTY_STRING_MAX_LENGTH)
      : s;
  }
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

function sanitizeValue(
  value: unknown,
  depth: number,
  warnings: string[]
): unknown | undefined {
  const scalar = sanitizeScalar(value);
  if (scalar !== undefined) return scalar;

  if (Array.isArray(value)) {
    if (depth >= LIMITS.PROPERTIES_MAX_DEPTH) {
      warnings.push('nested value dropped: exceeds max depth');
      return undefined;
    }
    const out: unknown[] = [];
    for (const item of value.slice(0, LIMITS.PROPERTIES_MAX_ARRAY_ITEMS)) {
      const cleaned = sanitizeValue(item, depth + 1, warnings);
      if (cleaned !== undefined) out.push(cleaned);
    }
    if (value.length > LIMITS.PROPERTIES_MAX_ARRAY_ITEMS) {
      warnings.push(
        `array truncated to ${LIMITS.PROPERTIES_MAX_ARRAY_ITEMS} items`
      );
    }
    return out;
  }

  if (typeof value === 'object') {
    if (depth >= LIMITS.PROPERTIES_MAX_DEPTH) {
      warnings.push('nested object dropped: exceeds max depth');
      return undefined;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Prototype-pollution guard: these keys must never reach a Mixed field
      // that later gets spread or merged.
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
        warnings.push(`property "${k}" dropped: reserved key`);
        continue;
      }
      const cleaned = sanitizeValue(v, depth + 1, warnings);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }

  return undefined;
}

/**
 * Clean an untrusted `properties` bag: strip PII-shaped keys, cap key count,
 * depth, string length and total size, and drop anything that isn't
 * JSON-representable.
 */
export function sanitizeProperties(
  input: unknown
): SanitizeResult<Record<string, unknown> | undefined> {
  const warnings: string[] = [];

  if (input === undefined || input === null) {
    return { value: undefined, warnings };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { value: undefined, warnings: ['properties must be an object'] };
  }

  const out: Record<string, unknown> = {};
  let keyCount = 0;

  for (const [rawKey, rawValue] of Object.entries(
    input as Record<string, unknown>
  )) {
    if (keyCount >= LIMITS.PROPERTIES_MAX_KEYS) {
      warnings.push(
        `properties truncated to ${LIMITS.PROPERTIES_MAX_KEYS} keys`
      );
      break;
    }

    const key = rawKey.trim();
    if (!key || key.length > LIMITS.PROPERTY_KEY_MAX_LENGTH) {
      warnings.push(`property "${rawKey.slice(0, 32)}" dropped: invalid key`);
      continue;
    }
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      warnings.push(`property "${key}" dropped: reserved key`);
      continue;
    }
    if (PII_KEY_PATTERN.test(key)) {
      // Deliberately not stored. See the note on PII_KEY_PATTERN.
      warnings.push(
        `property "${key}" dropped: looks like personal data — use identify() traits instead`
      );
      continue;
    }
    // Mongo treats dotted keys as paths; keep them flat and unambiguous.
    if (key.includes('.') || key.startsWith('$')) {
      warnings.push(`property "${key}" dropped: illegal character in key`);
      continue;
    }

    const cleaned = sanitizeValue(rawValue, 1, warnings);
    if (cleaned === undefined) continue;

    out[key] = cleaned;
    keyCount++;
  }

  if (keyCount === 0) return { value: undefined, warnings };

  // Size check last — after cleaning, so we measure what we'd actually store.
  const size = Buffer.byteLength(JSON.stringify(out), 'utf8');
  if (size > LIMITS.PROPERTIES_MAX_BYTES) {
    return {
      value: undefined,
      warnings: [
        ...warnings,
        `properties dropped: ${size} bytes exceeds the ${LIMITS.PROPERTIES_MAX_BYTES} byte limit`,
      ],
    };
  }

  return { value: out, warnings };
}

// ── Traits ─────────────────────────────────────────────────────────────────

/**
 * Traits are a defined set, not a dumping ground.
 *
 * A tenant declares which keys it may store (`Tenant.settings.allowedTraitKeys`).
 * Anything else is dropped. When no allowlist is configured we fall back to a
 * conservative default rather than accepting everything — an unset config
 * should fail closed.
 */
export const DEFAULT_ALLOWED_TRAIT_KEYS = [
  'plan',
  'tier',
  'city',
  'region',
  'country',
  'locale',
  'language',
  'timezone',
  'signup_source',
  'account_type',
  'segment',
  'is_subscribed',
  'lifetime_value',
];

export function sanitizeTraits(
  input: unknown,
  allowedKeys: string[] = DEFAULT_ALLOWED_TRAIT_KEYS
): SanitizeResult<Record<string, unknown> | undefined> {
  const warnings: string[] = [];

  if (input === undefined || input === null) {
    return { value: undefined, warnings };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { value: undefined, warnings: ['traits must be an object'] };
  }

  const allow = new Set(allowedKeys.map((k) => k.toLowerCase()));
  const out: Record<string, unknown> = {};
  let keyCount = 0;

  for (const [rawKey, rawValue] of Object.entries(
    input as Record<string, unknown>
  )) {
    if (keyCount >= LIMITS.TRAITS_MAX_KEYS) {
      warnings.push(`traits truncated to ${LIMITS.TRAITS_MAX_KEYS} keys`);
      break;
    }

    const key = rawKey.trim();
    if (!key || key.includes('.') || key.startsWith('$')) {
      warnings.push(`trait "${rawKey.slice(0, 32)}" dropped: invalid key`);
      continue;
    }
    if (!allow.has(key.toLowerCase())) {
      warnings.push(
        `trait "${key}" dropped: not in this tenant's allowed trait keys`
      );
      continue;
    }

    // Traits are flat scalars only — no nested structures to audit later.
    const cleaned = sanitizeScalar(rawValue);
    if (cleaned === undefined) continue;

    out[key] = cleaned;
    keyCount++;
  }

  if (keyCount === 0) return { value: undefined, warnings };

  const size = Buffer.byteLength(JSON.stringify(out), 'utf8');
  if (size > LIMITS.TRAITS_MAX_BYTES) {
    return {
      value: undefined,
      warnings: [...warnings, `traits dropped: exceeds ${LIMITS.TRAITS_MAX_BYTES} bytes`],
    };
  }

  return { value: out, warnings };
}

// ── Timestamps and money ───────────────────────────────────────────────────

export interface TimestampResult {
  occurredAt: Date;
  receivedAt: Date;
  clockSkewMs: number;
  issue?: ValidationIssue;
}

/**
 * Resolve the client clock against the server clock.
 *
 * Both are stored: reporting uses occurredAt, ops uses receivedAt, and the gap
 * is a health metric. Timestamps beyond the skew limit are rejected rather than
 * clamped — silently moving an event to "now" produces reports that look fine
 * and are wrong.
 */
export function resolveTimestamps(
  rawOccurredAt: unknown,
  now: Date = new Date()
): TimestampResult {
  const receivedAt = now;

  if (rawOccurredAt === undefined || rawOccurredAt === null) {
    return { occurredAt: receivedAt, receivedAt, clockSkewMs: 0 };
  }

  const parsed =
    rawOccurredAt instanceof Date
      ? rawOccurredAt
      : new Date(rawOccurredAt as string | number);

  if (Number.isNaN(parsed.getTime())) {
    return {
      occurredAt: receivedAt,
      receivedAt,
      clockSkewMs: 0,
      issue: {
        code: 'INVALID_TIMESTAMP',
        message: 'occurredAt is not a valid ISO-8601 date',
      },
    };
  }

  const skew = parsed.getTime() - receivedAt.getTime();

  if (Math.abs(skew) > LIMITS.CLOCK_SKEW_MAX_MS) {
    return {
      occurredAt: parsed,
      receivedAt,
      clockSkewMs: skew,
      issue: {
        code: 'TIMESTAMP_OUT_OF_RANGE',
        message: `occurredAt is ${Math.round(
          skew / 3_600_000
        )}h from server time; the limit is ±24h`,
      },
    };
  }

  return { occurredAt: parsed, receivedAt, clockSkewMs: skew };
}

export interface MoneyResult {
  value?: number;
  currency?: string;
  issue?: ValidationIssue;
}

/** ISO-4217 shape check. We don't maintain a currency list — three letters is the contract. */
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function resolveMoney(
  rawValue: unknown,
  rawCurrency: unknown
): MoneyResult {
  if (rawValue === undefined || rawValue === null) {
    return {};
  }

  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);

  if (!Number.isFinite(value)) {
    return {
      issue: { code: 'INVALID_VALUE', message: 'value must be a finite number' },
    };
  }
  if (value < 0) {
    return {
      issue: { code: 'INVALID_VALUE', message: 'value must not be negative' },
    };
  }
  if (value > LIMITS.VALUE_MAX) {
    return {
      issue: {
        code: 'VALUE_OUT_OF_RANGE',
        message: `value exceeds the maximum of ${LIMITS.VALUE_MAX}`,
      },
    };
  }

  const currency =
    typeof rawCurrency === 'string'
      ? rawCurrency.trim().toUpperCase()
      : undefined;

  if (currency && !CURRENCY_PATTERN.test(currency)) {
    return {
      value,
      issue: {
        code: 'INVALID_CURRENCY',
        message: 'currency must be a 3-letter ISO-4217 code',
      },
    };
  }

  return { value, currency };
}
