import 'server-only';
import { withTimeout } from './with-timeout';
import {
  HEALTH_STATUS,
  COMPONENT_NAME,
  STATION_TYPE_TO_COMPONENT_NAME,
  DEFAULT_CHECK_TIMEOUT_MS,
  DEFAULT_DEGRADED_LATENCY_MS,
} from './constants';
import { getComponentAdapter, getStationAdapter } from './adapters/factory';

/**
 * Pure mapping from a check's outcome to a HEALTH_STATUS value:
 *   - threw/errored              -> OFFLINE
 *   - succeeded, latency > threshold -> DEGRADED (item 8)
 *   - succeeded, latency within threshold -> ONLINE
 * Exported standalone so it's trivially unit-testable without needing a
 * real adapter/timeout/Supabase round trip.
 */
export function determineStatus({ error, latencyMs }, degradedThresholdMs = DEFAULT_DEGRADED_LATENCY_MS) {
  if (error) {
    return { status: HEALTH_STATUS.OFFLINE, errorMessage: error.message };
  }
  if (typeof latencyMs === 'number' && latencyMs > degradedThresholdMs) {
    return { status: HEALTH_STATUS.DEGRADED, errorMessage: null };
  }
  return { status: HEALTH_STATUS.ONLINE, errorMessage: null };
}

/**
 * Runs one adapter's checkHealth() under a timeout (item 6), maps the
 * outcome to a status (item 8), and inserts the resulting row into
 * system_health_checks (item 5's five fields, one row per check).
 */
async function runCheck(supabase, adapter, { componentName, stationId = null, timeoutMs = DEFAULT_CHECK_TIMEOUT_MS, degradedThresholdMs = DEFAULT_DEGRADED_LATENCY_MS }) {
  let result;
  let error = null;

  try {
    result = await withTimeout(() => adapter.checkHealth(), timeoutMs);
  } catch (err) {
    error = err;
    result = { latencyMs: null };
  }

  const { status, errorMessage } = determineStatus({ error, latencyMs: result.latencyMs }, degradedThresholdMs);

  const row = {
    component_name: componentName,
    station_id: stationId,
    status,
    latency_ms: result.latencyMs ?? null,
    error_message: errorMessage,
    checked_at: new Date().toISOString(),
  };

  const { data, error: insertError } = await supabase.from('system_health_checks').insert(row).select().single();
  if (insertError) throw insertError;
  return data;
}

/**
 * Runs every app-level/category check (SERVER, DATABASE, INTERNET,
 * RADIO_MF_HF, RADIO_DSC, AIS, VTS) plus one check per active station
 * whose type maps to a device category, and inserts a
 * system_health_checks row for each. Returns every inserted row.
 *
 * `supabase` should be a client with insert rights on
 * system_health_checks for the calling context (see /api/health, which
 * uses the service-role client for this — "automated monitoring agent"
 * per the RLS policy's own doc comment).
 */
export async function runAllHealthChecks(supabase, { timeoutMs, degradedThresholdMs } = {}) {
  const results = [];

  for (const componentName of Object.values(COMPONENT_NAME)) {
    const adapter = getComponentAdapter(componentName, { supabase });
    results.push(await runCheck(supabase, adapter, { componentName, timeoutMs, degradedThresholdMs }));
  }

  const { data: stations, error: stationsError } = await supabase
    .from('stations')
    .select('id, station_type')
    .eq('is_active', true);
  if (stationsError) throw stationsError;

  for (const station of stations ?? []) {
    const componentName = STATION_TYPE_TO_COMPONENT_NAME[station.station_type];
    if (!componentName) continue; // e.g. SROP — not one of the monitored device categories.

    const adapter = getStationAdapter(station.station_type);
    results.push(await runCheck(supabase, adapter, { componentName, stationId: station.id, timeoutMs, degradedThresholdMs }));
  }

  return results;
}
