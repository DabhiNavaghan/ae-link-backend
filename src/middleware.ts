import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isDashboardRoute = createRouteMatcher(['/dashboard(.*)']);

export default clerkMiddleware((auth, request: NextRequest) => {
  // Handle CORS preflight before any auth check
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

  // Only protect dashboard routes — everything else is public
  if (isDashboardRoute(request)) {
    auth().protect();
  }
});

export const config = {
  // Only run middleware on dashboard and auth pages
  // Skip: API routes, static files, .well-known, short code pages
  matcher: [
    '/dashboard(.*)',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/',
  ],
};
