'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAnyRole, requireUser } from '@/lib/auth/guards';
import { rolesFor } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/audit/request-context';
import { validateFile } from '@/lib/storage/validate-file';
import { ntmFormSchema, ntmIdSchema } from './schema';
import * as ntmService from './ntm-service';

/** Creates a DRAFT NTM, then redirects to its detail page. */
export async function createNtmAction(formData) {
  await requireAnyRole(rolesFor('ntm.create'));
  const parsed = ntmFormSchema.parse(Object.fromEntries(formData));

  const supabase = await createSupabaseServerClient();
  const user = await requireUser();

  const { data, error } = await ntmService.createDraftNtm(supabase, parsed, user.id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/ntm');
  redirect(`/dashboard/ntm/${data.id}`);
}

/** Updates a DRAFT NTM's content. RLS restricts this to the owning creator (or ADMIN) while status is DRAFT. */
export async function updateNtmAction(ntmDocumentId, formData) {
  await requireAnyRole(rolesFor('ntm.update_own_draft'));
  const id = ntmIdSchema.parse(ntmDocumentId);
  const parsed = ntmFormSchema.parse(Object.fromEntries(formData));

  const supabase = await createSupabaseServerClient();
  const { error } = await ntmService.updateDraftNtm(supabase, id, parsed);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/ntm');
  revalidatePath(`/dashboard/ntm/${id}`);
  redirect(`/dashboard/ntm/${id}`);
}

export async function submitNtmForVerificationAction(ntmDocumentId) {
  await requireAnyRole(rolesFor('ntm.submit_for_verification'));
  const id = ntmIdSchema.parse(ntmDocumentId);

  const supabase = await createSupabaseServerClient();
  const ctx = await getRequestContext();
  const { data, error } = await ntmService.submitNtmForVerification(supabase, id, ctx);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/ntm');
  revalidatePath(`/dashboard/ntm/${id}`);
  return { success: true, data };
}

export async function verifyNtmAction(ntmDocumentId) {
  await requireAnyRole(rolesFor('ntm.verify'));
  const id = ntmIdSchema.parse(ntmDocumentId);

  const supabase = await createSupabaseServerClient();
  const ctx = await getRequestContext();
  const { data, error } = await ntmService.verifyNtm(supabase, id, ctx);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/ntm');
  revalidatePath(`/dashboard/ntm/${id}`);
  return { success: true, data };
}

/**
 * Publishes an NTM document. Only ADMIN/MASTER may publish (see
 * permissions.js "ntm.publish") — publishing an official Notice to
 * Marine is explicitly a MASTER responsibility, not OPERATOR's. Goes
 * through the publish_ntm() RPC, which also auto-supersedes (archives)
 * the previous version when publishing a revision.
 */
export async function publishNtmAction(ntmDocumentId) {
  await requireAnyRole(rolesFor('ntm.publish'));
  const id = ntmIdSchema.parse(ntmDocumentId);

  const supabase = await createSupabaseServerClient();
  const ctx = await getRequestContext();
  const { data, error } = await ntmService.publishNtm(supabase, id, ctx);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/ntm');
  revalidatePath(`/dashboard/ntm/${id}`);
  return { success: true, data };
}

export async function archiveNtmAction(ntmDocumentId) {
  // Both archive_draft and archive_published roles include ADMIN; the DB
  // function makes the ownership/status-specific decision — this just
  // confirms the user is at least ONE of the two role sets.
  await requireAnyRole([...new Set([...rolesFor('ntm.archive_draft'), ...rolesFor('ntm.archive_published')])]);
  const id = ntmIdSchema.parse(ntmDocumentId);

  const supabase = await createSupabaseServerClient();
  const ctx = await getRequestContext();
  const { data, error } = await ntmService.archiveNtm(supabase, id, ctx);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/ntm');
  revalidatePath(`/dashboard/ntm/${id}`);
  return { success: true, data };
}

/** Starts a new DRAFT revision of a PUBLISHED NTM, then redirects to the revision's detail page. */
export async function createNtmRevisionAction(ntmDocumentId) {
  await requireAnyRole(rolesFor('ntm.revise'));
  const id = ntmIdSchema.parse(ntmDocumentId);

  const supabase = await createSupabaseServerClient();
  const ctx = await getRequestContext();
  const { data, error } = await ntmService.createNtmRevision(supabase, id, ctx);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/ntm');
  redirect(`/dashboard/ntm/${data.id}`);
}

/**
 * Uploads a PDF/navigation document against an NTM. Validates MIME type
 * and size server-side (never trusts the client's own check) before
 * ever touching Storage — "Validasi file: MIME type, ukuran maksimum,
 * nama file aman" is enforced here + in sanitizeFileName()/uploadDocument().
 */
export async function uploadNtmDocumentAction(ntmDocumentId, formData) {
  await requireAnyRole([...new Set([...rolesFor('ntm.update_own_draft'), rolesFor('ntm.verify')[0]])]);
  const id = ntmIdSchema.parse(ntmDocumentId);

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { error: 'File tidak valid.' };
  }

  const validation = validateFile(file);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const supabase = await createSupabaseServerClient();
  const ctx = await getRequestContext();
  const bytes = Buffer.from(await file.arrayBuffer());

  const { data, error } = await ntmService.uploadNtmDocument(
    supabase,
    id,
    { fileName: file.name, mimeType: file.type, bytes },
    ctx
  );
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/ntm/${id}`);
  return { success: true, data };
}

/** Mints a short-lived signed URL for downloading an NTM's document, and logs the download. */
export async function downloadNtmDocumentAction(ntmDocumentId) {
  await requireAnyRole(rolesFor('ntm.view'));
  const id = ntmIdSchema.parse(ntmDocumentId);

  const supabase = await createSupabaseServerClient();
  const user = await requireUser();
  const ctx = await getRequestContext();

  const { data, error } = await ntmService.getSignedDownloadUrlForNtm(supabase, id);
  if (error) return { error: error.message };

  await supabase.from('activity_logs').insert({
    actor_id: user.id,
    action: 'DOWNLOAD_NTM_DOCUMENT',
    entity_type: 'ntm_documents',
    entity_id: id,
    metadata: {},
    ip_address: ctx?.ipAddress ?? null,
    user_agent: ctx?.userAgent ?? null,
  });

  return { success: true, data };
}
