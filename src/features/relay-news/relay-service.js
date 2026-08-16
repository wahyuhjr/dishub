import 'server-only';
import { createRadioRelayAdapter } from '@/lib/radio-relay/factory';
import { generateCorrelationId, generateIdempotencyKey } from '@/lib/radio-relay/ids';
import { logRelayEvent } from '@/lib/radio-relay/log-relay-event';
import { RadioRelayTimeoutError } from '@/lib/radio-relay/errors';

/**
 * Service/adapter layer for the relay-news module. Server Actions
 * (actions.js) call these functions — UI components never call Supabase
 * directly, and relay in particular MUST go through relayMessage() here
 * rather than being invoked ad hoc from a component.
 *
 * Every function takes an already-authenticated `supabase` client (the
 * caller's own session — see src/lib/supabase/server.js) so Postgres RLS
 * + the SECURITY INVOKER RPC functions in
 * supabase/migrations/20260814120000_relay_news_module.sql apply exactly
 * as if the user ran the statements themselves. Nothing here uses the
 * service-role/admin client.
 */

function toNullable(value) {
  return value === '' || value === undefined ? null : value;
}

/** Creates a new DRAFT message. `operatorId` must come from the verified session, never the client. */
export async function createDraftMessage(supabase, fields, operatorId) {
  return supabase
    .from('maritime_messages')
    .insert({
      message_number: fields.message_number,
      message_type: fields.message_type,
      title: fields.title,
      received_at: new Date(fields.received_at).toISOString(),
      scheduled_at: fields.scheduled_at ? new Date(fields.scheduled_at).toISOString() : null,
      origin_station_id: toNullable(fields.origin_station_id),
      destination_station_id: toNullable(fields.destination_station_id),
      content: fields.content,
      location_description: toNullable(fields.location_description),
      latitude: toNullable(fields.latitude),
      longitude: toNullable(fields.longitude),
      sender_name: toNullable(fields.sender_name),
      priority: fields.priority,
      operator_id: operatorId,
      status: 'DRAFT',
    })
    .select()
    .single();
}

/** Updates a DRAFT message's editable fields. RLS restricts this to the owning OPERATOR (or ADMIN) while status is still DRAFT. */
export async function updateDraftMessage(supabase, messageId, fields) {
  return supabase
    .from('maritime_messages')
    .update({
      message_number: fields.message_number,
      message_type: fields.message_type,
      title: fields.title,
      received_at: new Date(fields.received_at).toISOString(),
      scheduled_at: fields.scheduled_at ? new Date(fields.scheduled_at).toISOString() : null,
      origin_station_id: toNullable(fields.origin_station_id),
      destination_station_id: toNullable(fields.destination_station_id),
      content: fields.content,
      location_description: toNullable(fields.location_description),
      latitude: toNullable(fields.latitude),
      longitude: toNullable(fields.longitude),
      sender_name: toNullable(fields.sender_name),
      priority: fields.priority,
    })
    .eq('id', messageId)
    .select()
    .single();
}

/** DRAFT -> PENDING_VERIFICATION */
export async function submitForVerification(supabase, messageId, ctx) {
  return supabase.rpc('submit_message_for_verification', {
    p_message_id: messageId,
    p_ip: ctx?.ipAddress ?? null,
    p_user_agent: ctx?.userAgent ?? null,
  });
}

/** PENDING_VERIFICATION -> VERIFIED */
export async function verifyMessage(supabase, messageId, ctx) {
  return supabase.rpc('verify_message', {
    p_message_id: messageId,
    p_ip: ctx?.ipAddress ?? null,
    p_user_agent: ctx?.userAgent ?? null,
  });
}

/** VERIFIED -> FAILED */
export async function markMessageFailed(supabase, messageId, reason, ctx) {
  return supabase.rpc('mark_message_failed', {
    p_message_id: messageId,
    p_reason: toNullable(reason),
    p_ip: ctx?.ipAddress ?? null,
    p_user_agent: ctx?.userAgent ?? null,
  });
}

/** DRAFT -> ARCHIVED or RELAYED -> ARCHIVED */
export async function archiveMessage(supabase, messageId, ctx) {
  return supabase.rpc('archive_message', {
    p_message_id: messageId,
    p_ip: ctx?.ipAddress ?? null,
    p_user_agent: ctx?.userAgent ?? null,
  });
}

/**
 * (VERIFIED | FAILED) -> RELAYING -> (RELAYED | FAILED), atomically
 * creating a relay_attempts row in the same DB transaction (see
 * relay_message() RPC). This is the ONLY sanctioned way to relay a
 * message in this app, and the ONLY place that talks to the radio relay
 * adapter layer (src/lib/radio-relay/**) — UI components never call the
 * adapter or the device directly (items 12/13 of the radio relay
 * requirements).
 *
 * The adapter (chosen by RADIO_ADAPTER, see factory.js) is given a
 * fresh idempotency key + correlation id for this logical relay
 * request, reused across any internal retries the adapter performs —
 * see resilient-adapter.js. Whatever the adapter actually reports
 * (success, or a timeout/failure with a reason) is what gets recorded
 * in relay_attempts and drives the message's next status: RELAYED on
 * success, or back to FAILED (with the error) so it can be retried.
 */
export async function relayMessage(supabase, { messageId, stationId, responseMessage }, ctx) {
  const { data: message, error: messageError } = await supabase
    .from('maritime_messages')
    .select('id, message_number, message_type, content')
    .eq('id', messageId)
    .maybeSingle();
  if (messageError) return { data: null, error: messageError };
  if (!message) return { data: null, error: { message: 'Berita tidak ditemukan.' } };

  const { data: station } = await supabase
    .from('stations')
    .select('id, connection_config')
    .eq('id', stationId)
    .maybeSingle();

  const adapter = createRadioRelayAdapter();
  const correlationId = generateCorrelationId();
  const idempotencyKey = generateIdempotencyKey();

  logRelayEvent('relay_attempt_start', { messageId, stationId, correlationId, idempotencyKey });

  let outcome;
  try {
    const result = await adapter.relayMessage({
      messageId,
      stationId,
      messageNumber: message.message_number,
      messageType: message.message_type,
      content: message.content,
      idempotencyKey,
      correlationId,
      stationConnectionConfig: station?.connection_config ?? {},
    });
    outcome = {
      status: 'SUCCESS',
      responseMessage: result.responseMessage ?? responseMessage ?? null,
      externalReference: result.externalReference ?? null,
      errorMessage: null,
    };
    logRelayEvent('relay_attempt_success', { messageId, stationId, correlationId, result });
  } catch (error) {
    const status = error instanceof RadioRelayTimeoutError ? 'TIMEOUT' : 'FAILED';
    outcome = { status, responseMessage: responseMessage ?? null, externalReference: null, errorMessage: error.message };
    logRelayEvent('relay_attempt_failure', { messageId, stationId, correlationId, error });
  }

  return supabase.rpc('relay_message', {
    p_message_id: messageId,
    p_station_id: stationId,
    p_response_message: toNullable(outcome.responseMessage),
    p_ip: ctx?.ipAddress ?? null,
    p_user_agent: ctx?.userAgent ?? null,
    p_status: outcome.status,
    p_error_message: toNullable(outcome.errorMessage),
    p_idempotency_key: idempotencyKey,
    p_correlation_id: correlationId,
    p_external_reference: toNullable(outcome.externalReference),
  });
}
