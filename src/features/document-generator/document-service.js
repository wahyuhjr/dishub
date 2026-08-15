import 'server-only';
import { generateDocumentPdf } from './pdf-generator';
import { uploadDocument, createSignedDownloadUrl } from '@/lib/storage/documents';

/**
 * Service/adapter layer for the document generator. Server Actions
 * (actions.js) call these — components never touch PDF generation,
 * Storage, or Supabase directly ("Buat generator PDF hanya di server").
 */

/**
 * Generates the PDF (server-only), uploads it to the private
 * "documents" bucket, and records its metadata in message_documents —
 * all in one call. Returns the inserted row.
 */
export async function generateAndSaveDocument(supabase, fields, generatedBy) {
  const pdfBuffer = await generateDocumentPdf(fields);
  const fileName = `${fields.message_number || 'berita'}.pdf`;

  const path = await uploadDocument({
    prefix: 'berita',
    fileName,
    mimeType: 'application/pdf',
    bytes: pdfBuffer,
  });

  const { data, error } = await supabase
    .from('message_documents')
    .insert({
      message_number: fields.message_number,
      document_type: fields.category,
      file_path: path,
      file_name: fileName,
      mime_type: 'application/pdf',
      file_size: pdfBuffer.length,
      generated_by: generatedBy,
    })
    .select()
    .single();

  return { data, error, pdfBuffer };
}

/** Marks a generated document as archived (ADMIN/MASTER only, per RLS). */
export async function archiveMessageDocument(supabase, documentId) {
  return supabase
    .from('message_documents')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', documentId)
    .select()
    .single();
}

/** Resolves a document's storage path via its (RLS-visible) metadata row, then mints a short-lived signed URL. */
export async function getSignedDownloadUrlForDocument(supabase, documentId) {
  const { data: doc, error } = await supabase.from('message_documents').select('id, file_path').eq('id', documentId).maybeSingle();
  if (error) return { error };
  if (!doc) return { error: { message: 'Dokumen tidak ditemukan.' } };

  const signedUrl = await createSignedDownloadUrl(doc.file_path);
  return { data: { signedUrl } };
}
