'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAnyRole } from '@/lib/auth/guards';
import { rolesFor } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/audit/request-context';
import { messageFormSchema, markFailedSchema, relaySchema, messageIdSchema } from './schema';
import * as relayService from './relay-service';

function firstIssueMessage(error) {
  return error.issues?.[0]?.message ?? 'Input tidak valid.';
}

function extractFormFields(formData) {
  return {
    message_number: formData.get('message_number'),
    message_type: formData.get('message_type'),
    title: formData.get('title'),
    received_at: formData.get('received_at'),
    scheduled_at: formData.get('scheduled_at'),
    origin_station_id: formData.get('origin_station_id'),
    destination_station_id: formData.get('destination_station_id'),
    content: formData.get('content'),
    location_description: formData.get('location_description'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
    sender_name: formData.get('sender_name'),
    priority: formData.get('priority'),
  };
}

/**
 * "Save Draft" — creates a new message with status DRAFT.
 * (prevState, formData) signature so it can drive useActionState.
 */
export async function saveDraftAction(prevState, formData) {
  const user = await requireAnyRole(rolesFor('messages.create'));

  const parsed = messageFormSchema.safeParse(extractFormFields(formData));
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await relayService.createDraftMessage(supabase, parsed.data, user.id);
  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard/relay-news');
  redirect(`/dashboard/relay-news/${data.id}`);
}

/**
 * "Submit for Verification" (from the /new form) — creates the message
 * then immediately transitions DRAFT -> PENDING_VERIFICATION, so an
 * operator confident in the data doesn't need two separate steps.
 */
export async function createAndSubmitForVerificationAction(prevState, formData) {
  const user = await requireAnyRole(rolesFor('messages.create'));

  const parsed = messageFormSchema.safeParse(extractFormFields(formData));
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { data: created, error: createError } = await relayService.createDraftMessage(supabase, parsed.data, user.id);
  if (createError) {
    return { error: createError.message };
  }

  const ctx = await getRequestContext();
  const { error: submitError } = await relayService.submitForVerification(supabase, created.id, ctx);
  if (submitError) {
    // The message row was still created (as DRAFT) — surface the error but
    // send the user to it rather than losing their work.
    redirect(`/dashboard/relay-news/${created.id}`);
  }

  revalidatePath('/dashboard/relay-news');
  redirect(`/dashboard/relay-news/${created.id}`);
}

/** Updates an existing DRAFT message's fields. RLS restricts this to the owning OPERATOR (or ADMIN) while status is still DRAFT. */
export async function updateDraftMessageAction(messageId, formData) {
  await requireAnyRole(rolesFor('messages.update_own_draft'));
  const id = messageIdSchema.parse(messageId);

  const parsed = messageFormSchema.safeParse(extractFormFields(formData));
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await relayService.updateDraftMessage(supabase, id, parsed.data);
  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard/relay-news');
  redirect(`/dashboard/relay-news/${data.id}`);
}

/** DRAFT -> PENDING_VERIFICATION, for an EXISTING draft (detail/list page). */
export async function submitForVerificationAction(messageId) {
  await requireAnyRole(rolesFor('messages.submit_for_verification'));
  const id = messageIdSchema.parse(messageId);

  const supabase = await createSupabaseServerClient();
  const ctx = await getRequestContext();
  const { data, error } = await relayService.submitForVerification(supabase, id, ctx);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/relay-news');
  revalidatePath(`/dashboard/relay-news/${id}`);
  return { success: true, data };
}

/**
 * PENDING_VERIFICATION -> VERIFIED. MASTER/ADMIN only.
 *
 * requirement: "Jangan izinkan OPERATOR melakukan verifikasi jika
 * role-nya tidak sesuai" — requireAnyRole() re-derives the role from the
 * server session/database (never trusts the client) and redirects to
 * /forbidden for anyone not MASTER/ADMIN; the verify_message() DB
 * function independently re-checks the same thing.
 */
export async function verifyMessageAction(messageId) {
  await requireAnyRole(rolesFor('messages.verify'));
  const id = messageIdSchema.parse(messageId);

  const supabase = await createSupabaseServerClient();
  const ctx = await getRequestContext();
  const { data, error } = await relayService.verifyMessage(supabase, id, ctx);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/relay-news');
  revalidatePath(`/dashboard/relay-news/${id}`);
  return { success: true, data };
}

/** VERIFIED -> FAILED. MASTER/ADMIN only. */
export async function markMessageFailedAction(input) {
  await requireAnyRole(rolesFor('messages.mark_failed'));
  const parsed = markFailedSchema.parse(input);

  const supabase = await createSupabaseServerClient();
  const ctx = await getRequestContext();
  const { data, error } = await relayService.markMessageFailed(supabase, parsed.message_id, parsed.reason, ctx);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/relay-news');
  revalidatePath(`/dashboard/relay-news/${parsed.message_id}`);
  return { success: true, data };
}

/**
 * (VERIFIED | FAILED) -> RELAYING -> RELAYED. ADMIN/OPERATOR only.
 *
 * Goes through relay-service.relayMessage() -> the relay_message() DB
 * RPC, which is the ONLY place that writes relay_attempts + updates the
 * message status, atomically, in a single transaction.
 */
export async function relayMessageAction(input) {
  await requireAnyRole(rolesFor('messages.relay'));
  const parsed = relaySchema.parse(input);

  const supabase = await createSupabaseServerClient();
  const ctx = await getRequestContext();
  const { data, error } = await relayService.relayMessage(
    supabase,
    { messageId: parsed.message_id, stationId: parsed.station_id, responseMessage: parsed.response_message },
    ctx
  );
  if (error) return { error: error.message };

  revalidatePath('/dashboard/relay-news');
  revalidatePath(`/dashboard/relay-news/${parsed.message_id}`);
  return { success: true, data };
}

/** DRAFT -> ARCHIVED (own draft, or ADMIN) / RELAYED -> ARCHIVED (MASTER/ADMIN). */
export async function archiveMessageAction(messageId) {
  // Both archive_draft and archive_relayed roles include ADMIN; the DB
  // function itself makes the ownership/status-specific decision, so we
  // only need to confirm the user is at least ONE of the two role sets
  // here — the RPC is the real gate.
  await requireAnyRole([...new Set([...rolesFor('messages.archive_draft'), ...rolesFor('messages.archive_relayed')])]);
  const id = messageIdSchema.parse(messageId);

  const supabase = await createSupabaseServerClient();
  const ctx = await getRequestContext();
  const { data, error } = await relayService.archiveMessage(supabase, id, ctx);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/relay-news');
  revalidatePath(`/dashboard/relay-news/${id}`);
  return { success: true, data };
}
