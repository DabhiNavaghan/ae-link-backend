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
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Feed queries: newest-first, optionally filtered by outcome or tenant.
matchAttemptSchema.index({ createdAt: -1 });
matchAttemptSchema.index({ tenantId: 1, createdAt: -1 });
matchAttemptSchema.index({ outcome: 1, createdAt: -1 });
// "Near miss" queries — attempts that scored well but lost.
matchAttemptSchema.index({ outcome: 1, bestConfidence: -1 });

// Retain for 90 days. Long enough to investigate a reported attribution gap,
// short enough that the collection stays cheap.
matchAttemptSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 }
);

const MatchAttemptModel: Model<IMatchAttempt> =
  mongoose.models.MatchAttempt ||
  mongoose.model<IMatchAttempt>('MatchAttempt', matchAttemptSchema);

export default MatchAttemptModel;
