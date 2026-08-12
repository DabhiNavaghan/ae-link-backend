import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  ALL_ALLOWED_HOSTS,
  PLATFORM_HOSTS,
  APP_LINK_HOSTS,
  APP_STORE_URL_MAP,
  getProtocolForHost,
} from '@/lib/utils/domain-map';

const isDashboardRoute = createRouteMatcher(['/dashboard(.*)']);

export default clerkMiddleware((auth, request: NextRequest) => {
  // Handle CORS preflight before any auth check
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });

    const reqOrigin = request.headers.get('origin') || '';
    const host = request.headers.get('host') || '';
    const allowedOrigins = (
      process.env.NEXT_PUBLIC_ALLOWED_ORIGINS || 'https://allevents.in,https://allevents.app'
    ).split(',').map((o) => o.trim());

    // Allow the request's own origin (link hosts need CORS for SDK clients)
    if (reqOrigin) {
      const protocol = getProtocolForHost(host);
      const selfOrigin = `${protocol}://${host}`;
      allowedOrigins.push(selfOrigin);
    }

    if (reqOrigin && allowedOrigins.includes(reqOrigin)) {
      response.headers.set('Access-Control-Allow-Origin', reqOrigin);
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, X-API-Key, X-Signature, Accept'
    );
    response.headers.set('Access-Control-Max-Age', '86400');

    return response;
  }

  const host = request.headers.get('host') || '';

  // ── TEMPORARY: force-redirect both link hosts to prove middleware deploys ──
  const FORCE_REDIRECT = true;
  if (FORCE_REDIRECT && (host === 'organizer.aelinks.io' || host === 'allevents.aelinks.io')) {
    const dest = host === 'organizer.aelinks.io'
      ? 'https://smartlink.apps.allevents.app/apps/allevents-manager-app/store?utm_source=smartlink&utm_medium=store-link&utm_campaign=allevents-manager-app'
      : 'https://smartlink.apps.allevents.app/apps/allevents-allevents/store?utm_source=smartlink&utm_medium=store-link&utm_campaign=allevents';
    return NextResponse.redirect(dest, 302);
  }

  // ── ORIGINAL ROUTING LOGIC BELOW ──

  const isLinkHost = APP_LINK_HOSTS.has(host);
  const storeUrl = isLinkHost ? APP_STORE_URL_MAP[host] : undefined;

  // Reject unknown hosts — use 404 to reduce fingerprinting surface
  if (!ALL_ALLOWED_HOSTS.has(host)) {
    return new NextResponse('Not found', { status: 404 });
  }

  // ── Root on link hosts → redirect to app store page ──
  if (request.nextUrl.pathname === '/' && isLinkHost) {
    if (storeUrl) {
      return NextResponse.redirect(storeUrl, 302);
    }
    const protocol = getProtocolForHost(host);
    return NextResponse.redirect(
      `${protocol}://smartlink.apps.allevents.app`,
      302
    );
  }

  // ── Platform-only routes: redirect link hosts away ──
  const isPlatformRoute =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/sign-in') ||
    request.nextUrl.pathname.startsWith('/sign-up') ||
    request.nextUrl.pathname.startsWith('/api/auth');

  if (isPlatformRoute && !PLATFORM_HOSTS.has(host)) {
    const platformHost = 'smartlink.apps.allevents.app';
    const protocol = getProtocolForHost(host);
    return NextResponse.redirect(
      `${protocol}://${platformHost}${request.nextUrl.pathname}${request.nextUrl.search}`,
      308
    );
  }

  // ── Auth gate for dashboard routes ──
  if (isDashboardRoute(request)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    '/dashboard(.*)',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/',
    '/api/v1/tenants/me',
    '/.well-known/:path*',
    '/apps/:path*',
  ],
};
