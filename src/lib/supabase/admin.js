import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * SECURITY (see requirement: "service role key only where genuinely
 * privileged access is required"):
 *
 * This client uses the Supabase `service_role` key, which BYPASSES Row
 * Level Security entirely. It must:
 *   - never be imported by a Client Component (enforced by `server-only`,
 *     which fails the build if this module ends up in a client bundle),
 *   - never be used for ordinary reads/writes — those must go through
 *     `createSupabaseServerClient()` (src/lib/supabase/server.js) so RLS
 *     and the role-based policies remain the single source of truth,
 *   - only be used for the narrow set of operations that genuinely
 *     require bypassing RLS, e.g.:
 *       - resolving a station's credential from Supabase Vault
 *         (public.stations.secret_id),
 *       - admin user-provisioning/off-boarding via the Auth Admin API,
 *       - scheduled/background jobs (cron, queue workers) with no
 *         end-user session to run RLS-checked queries as.
 *
 * SUPABASE_SERVICE_ROLE_KEY must only ever exist as a server-side
 * environment variable (never prefixed with NEXT_PUBLIC_).
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. This key must never be exposed to the client and should only exist in server-side environment variables.'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
