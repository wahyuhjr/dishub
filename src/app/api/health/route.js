import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { can } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { runAllHealthChecks } from '@/lib/health/health-check-service';

/**
 * Server-side health check endpoint (item 2). Never called from a
 * device/browser directly pinging anything — this route is the ONLY
 * place that triggers adapter checks (item 12: "Jangan melakukan ping
 * perangkat internal langsung dari browser").
 *
 * Role protection (item 14):
 *   - Any authenticated role with `monitoring.view` may GET this route —
 *     it returns the latest known status either way.
 *   - Only a role with `monitoring.log` (ADMIN, see permissions.js) can
 *     actually TRIGGER a fresh round of checks; everyone else just reads
 *     whatever the last triggered round produced (which every connected
 *     client also gets pushed to it live via Supabase Realtime — see
 *     src/features/monitoring/components/monitoring-dashboard.jsx).
 *
 * Fresh checks are written with the service-role client, matching the
 * system_health_checks_insert RLS policy's own guidance that automated
 * monitoring agents should use service_role rather than an interactive
 * session.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!can(user.role, 'monitoring.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let triggeredFreshCheck = false;
  if (can(user.role, 'monitoring.log')) {
    const adminClient = createSupabaseAdminClient();
    await runAllHealthChecks(adminClient);
    triggeredFreshCheck = true;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: systemHealth, error: systemError }, { data: stationHealth, error: stationError }] = await Promise.all([
    supabase.from('v_system_health_latest').select('*'),
    supabase.from('v_station_health_latest').select('*, station:stations(id, station_code, station_name, station_type)'),
  ]);

  if (systemError) return NextResponse.json({ error: systemError.message }, { status: 500 });
  if (stationError) return NextResponse.json({ error: stationError.message }, { status: 500 });

  return NextResponse.json({ systemHealth, stationHealth, triggeredFreshCheck });
}
