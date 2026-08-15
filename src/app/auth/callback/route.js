import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Public route (see proxy.js PUBLIC_PATHS): handles the Supabase Auth
 * "code" redirect (OAuth / magic link / email confirmation) and
 * exchanges it for a session cookie.
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/dashboard';
  // Only ever redirect to a relative, same-app path — never an
  // attacker-controlled absolute URL (open-redirect prevention).
  const next = rawNext.startsWith('/') ? rawNext : '/dashboard';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
