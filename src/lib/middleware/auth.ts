import { NextRequest } from 'next/server';
import TenantModel from '@/lib/models/Tenant';
import { Logger } from '@/lib/logger';
import crypto from 'crypto';

const logger = Logger.child({ module: 'auth-middleware' });

export interface AuthContext {
  tenantId: string;
  apiKey: string;
  isValid: boolean;
}

/**
 * Authenticate request using API key
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthContext | null> {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    logger.debug('Missing API key');
    return null;
  }

  try {
    const tenant = await TenantModel.findOne({
      apiKey,
      isActive: true,
    });

    if (!tenant) {
      logger.warn({ apiKey: apiKey.substring(0, 8) }, 'Invalid API key');
      return null;
    }

    return {
      tenantId: tenant._id.toString(),
      apiKey,
      isValid: true,
    };
  } catch (error) {
    logger.error({ error: String(error) }, 'Auth error');
    return null;
  }
}

/**
 * Verify HMAC-SHA256 signature for request
 */
export function verifySignature(
  request: NextRequest,
  apiSecret: string,
  body: string
): boolean {
  const signature = request.headers.get('x-signature');
  if (!signature) return false;

  const computed = crypto
    .createHmac('sha256', apiSecret)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
}

/**
 * Require authentication - returns null if auth fails
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthContext | null> {
  return authenticateRequest(request);
}
