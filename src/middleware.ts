import { authMiddleware } from '@clerk/nextjs';

// Clerk v5 middleware for Next.js 14
export default authMiddleware({
  // Routes that don't require authentication
  publicRoutes: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/v1/(.*)',
    '/api/health',
    '/.well-known/(.*)',
    // Short code redirect pages are public
    '/([a-zA-Z0-9]{5,10})',
  ],
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
