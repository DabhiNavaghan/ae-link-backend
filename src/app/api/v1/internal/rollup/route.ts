export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import { rollupRecent, rollupDay } from '@/lib/services/event-rollup.service';
import { successResponse, errorResponse, Errors } from '@/utils/response';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ route: 'internal-rollup' });

/**
 * Constant-time secret comparison.
 *
 * Digesting both sides first keeps the comparison timing-safe even when the
 * supplied value is a different length — crypto.timingSafeEqual throws on a
 * length mismatch, which would turn a wrong guess into a 500 and leak length.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * POST /api/v1/internal/rollup
 *
 * Recompute daily event aggregates. Intended for a scheduler (Vercel Cron or
 * equivalent), not for tenants — it runs across every tenant by default.
 *
 * Auth is a shared secret in `x-cron-secret` (or a `Bearer` token, which is
 * what Vercel Cron sends), NOT an API key: no tenant should be able to trigger
 * a platform-wide aggregation.
 *
 * Body (all optional):
 *   { "days": 2, "date": "2026-07-27", "tenantId": "…" }
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    // Failing closed is deliberate. An unset secret must not mean "open".
    logger.error('CRON_SECRET is not configured — refusing to run');
    return NextResponse.json(
      errorResponse('NOT_CONFIGURED', 'Rollup endpoint is not configured'),
      { status: 503 }
    );
  }

  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';

  if (!provided || !secretMatches(provided, expected)) {
    logger.warn('Rollup called with an invalid secret');
    return NextResponse.json(Errors.UNAUTHORIZED(), { status: 401 });
  }

  try {
    await connectDB();
  } catch {
    return NextResponse.json(
      Errors.INTERNAL_ERROR('Database connection failed'),
      { status: 500 }
    );
  }

  let body: any = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    // An empty or unparseable body just means "use the defaults".
  }

  try {
    // A specific date recomputes exactly that day — the repair path when a
    // scheduled run failed or an old batch arrived late.
    if (body?.date) {
      const date = new Date(body.date);
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json(
          Errors.VALIDATION_ERROR({ date: 'Invalid date' }),
          { status: 400 }
        );
      }
      const result = await rollupDay({ date, tenantId: body.tenantId });
      return NextResponse.json(successResponse({ results: [result] }), {
        status: 200,
      });
    }

    const days = Math.min(31, Math.max(1, Number(body?.days) || 2));
    const results = await rollupRecent(days, body?.tenantId);

    return NextResponse.json(successResponse({ results }), { status: 200 });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: err.message, stack: err.stack }, 'Rollup failed');
    return NextResponse.json(Errors.INTERNAL_ERROR(), { status: 500 });
  }
}
