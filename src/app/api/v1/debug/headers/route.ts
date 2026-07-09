import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/get-client-ip';

/**
 * GET /api/v1/debug/headers
 *
 * Debug endpoint — shows all request headers to diagnose IP forwarding.
 * Remove this in production once proxy is configured correctly.
 */
export async function GET(request: NextRequest) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const ip = getClientIp(request) ?? 'none';

  return NextResponse.json({
    resolvedIp: ip,
    xForwardedFor: request.headers.get('x-forwarded-for'),
    xRealIp: request.headers.get('x-real-ip'),
    cfConnectingIp: request.headers.get('cf-connecting-ip'),
    xClientIp: request.headers.get('x-client-ip'),
    remoteAddress: request.ip || 'not available',
    allHeaders: headers,
  });
}
