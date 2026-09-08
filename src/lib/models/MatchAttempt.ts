import mongoose, { Schema, Model, Document } from 'mongoose';
import { IMatchSignal } from '@/types';

/**
 * A durable record of one `/api/v1/deferred/match` call.
 *
 * WHY this exists: `Fingerprint` and `DeferredLink` both carry a TTL index and
 * self-delete a few hours after the click, so by the time anyone investigates
 * "why was this install marked organic?" every input to the decision is gone.
 * This collection keeps the full decision — the app fingerprint, the candidates
 * considered, and the per-signal breakdown for each — long enough to debug
 * attribution. It is written on every match attempt, matched or not.
 *
 * RETENTION: every row carries an `expiresAt` written at insert time and a TTL
 * index that reaps it, following the same pattern as `Event` and `Fingerprint`.
 * The window is short and flat — see DEFAULT_RETENTION_DAYS below. At ~2k
 * attempts a day and ~90% of them noise, this collection outgrows every other
 * one in the system if left to accumulate.
 */

/** One candidate click evaluated during a match attempt. */
export interface IEvaluatedCandidate {
  fingerprintId?: mongoose.Types.ObjectId;
  linkId?: mongoose.Types.ObjectId;
  clickId?: mongoose.Types.ObjectId;
  /** Raw points earned across evaluable signals. */
  score: number;
  /** Points available across evaluable signals. */
  possible: number;
  /** score ÷ possible × 100 — compared against the tenant threshold. */
  confidence: number;
  /** Per-signal breakdown: what the app sent vs what the click stored. */
  signals: IMatchSignal[];
  /** Set when the candidate was thrown out before scoring completed. */
  rejectedReason?: string;
  /** Whether this candidate is the one that won the attempt. */
  selected: boolean;
  /** Whether a pending DeferredLink was attached to this fingerprint. */
  hasDeferredLink?: boolean;
  /** When the originating click happened. */
  clickedAt?: Date;
}

export interface IMatchAttempt extends Document {
  tenantId: mongoose.Types.ObjectId;
  deviceId?: string;
  platform?: string;
  /** 'matched' | 'organic' | 'disabled' — outcome returned to the SDK. */
  outcome: 'matched' | 'organic' | 'disabled';
  /**
   * Why the attempt ended the way it did. Distinguishes the failure modes that
   * look identical from the SDK's side:
   *   no_candidates        — nothing was stored for this tenant in the TTL window
   *   below_threshold      — a candidate existed but scored under the threshold
   *   no_deferred_link     — a candidate passed but had no pending DeferredLink
   *   no_hard_evidence     — best candidate agreed on neither IP nor screen
   *   platform_mismatch    — only cross-platform candidates were available
   *   matched              — success
   *   deferred_disabled    — turned off in tenant settings
   */
  reason: string;
  threshold: number;
  /** Confidence of the best candidate, even when it lost. */
  bestConfidence: number;
  bestScore: number;
  bestPossible: number;
  candidateCount: number;
  /** The fingerprint the app sent, normalized to the stored (camelCase) shape. */
  appFingerprint: Record<string, any>;
  /** Candidates considered, best-first. Capped to keep documents small. */
  candidates: IEvaluatedCandidate[];
  matchedLinkId?: mongoose.Types.ObjectId;
  matchedDeferredLinkId?: mongoose.Types.ObjectId;
  matchedFingerprintId?: mongoose.Types.ObjectId;
  matchedClickId?: mongoose.Types.ObjectId;
  ipAddress?: string;
  country?: string;
  city?: string;
  /** Server-side duration of the match call, milliseconds. */
  durationMs?: number;
  createdAt: Date;
  /** Reaped by the TTL index once passed. Set by `matchAttemptExpiry()`. */
  expiresAt: Date;
}

/**
 * How long a match attempt is kept, in days.
 *
 * Flat across every outcome — nothing survives past this window, matched or
 * not. Match attempts are debugging material for a live report; once a week
 * has passed the click and fingerprint they reference are long gone anyway
 * (Fingerprint and DeferredLink self-delete within hours), so an older row
 * cannot be fully reconstructed regardless.
 *
 * Overridable per deployment with MATCH_ATTEMPT_RETENTION_DAYS: a single
 * number to move the flat window ("14"), or comma-separated reason:days pairs
 * to carve out exceptions ("matched:30"), where `default` covers everything
 * unnamed. Raising it is the only way any row lives past the value below.
 */
const DEFAULT_RETENTION_DAYS = 7;

function resolveRetention(raw: string | undefined): Record<string, number> {
  if (!raw?.trim()) return { default: DEFAULT_RETENTION_DAYS };

  // A bare number just moves the flat window.
  const flat = Number(raw.trim());
  if (Number.isFinite(flat) && flat > 0) return { default: flat };

  const parsed: Record<string, number> = { default: DEFAULT_RETENTION_DAYS };
  for (const pair of raw.split(',')) {
    const [key, value] = pair.split(':').map((p) => p.trim());
    const days = Number(value);
    if (key && Number.isFinite(days) && days > 0) parsed[key] = days;
  }
  return parsed;
}

