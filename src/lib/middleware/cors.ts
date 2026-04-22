import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';

const logger = Logger.child({ module: 'cors-middleware' });

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || 'https://allevents.in,https://allevents.app'
).split(',').map((o) => o.trim());

/**
 * Apply CORS headers to response
 */
export function applyCors(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const origin = request.headers.get('origin');

  // Check if origin is allowed
  const isAllowed =
    origin && ALLOWED_ORIGINS.includes(origin);

  if (isAllowed || !origin) {
    response.headers.set(
      'Access-Control-Allow-Origin',
      origin || ALLOWED_ORIGINS[0]
    );
    response.headers.set(
      'Access-Control-Allow-Credentials',
      'true'
    );
  }

  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS, PATCH'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, X-API-Key, X-Signature, Accept'
  );
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreFlight(
  request: NextRequest
): NextResponse | null {
  if (request.method !== 'OPTIONS') {
    return null;
  }

  const response = new NextResponse(null, { status: 200 });
  return applyCors(request, response);
}
