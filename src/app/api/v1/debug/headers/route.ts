import { NextRequest, NextResponse } from 'next/server';

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

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-client-ip') ||
    'none';

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
