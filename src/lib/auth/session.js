import 'server-only';
import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Resolves the current authenticated user's identity AND role.
 *
 * SECURITY:
 *   - The role is ALWAYS read from public.profiles (the database),
 *     joined via the id returned by Supabase Auth's `getUser()` — a
 *     server-verified call that re-validates the JWT. It is NEVER read
 *     from request body, query/URL parameters, or any other
 *     client-supplied value.
 *   - Deactivated profiles (is_active = false) are treated as
 *     unauthenticated.
 *
 * The optional `supabase` parameter exists purely for dependency
 * injection in unit tests (see session.test.js). Real application code
 * should always call `getCurrentUser()` (no arguments) below.
 */
export async function fetchCurrentUser(supabase) {
  let client;
  try {
    client = supabase ?? (await createSupabaseServerClient());
  } catch (error) {
    // Next.js uses thrown errors with a special `digest` as internal
    // control flow (e.g. bailing a route to dynamic rendering when
    // `cookies()` is read during static generation, or `redirect()`).
    // These must always propagate untouched — never swallow them.
    if (typeof error?.digest === 'string') {
      throw error;
    }

    // Anything else here is a real misconfiguration (e.g. missing
    // NEXT_PUBLIC_SUPABASE_URL/ANON_KEY in this environment). Fail
    // closed: treat as "not authenticated" (-> redirect to /login)
    // instead of letting a raw 500 leak stack traces/file paths.
    console.error('fetchCurrentUser: could not create Supabase client', error);
    return null;
  }

  const {
    data: { user: authUser },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, username, full_name, role, is_active')
    .eq('id', authUser.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    return null;
  }

  return {
    id: authUser.id,
    email: authUser.email,
    ...profile,
  };
}

/**
 * Cached (memoized per request/render pass) accessor used throughout
 * Server Components, Server Actions, and Route Handlers.
 */
export const getCurrentUser = cache(fetchCurrentUser);
