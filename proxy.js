import { NextResponse } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

/**
 * Routes reachable without an authenticated session.
 * Per the requirement, ONLY these (plus their sub-paths, e.g. error
 * variants under /auth/*) are public:
 *   - /login
 *   - /auth/callback
 *   - the authentication error page(s) under /auth/*
 */
const PUBLIC_PATHS = ['/login', '/auth'];

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Next.js 16 renamed `middleware.js` to `proxy.js` (same mechanism).
 *
 * This performs an OPTIMISTIC check only: does a Supabase session cookie
 * exist? It intentionally does NOT query public.profiles for the role,
 * since proxy runs on every request (including prefetches) and Next.js
 * explicitly recommends avoiding database checks here for performance.
 *
 * The AUTHORITATIVE, database-backed role check happens in
 * requireRole()/requireAnyRole() (src/lib/auth/guards.js) inside every
 * page, layout, Server Action, and Route Handler — never rely on proxy
 * alone to protect data.
 */
export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const { response, user } = await updateSupabaseSession(request);

  if (isPublicPath(pathname)) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Run on every route except static assets and Next.js internals.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
