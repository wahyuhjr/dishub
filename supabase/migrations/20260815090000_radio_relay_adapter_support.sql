-- =====================================================================
-- Digital Relay Berita Bahaya & Notice To Marine (NTM)
-- Migration: radio relay adapter support (idempotency, correlation id,
-- error_message, RELAYING -> FAILED transition)
-- =====================================================================
-- Supports the new src/lib/radio-relay/** adapter abstraction layer:
-- relay_message() now accepts the real outcome of an actual device
-- relay attempt (success or failure) instead of always assuming
-- success, and relay_attempts records enough to trace/de-duplicate a
-- request end to end (idempotency_key, correlation_id) and explain a
-- failure (error_message).
-- =====================================================================

alter table public.relay_attempts
  add column if not exists error_message text,
  add column if not exists idempotency_key text,
  add column if not exists correlation_id text;

comment on column public.relay_attempts.error_message is
  'Set when status is FAILED or TIMEOUT — the reason the radio relay adapter reported for the failure.';
comment on column public.relay_attempts.idempotency_key is
  'One key per logical relay request (stable across the adapter''s internal retries) — see src/lib/radio-relay/ids.js. Unique when set, so the same logical attempt can never be recorded twice.';
comment on column public.relay_attempts.correlation_id is
  'Traces this attempt across logs and the receiving device/system — see src/lib/radio-relay/ids.js.';

-- Idempotency safety net: NULL is allowed (older/manual rows), but a
-- given key can only ever be recorded once.
create unique index if not exists idx_relay_attempts_idempotency_key
  on public.relay_attempts (idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------
-- New state machine edge: RELAYING -> FAILED (a real device relay
-- attempt failed after the message left VERIFIED/FAILED and entered
-- RELAYING — as opposed to mark_message_failed(), which only covers
-- VERIFIED -> FAILED before a relay was even attempted). FAILED -> RELAYING
-- already exists, so a failed relay can always be retried.
-- ---------------------------------------------------------------------
create or replace function public.assert_message_transition(p_from text, p_to text)
returns void
language plpgsql
as $$
begin
  if not (
    (p_from = 'DRAFT' and p_to = 'PENDING_VERIFICATION')
    or (p_from = 'PENDING_VERIFICATION' and p_to = 'VERIFIED')
    or (p_from = 'VERIFIED' and p_to = 'RELAYING')
    or (p_from = 'RELAYING' and p_to = 'RELAYED')
    or (p_from = 'RELAYING' and p_to = 'FAILED')
    or (p_from = 'DRAFT' and p_to = 'ARCHIVED')
    or (p_from = 'VERIFIED' and p_to = 'FAILED')
    or (p_from = 'FAILED' and p_to = 'RELAYING')
    or (p_from = 'RELAYED' and p_to = 'ARCHIVED')
  ) then
    raise exception 'Transisi status tidak valid: % -> %', p_from, p_to
      using errcode = '22023'; -- invalid_parameter_value
  end if;
end;
$$;

comment on function public.assert_message_transition(text, text) is
  'Raises an exception unless (p_from -> p_to) is one of the 9 edges of the relay-news state machine (adds RELAYING -> FAILED for a failed device relay attempt). Mirrored client-side in src/features/relay-news/status-machine.js for UI gating only — this function is the actual enforcement boundary.';

-- ---------------------------------------------------------------------
-- relay_message: now takes the REAL outcome of a radio-relay adapter
-- call (see src/features/relay-news/relay-service.js), instead of
-- always assuming success.
--
--   p_status = 'SUCCESS'          -> (VERIFIED|FAILED) -> RELAYING -> RELAYED
--   p_status IN ('FAILED','TIMEOUT') -> (VERIFIED|FAILED) -> RELAYING -> FAILED,
--                                       relay_attempts row + message.delay_reason
--                                       record p_error_message
--
-- p_status defaults to 'SUCCESS' so any existing caller that doesn't
-- pass the new parameters keeps behaving exactly as before.
-- Idempotent: if p_idempotency_key was already recorded on a prior
-- relay_attempts row, that row (and the message's current state) is
-- returned as-is rather than inserting a duplicate attempt or
-- re-applying the transition — this is the DB-level safety net behind
-- the adapter layer's own idempotency key (item 7).
-- ---------------------------------------------------------------------
create or replace function public.relay_message(
  p_message_id uuid,
  p_station_id uuid,
  p_response_message text default null,
  p_ip inet default null,
  p_user_agent text default null,
  p_status text default 'SUCCESS',
  p_error_message text default null,
  p_idempotency_key text default null,
  p_correlation_id text default null,
  p_external_reference text default null
)
returns public.maritime_messages
language plpgsql
as $$
declare
  v_row public.maritime_messages;
  v_next_attempt integer;
  v_attempt_id uuid;
  v_from_status text;
  v_existing_attempt public.relay_attempts;
begin
  if not public.has_any_role(array['ADMIN', 'OPERATOR']) then
    raise exception 'Tidak memiliki hak akses untuk melakukan relay.' using errcode = '42501';
  end if;

  if p_status not in ('SUCCESS', 'FAILED', 'TIMEOUT') then
    raise exception 'p_status tidak valid: %', p_status using errcode = '22023';
  end if;

  -- Idempotency: a request already recorded under this key is returned
  -- as-is rather than re-processed.
  if p_idempotency_key is not null then
    select * into v_existing_attempt from public.relay_attempts where idempotency_key = p_idempotency_key;
    if found then
      select * into v_row from public.maritime_messages where id = p_message_id;
      return v_row;
    end if;
  end if;

  select * into v_row from public.maritime_messages where id = p_message_id for update;
  if not found then
    raise exception 'Berita tidak ditemukan.' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.stations where id = p_station_id) then
    raise exception 'Station tujuan tidak ditemukan.' using errcode = 'P0002';
  end if;

  v_from_status := v_row.status;
  perform public.assert_message_transition(v_from_status, 'RELAYING');

  select coalesce(max(attempt_number), 0) + 1 into v_next_attempt
    from public.relay_attempts
    where message_id = p_message_id and station_id = p_station_id;

  insert into public.relay_attempts (
    message_id, station_id, attempt_number, started_at, completed_at,
    status, response_message, error_message, idempotency_key, correlation_id,
    external_reference, created_by
  )
  values (
    p_message_id, p_station_id, v_next_attempt, now(), now(),
    p_status, p_response_message, p_error_message, p_idempotency_key, p_correlation_id,
    p_external_reference, auth.uid()
  )
  returning id into v_attempt_id;

  -- Hop 1: (VERIFIED|FAILED) -> RELAYING (always happens: a relay was attempted).
  update public.maritime_messages set status = 'RELAYING' where id = p_message_id;

  insert into public.activity_logs (actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
  values (auth.uid(), 'RELAY_STARTED', 'maritime_messages', p_message_id,
          jsonb_build_object('from', v_from_status, 'to', 'RELAYING', 'relay_attempt_id', v_attempt_id, 'station_id', p_station_id),
          p_ip, p_user_agent);

  if p_status = 'SUCCESS' then
    perform public.assert_message_transition('RELAYING', 'RELAYED');

    update public.maritime_messages
      set status = 'RELAYED', relayed_at = now()
      where id = p_message_id
      returning * into v_row;

    insert into public.activity_logs (actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
    values (auth.uid(), 'RELAY_COMPLETED', 'maritime_messages', p_message_id,
            jsonb_build_object('from', 'RELAYING', 'to', 'RELAYED', 'relay_attempt_id', v_attempt_id, 'station_id', p_station_id),
            p_ip, p_user_agent);
  else
    -- FAILED or TIMEOUT: RELAYING -> FAILED, record why.
    perform public.assert_message_transition('RELAYING', 'FAILED');

    update public.maritime_messages
      set status = 'FAILED', delay_reason = coalesce(p_error_message, p_status)
      where id = p_message_id
      returning * into v_row;

    insert into public.activity_logs (actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
    values (auth.uid(), 'RELAY_FAILED', 'maritime_messages', p_message_id,
            jsonb_build_object(
              'from', 'RELAYING', 'to', 'FAILED', 'relay_attempt_id', v_attempt_id,
              'station_id', p_station_id, 'status', p_status, 'error_message', p_error_message
            ),
            p_ip, p_user_agent);
  end if;

  return v_row;
end;
$$;

comment on function public.relay_message(uuid, uuid, text, inet, text, text, text, text, text, text) is
  'Records the outcome of an actual radio-relay adapter call (see src/features/relay-news/relay-service.js): on SUCCESS, (VERIFIED|FAILED) -> RELAYING -> RELAYED; on FAILED/TIMEOUT, (VERIFIED|FAILED) -> RELAYING -> FAILED with error_message recorded. Always inserts exactly one relay_attempts row per call (atomically, in the same transaction), unless p_idempotency_key was already recorded, in which case this is a no-op that returns the current state. ADMIN/OPERATOR only.';
