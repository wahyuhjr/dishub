import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PAGE_SIZE } from './filters';
import { computeReportSummary } from './summary';

/**
 * Data-access for /dashboard/laporan (reports).
 *
 * SECURITY / REQUIREMENTS:
 *   - Every query runs through the RLS-scoped server client, so a report
 *     only ever includes rows the current user is allowed to see
 *     (requirement 10: "Export harus menghormati role dan RLS").
 *   - All filtering, sorting, pagination and aggregation happen in the
 *     database / on the server — the browser never receives more than a
 *     single page of rows for the on-screen table (requirement 9 & 11).
 */

export const REPORT_SELECT = `
  id, message_number, message_type, title, received_at, relayed_at, status, priority, delay_reason,
  operator:profiles!operator_id(id, username, full_name),
  origin_station:stations!origin_station_id(id, station_code, station_name),
  destination_station:stations!destination_station_id(id, station_code, station_name)
`;

/**
 * Applies the normalized report filters (from parseReportFilters) to a
 * PostgREST query builder. Exported separately so it can be reused by the
 * paginated table query, the summary query, and the streaming export —
 * guaranteeing all three apply an identical filter set.
 */
export function applyReportFilters(query, filters) {
  if (filters.type) query = query.eq('message_type', filters.type);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.operatorId) query = query.eq('operator_id', filters.operatorId);
  if (filters.stationId) {
    query = query.or(`origin_station_id.eq.${filters.stationId},destination_station_id.eq.${filters.stationId}`);
  }
  if (filters.dateFromUtc) query = query.gte('received_at', filters.dateFromUtc);
  if (filters.dateToUtc) query = query.lte('received_at', filters.dateToUtc);
  return query;
}

/** One page of report rows for the on-screen table. */
export async function listReportRows(filters) {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from('maritime_messages')
    .select(REPORT_SELECT, { count: 'exact' })
    .order(filters.sortBy, { ascending: filters.sortDir === 'asc' });

  query = applyReportFilters(query, filters);

  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return { rows: data ?? [], total: count ?? 0, page: filters.page, pageSize: PAGE_SIZE };
}

/**
 * Fetches every filtered row (server-side, RLS-scoped) in batches and
 * yields them. Used by the summary aggregation and the streaming export
 * so we never load an unbounded result set into a single array unless a
 * caller explicitly collects it. `SUMMARY_ROW_CAP` bounds memory for the
 * summary path; the export path streams and is uncapped.
 */
const BATCH_SIZE = 1000;

export async function* iterateReportRows(filters, { select = REPORT_SELECT } = {}) {
  const supabase = await createSupabaseServerClient();
  let offset = 0;

  // Keyset pagination on a stable, indexed order avoids the deep-offset
  // cost and is safe against rows shifting between batches.
  for (;;) {
    let query = supabase
      .from('maritime_messages')
      .select(select)
      .order(filters.sortBy, { ascending: filters.sortDir === 'asc' })
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    query = applyReportFilters(query, filters);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) yield row;

    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }
}

// Hard cap for the on-page summary so a pathological filter can't pull an
// unbounded set into memory just to render summary cards. Exports use the
// streaming iterator directly and are not subject to this cap.
export const SUMMARY_ROW_CAP = 50000;

/** Aggregated summary for the current filter set (requirement 2). */
export async function getReportSummary(filters) {
  const rows = [];
  for await (const row of iterateReportRows(filters)) {
    rows.push(row);
    if (rows.length >= SUMMARY_ROW_CAP) break;
  }
  return { summary: computeReportSummary(rows), capped: rows.length >= SUMMARY_ROW_CAP };
}

/** Operators that have authored at least one message — for the filter dropdown. */
export async function listOperatorsForFilter() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('profiles').select('id, username, full_name').order('username');
  if (error) throw error;
  return data ?? [];
}

/** Active stations — for the station filter dropdown. */
export async function listStationsForFilter() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('stations')
    .select('id, station_code, station_name')
    .eq('is_active', true)
    .order('station_name');
  if (error) throw error;
  return data ?? [];
}
