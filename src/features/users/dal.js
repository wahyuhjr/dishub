import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Data-access for /dashboard/user (ADMIN user management).
 *
 * All reads go through the RLS-scoped server client. The profiles SELECT
 * policy already restricts full visibility to ADMIN/MASTER, and the page
 * itself is ADMIN-only (requireRole('ADMIN')); this DAL never returns any
 * authentication secret — profiles physically cannot store passwords
 * (see 20260814100000 migration), so "never show password" is guaranteed
 * by the schema, not just by column selection.
 */

export const PAGE_SIZE = 20;
export const SORTABLE_COLUMNS = ['username', 'full_name', 'role', 'is_active', 'last_login_at', 'created_at'];

const LIST_SELECT = 'id, username, full_name, email, role, is_active, avatar_url, last_login_at, created_at';

export async function listUsers(filters = {}) {
  const supabase = await createSupabaseServerClient();

  const page = Math.max(1, Number(filters.page) || 1);
  const sortBy = SORTABLE_COLUMNS.includes(filters.sortBy) ? filters.sortBy : 'created_at';
  const sortDir = filters.sortDir === 'asc' ? 'asc' : 'desc';

  let query = supabase
    .from('profiles')
    .select(LIST_SELECT, { count: 'exact' })
    .order(sortBy, { ascending: sortDir === 'asc', nullsFirst: false });

  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%,]/g, '');
    query = query.or(`username.ilike.%${term}%,full_name.ilike.%${term}%`);
  }
  if (filters.role) {
    query = query.eq('role', filters.role);
  }
  if (filters.active === 'active') {
    query = query.eq('is_active', true);
  } else if (filters.active === 'inactive') {
    query = query.eq('is_active', false);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return { rows: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getUserById(id) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('profiles').select(LIST_SELECT + ', phone').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Recent activity log entries attributed to a user (requirement 15). */
export async function listActivityForUser(userId, limit = 20) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, action, entity_type, entity_id, metadata, created_at')
    .eq('actor_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Number of active ADMINs — used to warn the UI before destructive actions. */
export async function countActiveAdmins() {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'ADMIN')
    .eq('is_active', true);
  if (error) throw error;
  return count ?? 0;
}