export const RETENTION_DAYS: Record<string, number> = resolveRetention(
  process.env.MATCH_ATTEMPT_RETENTION_DAYS
);

/** Longest window in force — what the collection is sized against. */
export const MAX_RETENTION_DAYS = Math.max(...Object.values(RETENTION_DAYS));

/**
 * The `expiresAt` for an attempt. Every write must set this: a row without it
 * is invisible to the TTL index and lives forever, which is the exact failure
 * this replaced.
 */
export function matchAttemptExpiry(reason: string, from: Date = new Date()): Date {
  const days = RETENTION_DAYS[reason] ?? RETENTION_DAYS.default;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

const matchSignalSchema = new Schema<IMatchSignal>(
  {
    key: { type: String, required: true },
    earned: { type: Number, required: true },
    possible: { type: Number, required: true },
    matchType: { type: String, required: true },
    appValue: Schema.Types.Mixed,
    webValue: Schema.Types.Mixed,
  },
  { _id: false }
);

const evaluatedCandidateSchema = new Schema<IEvaluatedCandidate>(
  {
    fingerprintId: { type: Schema.Types.ObjectId, ref: 'Fingerprint' },
    linkId: { type: Schema.Types.ObjectId, ref: 'Link' },
    clickId: { type: Schema.Types.ObjectId, ref: 'Click' },
    score: { type: Number, required: true },
    possible: { type: Number, required: true },
    confidence: { type: Number, required: true },
    signals: [matchSignalSchema],
    rejectedReason: String,
    selected: { type: Boolean, default: false },
    hasDeferredLink: Boolean,
    clickedAt: Date,
  },
  { _id: false }
);

const matchAttemptSchema = new Schema<IMatchAttempt>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    deviceId: { type: String, index: true },
    platform: String,
    outcome: {
      type: String,
      enum: ['matched', 'organic', 'disabled'],
      required: true,
      index: true,
    },
    reason: { type: String, required: true, index: true },
    threshold: { type: Number, required: true },
    bestConfidence: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    bestPossible: { type: Number, default: 0 },
    candidateCount: { type: Number, default: 0 },
    appFingerprint: { type: Schema.Types.Mixed },
    candidates: [evaluatedCandidateSchema],
    matchedLinkId: { type: Schema.Types.ObjectId, ref: 'Link' },
    matchedDeferredLinkId: { type: Schema.Types.ObjectId, ref: 'DeferredLink' },
    matchedFingerprintId: { type: Schema.Types.ObjectId, ref: 'Fingerprint' },
    matchedClickId: { type: Schema.Types.ObjectId, ref: 'Click' },
    ipAddress: String,
    country: String,
    city: String,
    durationMs: Number,
    // Required so a write that forgets it fails loudly instead of leaking a
    // row past the TTL index. `default` covers documents built outside
    // recordMatchAttempt(); `reason` is always set by the time this runs.
    expiresAt: {
      type: Date,
      required: true,
      default: function (this: IMatchAttempt) {
        return matchAttemptExpiry(this.reason);
      },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Feed queries: newest-first, optionally filtered by outcome or tenant.
matchAttemptSchema.index({ createdAt: -1 });
matchAttemptSchema.index({ tenantId: 1, createdAt: -1 });
matchAttemptSchema.index({ outcome: 1, createdAt: -1 });
// "Near miss" queries — attempts that scored well but lost.
matchAttemptSchema.index({ outcome: 1, bestConfidence: -1 });

// Retention. expiresAt is written per row from RETENTION_DAYS, so the window
// can be changed — or given per-reason exceptions — without touching indexes.
//
// NOTE: this replaces an earlier flat `{ createdAt: 1 }` TTL of 90 days. Mongo
// will not change the options on an existing index, so the old one has to be
// dropped before this is created — see the migration in scripts/.
matchAttemptSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'match_attempt_ttl' }
);

// Backstop. A TTL index simply skips a document that lacks the indexed field,
// so anything written without `expiresAt` — an older build still rolling out,
// a future insert path that bypasses recordMatchAttempt() — would otherwise
// live forever, which is the failure this whole change exists to prevent.
// Mongo allows several TTL indexes on one collection and honours whichever
// comes due first. The margin is one day: enough that this never fires before
// the real policy and truncates an intended window, small enough that an
// orphan row cannot meaningfully outlive the retention promise.
export const BACKSTOP_RETENTION_DAYS = MAX_RETENTION_DAYS + 1;

matchAttemptSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: BACKSTOP_RETENTION_DAYS * 24 * 60 * 60,
    name: 'match_attempt_ttl_backstop',
  }
);

const MatchAttemptModel: Model<IMatchAttempt> =
  mongoose.models.MatchAttempt ||
  mongoose.model<IMatchAttempt>('MatchAttempt', matchAttemptSchema);

export default MatchAttemptModel;
