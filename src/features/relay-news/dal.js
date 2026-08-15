import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const PAGE_SIZE = 20;
export const SORTABLE_COLUMNS = ['received_at', 'message_number', 'status', 'priority', 'created_at'];

const LIST_SELECT = `
  id, message_number, message_type, title, received_at, scheduled_at, relayed_at,
  location_description, latitude, longitude, sender_name, status, priority, delay_reason,
  created_at, updated_at,
  origin_station:stations!origin_station_id(id, station_code, station_name),
  destination_station:stations!destination_station_id(id, station_code, station_name),
  operator:profiles!operator_id(id, username, full_name),
  verifier:profiles!verifier_id(id, username, full_name)
`;

/**
 * Server-side filtered/sorted/paginated list for /dashboard/relay-news.
 * All filtering/sorting/pagination happens in the database — the client
 * never receives more than one page of rows.
 */
export async function listMessages(filters = {}) {
  const supabase = await createSupabaseServerClient();

  const page = Math.max(1, Number(filters.page) || 1);
  const sortBy = SORTABLE_COLUMNS.includes(filters.sortBy) ? filters.sortBy : 'received_at';
  const sortDir = filters.sortDir === 'asc' ? 'asc' : 'desc';

  let query = supabase
    .from('maritime_messages')
    .select(LIST_SELECT, { count: 'exact' })
    .order(sortBy, { ascending: sortDir === 'asc' });

  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%,]/g, '');
    query = query.or(`message_number.ilike.%${term}%,title.ilike.%${term}%,content.ilike.%${term}%`);
  }
  if (filters.messageType) {
    query = query.eq('message_type', filters.messageType);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.operatorId) {
    query = query.eq('operator_id', filters.operatorId);
  }
  if (filters.dateFrom) {
    query = query.gte('received_at', new Date(filters.dateFrom).toISOString());
  }
  if (filters.dateTo) {
    // Inclusive of the whole "to" day.
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    query = query.lte('received_at', end.toISOString());
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return { rows: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE };
}

const DETAIL_SELECT = `
  *,
  origin_station:stations!origin_station_id(id, station_code, station_name),
  destination_station:stations!destination_station_id(id, station_code, station_name),
  operator:profiles!operator_id(id, username, full_name),
  verifier:profiles!verifier_id(id, username, full_name)
`;

export async function getMessageById(id) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('maritime_messages').select(DETAIL_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listRelayAttempts(messageId) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('relay_attempts')
    .select('id, station_id, attempt_number, started_at, completed_at, status, response_message, station:stations(station_code, station_name)')
    .eq('message_id', messageId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listStationsForSelect() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('stations')
    .select('id, station_code, station_name')
    .eq('is_active', true)
    .order('station_name');
  if (error) throw error;
  return data ?? [];
}

/** For the "Filter operator" dropdown — anyone who has authored at least one message. */
export async function listOperatorsForFilter() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('profiles').select('id, username, full_name').order('username');
  if (error) throw error;
  return data ?? [];
}
