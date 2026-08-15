import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { COMPONENT_NAME } from '@/lib/health/constants';
import { resolveDisplayStatus } from '@/lib/health/status-helpers';

/**
 * Data-access for /dashboard/monitoring. Always returns a COMPLETE list
 * (every component_name category; every active station) even for
 * components/stations that have never been checked — defaulting those
 * to UNKNOWN (item 7) rather than silently omitting them.
 */

/** Latest status for each of the 7 fixed component_name categories. */
export async function getSystemHealth() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('v_system_health_latest').select('*');
  if (error) throw error;

  const byComponent = new Map((data ?? []).map((row) => [row.component_name, row]));

  return Object.values(COMPONENT_NAME).map((componentName) => {
    const latest = byComponent.get(componentName) ?? null;
    return {
      component_name: componentName,
      status: resolveDisplayStatus(latest),
      latency_ms: latest?.latency_ms ?? null,
      checked_at: latest?.checked_at ?? null,
      error_message: latest?.error_message ?? null,
    };
  });
}

/** Latest status for every active station, defaulting to UNKNOWN if it's never been checked. */
export async function getStationHealth() {
  const supabase = await createSupabaseServerClient();

  const [{ data: stations, error: stationsError }, { data: healthRows, error: healthError }] = await Promise.all([
    supabase.from('stations').select('id, station_code, station_name, station_type, is_active').eq('is_active', true).order('station_name'),
    supabase.from('v_station_health_latest').select('*'),
  ]);
  if (stationsError) throw stationsError;
  if (healthError) throw healthError;

  const byStationId = new Map((healthRows ?? []).map((row) => [row.station_id, row]));

  return (stations ?? []).map((station) => {
    const latest = byStationId.get(station.id) ?? null;
    return {
      station,
      status: resolveDisplayStatus(latest),
      latency_ms: latest?.latency_ms ?? null,
      checked_at: latest?.checked_at ?? null,
      error_message: latest?.error_message ?? null,
    };
  });
}
