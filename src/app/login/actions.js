'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Server Action for the /login form. Runs entirely server-side: the
 * password is verified by Supabase Auth, never handled/compared by our
 * own code. On success, redirects into /dashboard; role-based routing
 * within the dashboard is handled by requireRole()/requireAnyRole() on
 * each page.
 *
 * Signature is (prevState, formData) so it can be driven by React's
 * useActionState on the client (see login-form.js) to show pending/error
 * UI without any client-side auth logic.
 */
export async function loginAction(prevState, formData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Email dan password wajib diisi.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: 'Email atau password tidak valid.' };
  }

  redirect('/dashboard');
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
