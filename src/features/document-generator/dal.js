import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Data-access for generated berita bahaya documents (message_documents). */

const SELECT = `
  id, message_id, message_number, document_type, file_name, mime_type, file_size,
  created_at, archived_at,
  generator:profiles!generated_by(id, username, full_name)
`;

export async function listMessageDocuments(limit = 10) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('message_documents')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getMessageDocumentById(id) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('message_documents').select(`${SELECT}, file_path`).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
