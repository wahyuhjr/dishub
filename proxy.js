import { NextResponse } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

/**
 * Routes reachable without an authenticated session.
 * Per the requirement, ONLY these (plus their sub-paths, e.g. error
 * variants under /auth/*) are public:
 *   - / (public homepage — card list of published berita)
 *   - /berita/[id] (public berita detail page)
 *   - /login
 *   - /auth/callback
 *   - the authentication error page(s) under /auth/*
 */
const PUBLIC_PATHS = ['/', '/berita', '/login', '/auth'];

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some((path) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)));
}

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
