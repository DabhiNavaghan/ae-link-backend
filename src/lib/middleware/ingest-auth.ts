import { NextRequest } from 'next/server';
import crypto from 'crypto';
import TenantModel from '@/lib/models/Tenant';
import AppModel from '@/lib/models/App';
import { Logger } from '@/lib/logger';
import { EventTrustLevel } from '@/types/events';

const logger = Logger.child({ module: 'ingest-auth' });

/**
 * Authentication for the event ingest surface.
 *
 * This wraps the existing x-api-key flow and adds the thing ingest needs and
 * the rest of the API doesn't: a trust level.
 *
 *   client — an `app_…` key. It ships inside a distributable binary, so anyone
 *            who decompiles the app has it. Fine for product analytics; not
 *            sufficient for anything that turns into money.
 *
 *   server — a tenant key (which only ever lives on the tenant's backend), or
 *            an app key accompanied by a valid HMAC signature over the raw
 *            request body. Safe to bill on.
 *
 * A tenant that bills on revenue sets `settings.requireSignedRevenue`, after
 * which any event carrying a value must arrive at server trust.
 */

export interface IngestAuthContext {
  tenantId: string;
  appId?: string;
  trust: EventTrustLevel;
  /** Set when a signature header was present, whether or not it verified. */
  signaturePresent: boolean;
  signatureValid: boolean;
}

export interface IngestAuthFailure {
  code: 'MISSING_API_KEY' | 'INVALID_API_KEY' | 'INVALID_SIGNATURE';
  message: string;
}

export type IngestAuthResult =
  | { ok: true; context: IngestAuthContext }
  | { ok: false; failure: IngestAuthFailure };

/**
 * Constant-time comparison that tolerates length mismatch.
 *
 * crypto.timingSafeEqual throws when the buffers differ in length, which turns
 * a wrong-length signature into a 500 and leaks length through the error path.
 * Comparing fixed-width digests of both sides avoids both problems.
 */
function safeCompare(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Max age of a signed request, in ms. Bounds how long a captured request stays replayable. */
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

export interface VerifySignatureInput {
  request: NextRequest;
  /** The exact bytes that were signed. Must be the raw body, not a re-serialization. */
  rawBody: string;
  apiSecret: string;
}

/**
 * Verify `x-signature` as HMAC-SHA256 over `${timestamp}.${rawBody}`.
 *
 * The timestamp is inside the signed payload and checked for freshness, so a
 * captured request can't be replayed indefinitely. Idempotency keys make a
 * replay within the window a no-op anyway.
 */
export function verifyIngestSignature(input: VerifySignatureInput): boolean {
  const signature = input.request.headers.get('x-signature');
  const timestamp = input.request.headers.get('x-timestamp');

  if (!signature || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() - ts) > SIGNATURE_MAX_AGE_MS) {
    logger.warn({ skewMs: Date.now() - ts }, 'Signature timestamp outside accepted window');
    return false;
  }

  const expected = crypto
    .createHmac('sha256', input.apiSecret)
    .update(`${timestamp}.${input.rawBody}`)
    .digest('hex');

  return safeCompare(signature, expected);
}

/**
 * Authenticate an ingest request and classify how much it can be trusted.
 *
 * `rawBody` is required because signature verification must run over the exact
 * bytes received — re-serializing parsed JSON changes key order and whitespace
 * and would never match.
 */
export async function authenticateIngest(
  request: NextRequest,
  rawBody: string
): Promise<IngestAuthResult> {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return {
      ok: false,
      failure: { code: 'MISSING_API_KEY', message: 'x-api-key header is required' },
    };
  }

  const signaturePresent = Boolean(request.headers.get('x-signature'));

  try {
    // ── App-level key: client trust, upgradable by signature ──
    if (apiKey.startsWith('app_')) {
      const app = await AppModel.findOne({ apiKey, isActive: true })
        .select('_id tenantId')
        .lean();

      if (!app) {
        logger.warn({ apiKey: apiKey.slice(0, 12) }, 'Invalid app API key');
        return {
          ok: false,
          failure: { code: 'INVALID_API_KEY', message: 'API key is invalid or inactive' },
        };
      }

      const tenantId = String((app as any).tenantId);
      let signatureValid = false;

      if (signaturePresent) {
        const tenant = await TenantModel.findById(tenantId)
          .select('apiSecret isActive')
          .lean();

        if (!tenant || (tenant as any).isActive === false) {
          return {
            ok: false,
            failure: { code: 'INVALID_API_KEY', message: 'Tenant is inactive' },
          };
        }

        signatureValid = verifyIngestSignature({
          request,
          rawBody,
          apiSecret: (tenant as any).apiSecret,
        });

        // A present-but-wrong signature is a hard failure, not a downgrade.
        // Silently accepting it as client-trust would let an attacker probe
        // for a valid secret without ever being told they were wrong.
        if (!signatureValid) {
          return {
            ok: false,
            failure: {
              code: 'INVALID_SIGNATURE',
              message: 'x-signature did not verify against the tenant secret',
            },
          };
        }
      }

      return {
        ok: true,
        context: {
          tenantId,
          appId: String((app as any)._id),
          trust: signatureValid ? 'server' : 'client',
          signaturePresent,
          signatureValid,
        },
      };
    }

    // ── Tenant key: only ever lives server-side, so server trust ──
    const tenant = await TenantModel.findOne({ apiKey, isActive: true })
      .select('_id apiSecret')
      .lean();

    if (!tenant) {
      logger.warn({ apiKey: apiKey.slice(0, 8) }, 'Invalid tenant API key');
      return {
        ok: false,
        failure: { code: 'INVALID_API_KEY', message: 'API key is invalid or inactive' },
      };
    }

    let signatureValid = false;
    if (signaturePresent) {
      signatureValid = verifyIngestSignature({
        request,
        rawBody,
        apiSecret: (tenant as any).apiSecret,
      });
      if (!signatureValid) {
        return {
          ok: false,
          failure: {
            code: 'INVALID_SIGNATURE',
            message: 'x-signature did not verify against the tenant secret',
          },
        };
      }
    }

    return {
      ok: true,
      context: {
        tenantId: String((tenant as any)._id),
        trust: 'server',
        signaturePresent,
        signatureValid,
      },
    };
  } catch (error) {
    logger.error({ error: String(error) }, 'Ingest auth error');
    return {
      ok: false,
      failure: { code: 'INVALID_API_KEY', message: 'Authentication failed' },
    };
  }
}
