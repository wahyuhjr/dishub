import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Data-access for the /dashboard landing page. Read-only, server-only —
 * mirrors the pattern in src/features/relay-news/dal.js. All queries run
 * under the caller's own RLS-scoped session (get_dashboard_summary is
 * the one SECURITY DEFINER exception, see the migration for why).
 */

/** Consolidated counters (message/status/type breakdown, relay success/failure, station counts, latest health). */
export async function getDashboardSummary() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_dashboard_summary');
  if (error) throw error;
  return data;
}

function startOfTodayIso() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function dayRangeIso(daysAgo) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Count of messages received today (local server time) — for the "Total Berita Hari Ini" stat card. */
export async function getTodayMessageCount() {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from('maritime_messages')
    .select('id', { count: 'exact', head: true })
    .gte('received_at', startOfTodayIso());
  if (error) throw error;
  return count ?? 0;
}

/** Count of messages received yesterday — the comparison point for the "Total Berita Hari Ini" trend badge. */
export async function getYesterdayMessageCount() {
  const supabase = await createSupabaseServerClient();
  const { start, end } = dayRangeIso(1);
  const { count, error } = await supabase
    .from('maritime_messages')
    .select('id', { count: 'exact', head: true })
    .gte('received_at', start)
    .lt('received_at', end);
  if (error) throw error;
  return count ?? 0;
}

/** Count of messages that reached RELAYED status today (by relayed_at) — "Sudah Relay" stat card. */
export async function getTodayRelayedCount() {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from('maritime_messages')
    .select('id', { count: 'exact', head: true })
    .gte('relayed_at', startOfTodayIso());
  if (error) throw error;
  return count ?? 0;
}

/** Same as above, for yesterday — the comparison point for the "Sudah Relay" trend badge. */
export async function getYesterdayRelayedCount() {
  const supabase = await createSupabaseServerClient();
  const { start, end } = dayRangeIso(1);
  const { count, error } = await supabase
    .from('maritime_messages')
    .select('id', { count: 'exact', head: true })
    .gte('relayed_at', start)
    .lt('relayed_at', end);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Messages whose scheduled relay time has already passed but that
 * haven't reached RELAYED/ARCHIVED yet — "Terlambat" stat card.
 */
export async function getOverdueMessageCount() {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from('maritime_messages')
    .select('id', { count: 'exact', head: true })
    .not('scheduled_at', 'is', null)
    .lt('scheduled_at', new Date().toISOString())
    .not('status', 'in', '(RELAYED,ARCHIVED)');
  if (error) throw error;
  return count ?? 0;
}

/** Successful relay_attempts per day for the last 7 days, oldest first — feeds the weekly bar chart. */
export async function getWeeklyRelayCounts() {
  const supabase = await createSupabaseServerClient();

  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  const rangeStart = days[0].toISOString();

  const { data, error } = await supabase
    .from('relay_attempts')
    .select('started_at, status')
    .eq('status', 'SUCCESS')
    .gte('started_at', rangeStart);
  if (error) throw error;

  const counts = days.map((day) => {
    const dayKey = day.toDateString();
    const total = (data ?? []).filter((row) => new Date(row.started_at).toDateString() === dayKey).length;
    return { date: day, total };
  });

  return counts;
}

const RECENT_SELECT = `
  id, message_number, message_type, title, received_at, status, priority,
  operator:profiles!operator_id(id, username, full_name)
`;

/** Latest messages, newest first — feeds both the "Riwayat Berita" table and the notification panel. */
export async function getRecentMessages(limit = 8) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('maritime_messages')
    .select(RECENT_SELECT)
    .order('received_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
