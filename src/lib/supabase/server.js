import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Supabase client for Server Components, Server Actions, and Route
 * Handlers. Uses the anon key + the caller's own auth cookies, so every
 * query is still subject to Postgres RLS — this is the client that
 * almost all server-side code should use.
 *
 * Never import this from a Client Component (enforced by `server-only`).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `setAll` is called from a Server Component render, where
            // cookies cannot be mutated. Safe to ignore because proxy.js
            // (see /proxy.js) already refreshes the session cookie on
            // every request.
          }
        },
      },
    }
  );
}
