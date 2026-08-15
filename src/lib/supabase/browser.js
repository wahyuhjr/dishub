'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for Client Components — uses only the public URL +
 * anon/publishable key (safe to ship to the browser). Used by
 * src/features/monitoring/** for the Realtime subscription on
 * system_health_checks; regular reads/writes elsewhere in the app
 * should still go through Server Components/Actions
 * (src/lib/supabase/server.js), not this client.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
