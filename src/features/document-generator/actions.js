'use server';

import { revalidatePath } from 'next/cache';
import { requireAnyRole, requireUser } from '@/lib/auth/guards';
import { rolesFor } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/audit/request-context';
import { documentFormSchema, documentIdSchema } from './schema';
import * as documentService from './document-service';

/**
 * Generates the official PDF (server-only), uploads it, saves its
 * metadata, and logs the activity — all in one Server Action. Returns
 * a signed download URL for immediate use by the client (e.g. "buka PDF
 * yang baru dibuat") without a second round trip.
 */
export async function generateDocumentAction(input) {
  await requireAnyRole(rolesFor('documents.generate'));
  const parsed = documentFormSchema.parse(input);

  const supabase = await createSupabaseServerClient();
  const user = await requireUser();
  const ctx = await getRequestContext();

  const { data, error } = await documentService.generateAndSaveDocument(supabase, parsed, user.id);
  if (error) return { error: error.message };

  await supabase.from('activity_logs').insert({
    actor_id: user.id,
    action: 'GENERATE_MESSAGE_DOCUMENT',
    entity_type: 'message_documents',
    entity_id: data.id,
    metadata: { message_number: parsed.message_number, category: parsed.category },
    ip_address: ctx?.ipAddress ?? null,
    user_agent: ctx?.userAgent ?? null,
  });

  const { data: signedUrlData, error: signedUrlError } = await documentService.getSignedDownloadUrlForDocument(supabase, data.id);
  if (signedUrlError) return { error: signedUrlError.message };

  revalidatePath('/dashboard/generator-dokumen');
  return { success: true, data: { document: data, signedUrl: signedUrlData.signedUrl } };
}

/** Mints a short-lived signed URL for downloading a generated document, and logs the download. */
export async function downloadDocumentAction(documentId) {
  await requireAnyRole(rolesFor('documents.view'));
  const id = documentIdSchema.parse(documentId);

  const supabase = await createSupabaseServerClient();
  const user = await requireUser();
  const ctx = await getRequestContext();

  const { data, error } = await documentService.getSignedDownloadUrlForDocument(supabase, id);
  if (error) return { error: error.message };

  await supabase.from('activity_logs').insert({
    actor_id: user.id,
    action: 'DOWNLOAD_MESSAGE_DOCUMENT',
    entity_type: 'message_documents',
    entity_id: id,
    metadata: {},
    ip_address: ctx?.ipAddress ?? null,
    user_agent: ctx?.userAgent ?? null,
  });

  return { success: true, data };
}

/** ADMIN/MASTER only, per RLS on message_documents. */
export async function archiveDocumentAction(documentId) {
  await requireAnyRole(rolesFor('documents.archive'));
  const id = documentIdSchema.parse(documentId);

  const supabase = await createSupabaseServerClient();
  const user = await requireUser();
  const ctx = await getRequestContext();

  const { data, error } = await documentService.archiveMessageDocument(supabase, id);
  if (error) return { error: error.message };

  await supabase.from('activity_logs').insert({
    actor_id: user.id,
    action: 'ARCHIVE_MESSAGE_DOCUMENT',
    entity_type: 'message_documents',
    entity_id: id,
    metadata: {},
    ip_address: ctx?.ipAddress ?? null,
    user_agent: ctx?.userAgent ?? null,
  });

  revalidatePath('/dashboard/generator-dokumen');
  return { success: true, data };
}
