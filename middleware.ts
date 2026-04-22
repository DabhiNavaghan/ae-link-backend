import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js middleware for global request handling
 */
export function middleware(request: NextRequest) {
  // Skip middleware for static assets and Next.js internals
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });

    const origin = request.headers.get('origin');
    const allowedOrigins = (
      process.env.ALLOWED_ORIGINS || 'https://allevents.in,https://allevents.app'
    ).split(',').map((o) => o.trim());

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, X-API-Key, X-Signature, Accept'
    );
    response.headers.set('Access-Control-Max-Age', '86400');

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
