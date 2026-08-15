import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const PAGE_SIZE = 20;

const LIST_SELECT = `
  id, ntm_number, edition, document_type, title, status, revision_number,
  published_at, archived_at, created_at, file_name,
  creator:profiles!created_by(id, username, full_name)
`;

/**
 * Server-side filtered/sorted/paginated list for /dashboard/ntm.
 * Filters: ntm_number, edition, tanggal terbit (published_at range),
 * status, pembuat (creator).
 */
export async function listNtmDocuments(filters = {}) {
  const supabase = await createSupabaseServerClient();

  const page = Math.max(1, Number(filters.page) || 1);

  let query = supabase
    .from('ntm_documents')
    .select(LIST_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.ntmNumber?.trim()) {
    query = query.ilike('ntm_number', `%${filters.ntmNumber.trim().replace(/[%,]/g, '')}%`);
  }
  if (filters.edition?.trim()) {
    query = query.ilike('edition', `%${filters.edition.trim().replace(/[%,]/g, '')}%`);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.creatorId) {
    query = query.eq('created_by', filters.creatorId);
  }
  if (filters.publishedFrom) {
    query = query.gte('published_at', new Date(filters.publishedFrom).toISOString());
  }
  if (filters.publishedTo) {
    const end = new Date(filters.publishedTo);
    end.setHours(23, 59, 59, 999);
    query = query.lte('published_at', end.toISOString());
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
  creator:profiles!created_by(id, username, full_name),
  verifier:profiles!verifier_id(id, username, full_name),
  previous_version:ntm_documents!previous_version_id(id, ntm_number, edition, revision_number, status)
`;

export async function getNtmDocumentById(id) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('ntm_documents').select(DETAIL_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return data;

  // previous_version_id is a self-referencing FK — PostgREST can embed
  // it as an array rather than a single object depending on how it
  // disambiguates the relationship. Normalize to a single object (or
  // null) so callers never have to special-case the shape.
  return {
    ...data,
    previous_version: Array.isArray(data.previous_version) ? (data.previous_version[0] ?? null) : data.previous_version,
  };
}

/** Distinct creators, for the "Pembuat" filter dropdown. */
export async function listNtmCreatorsForFilter() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('ntm_documents')
    .select('creator:profiles!created_by(id, username, full_name)');
  if (error) throw error;

  const seen = new Map();
  for (const row of data ?? []) {
    if (row.creator) seen.set(row.creator.id, row.creator);
  }
  return [...seen.values()];
}
