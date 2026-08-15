import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

/**
 * Used exclusively by proxy.js (see /proxy.js). Refreshes the Supabase
 * auth cookie on every request and returns only whether a session
 * exists — this is an OPTIMISTIC check.
 *
 * IMPORTANT: proxy/middleware runs on every request, including prefetched
 * routes, so per Next.js's own guidance we intentionally do NOT query
 * public.profiles for the role here (that would mean a database round
 * trip on every navigation). The authoritative, database-backed role
 * check happens later in requireRole()/requireAnyRole() (see
 * src/lib/auth/guards.js), which is itself backed by Postgres RLS.
 */
export async function updateSupabaseSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
