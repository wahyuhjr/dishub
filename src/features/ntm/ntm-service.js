import 'server-only';
import { uploadDocument, createSignedDownloadUrl } from '@/lib/storage/documents';

/**
 * Service/adapter layer for the /ntm module. Server Actions (actions.js)
 * call these — components never call Supabase or Storage directly.
 */

function toNullable(value) {
  return value === '' || value === undefined ? null : value;
}

/** Creates a new DRAFT NTM. `createdBy` must come from the verified session, never the client. */
export async function createDraftNtm(supabase, fields, createdBy) {
  return supabase
    .from('ntm_documents')
    .insert({
      ntm_number: fields.ntm_number,
      edition: toNullable(fields.edition),
      document_type: fields.document_type,
      title: fields.title,
      content: toNullable(fields.content),
      area_navigasi: toNullable(fields.area_navigasi),
      effective_from: fields.effective_from ? new Date(fields.effective_from).toISOString() : null,
      effective_until: fields.effective_until ? new Date(fields.effective_until).toISOString() : null,
      created_by: createdBy,
      status: 'DRAFT',
    })
    .select()
    .single();
}

/** Updates a DRAFT NTM's editable fields. RLS restricts this to the owning creator (or ADMIN) while status is still DRAFT. */
export async function updateDraftNtm(supabase, ntmDocumentId, fields) {
  return supabase
    .from('ntm_documents')
    .update({
      ntm_number: fields.ntm_number,
      edition: toNullable(fields.edition),
      document_type: fields.document_type,
      title: fields.title,
      content: toNullable(fields.content),
      area_navigasi: toNullable(fields.area_navigasi),
      effective_from: fields.effective_from ? new Date(fields.effective_from).toISOString() : null,
      effective_until: fields.effective_until ? new Date(fields.effective_until).toISOString() : null,
    })
    .eq('id', ntmDocumentId)
    .select()
    .single();
}

export async function submitNtmForVerification(supabase, ntmDocumentId, ctx) {
  return supabase.rpc('submit_ntm_for_verification', {
    p_ntm_document_id: ntmDocumentId,
    p_ip: ctx?.ipAddress ?? null,
    p_user_agent: ctx?.userAgent ?? null,
  });
}

export async function verifyNtm(supabase, ntmDocumentId, ctx) {
  return supabase.rpc('verify_ntm', {
    p_ntm_document_id: ntmDocumentId,
    p_ip: ctx?.ipAddress ?? null,
    p_user_agent: ctx?.userAgent ?? null,
  });
}

export async function publishNtm(supabase, ntmDocumentId, ctx) {
  return supabase.rpc('publish_ntm', {
    p_ntm_document_id: ntmDocumentId,
    p_ip: ctx?.ipAddress ?? null,
    p_user_agent: ctx?.userAgent ?? null,
  });
}

export async function archiveNtm(supabase, ntmDocumentId, ctx) {
  return supabase.rpc('archive_ntm', {
    p_ntm_document_id: ntmDocumentId,
    p_ip: ctx?.ipAddress ?? null,
    p_user_agent: ctx?.userAgent ?? null,
  });
}

/** Starts a new DRAFT revision of a PUBLISHED NTM — the only sanctioned way to change published content. */
export async function createNtmRevision(supabase, ntmDocumentId, ctx) {
  return supabase.rpc('create_ntm_revision', {
    p_ntm_document_id: ntmDocumentId,
    p_ip: ctx?.ipAddress ?? null,
    p_user_agent: ctx?.userAgent ?? null,
  });
}

/**
 * Uploads the file to the private "documents" bucket, then records its
 * metadata against the NTM row via the attach_ntm_document() RPC (which
 * re-checks status/ownership itself — see the migration).
 */
export async function uploadNtmDocument(supabase, ntmDocumentId, { fileName, mimeType, bytes }, ctx) {
  const path = await uploadDocument({ prefix: 'ntm', fileName, mimeType, bytes });

  return supabase.rpc('attach_ntm_document', {
    p_ntm_document_id: ntmDocumentId,
    p_file_path: path,
    p_file_name: fileName,
    p_mime_type: mimeType,
    p_file_size: bytes.length,
    p_ip: ctx?.ipAddress ?? null,
    p_user_agent: ctx?.userAgent ?? null,
  });
}

/** Resolves an NTM's storage path via its (RLS-visible) metadata row, then mints a short-lived signed URL. */
export async function getSignedDownloadUrlForNtm(supabase, ntmDocumentId) {
  const { data: doc, error } = await supabase.from('ntm_documents').select('id, file_path').eq('id', ntmDocumentId).maybeSingle();
  if (error) return { error };
  if (!doc) return { error: { message: 'NTM tidak ditemukan.' } };
  if (!doc.file_path) return { error: { message: 'NTM ini belum memiliki dokumen terlampir.' } };

  const signedUrl = await createSignedDownloadUrl(doc.file_path);
  return { data: { signedUrl } };
}
