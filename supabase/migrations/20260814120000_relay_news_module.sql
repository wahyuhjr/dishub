-- =====================================================================
-- Digital Relay Berita Bahaya & Notice To Marine (NTM)
-- Migration: /relay-news module — state machine RPCs + supporting RLS
-- =====================================================================
-- State machine enforced here (mirrored in
-- src/features/relay-news/status-machine.js for client-side UI gating —
-- that copy is for UX only; THIS migration is the enforcement boundary):
--
--   DRAFT -> PENDING_VERIFICATION -> VERIFIED -> RELAYING -> RELAYED
--   DRAFT -> ARCHIVED
--   VERIFIED -> FAILED
--   FAILED -> RELAYING
--   RELAYED -> ARCHIVED
--
-- Every RPC below is SECURITY INVOKER (the default — deliberately NOT
-- SECURITY DEFINER) so it runs with the CALLING user's own privileges:
-- RLS on maritime_messages/relay_attempts/activity_logs still applies in
-- full, exactly as if the caller had run the statements directly. Each
-- function ALSO re-checks the role explicitly before mutating (defense
-- in depth, consistent with the rest of this app), and raises a clear
-- exception on an invalid transition rather than silently no-op'ing.
--
-- Every RPC performs its table mutation(s) AND its activity_logs insert
-- inside the SAME function call — a single PL/pgSQL function invocation
-- is one atomic transaction in Postgres, which is how "message + relay
-- attempt change together" (and "every status change creates an audit
-- log entry") is made atomic without explicit BEGIN/COMMIT.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Additional RLS policies needed for the relay-news state machine.
-- These are ADDITIVE (permissive, OR'd with the existing
-- maritime_messages_update policy from 20260814100400_rls_policies.sql)
-- — they only ever grant more, never take away what already worked.
-- ---------------------------------------------------------------------

-- Allows ADMIN/OPERATOR to drive a message from VERIFIED or FAILED,
-- through RELAYING, to RELAYED (the relay_message() RPC below performs
-- both hops in one call). MASTER is intentionally NOT included here —
-- performing a relay is an OPERATOR/ADMIN action per the role matrix.
drop policy if exists maritime_messages_relay_transition on public.maritime_messages;
create policy maritime_messages_relay_transition
  on public.maritime_messages for update
  to authenticated
  using (
    status in ('VERIFIED', 'FAILED', 'RELAYING')
    and public.has_any_role(array['ADMIN', 'OPERATOR'])
  )
  with check (status in ('RELAYING', 'RELAYED'));

comment on policy maritime_messages_relay_transition on public.maritime_messages is
  'Lets ADMIN/OPERATOR move a message through VERIFIED|FAILED -> RELAYING -> RELAYED (the two hops performed together by relay_message()).';

-- Allows archiving: ADMIN can archive a DRAFT or RELAYED message;
-- OPERATOR can archive (cancel) their OWN DRAFT; MASTER can archive a
-- RELAYED message (closing out completed records).
drop policy if exists maritime_messages_archive_transition on public.maritime_messages;
create policy maritime_messages_archive_transition
  on public.maritime_messages for update
  to authenticated
  using (
    (status = 'DRAFT' and (public.has_any_role(array['ADMIN']) or operator_id = auth.uid()))
    or
    (status = 'RELAYED' and public.has_any_role(array['ADMIN', 'MASTER']))
  )
  with check (status = 'ARCHIVED');

comment on policy maritime_messages_archive_transition on public.maritime_messages is
  'ADMIN archives any DRAFT/RELAYED message; OPERATOR archives only their own DRAFT; MASTER archives RELAYED (record close-out).';

-- ---------------------------------------------------------------------
-- Shared helper: validate a transition against the state machine above.
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
  'Raises an exception unless (p_from -> p_to) is one of the 8 edges of the relay-news state machine. Mirrored client-side in src/features/relay-news/status-machine.js for UI gating only — this function is the actual enforcement boundary.';

-- ---------------------------------------------------------------------
-- submit_message_for_verification: DRAFT -> PENDING_VERIFICATION
-- ---------------------------------------------------------------------
create or replace function public.submit_message_for_verification(
  p_message_id uuid,
  p_ip inet default null,
  p_user_agent text default null
)
returns public.maritime_messages
language plpgsql
as $$
declare
  v_row public.maritime_messages;
begin
  if not public.has_any_role(array['ADMIN', 'OPERATOR']) then
    raise exception 'Tidak memiliki hak akses untuk mengajukan verifikasi.' using errcode = '42501';
  end if;

  select * into v_row from public.maritime_messages where id = p_message_id for update;
  if not found then
    raise exception 'Berita tidak ditemukan.' using errcode = 'P0002';
  end if;

  perform public.assert_message_transition(v_row.status, 'PENDING_VERIFICATION');

  update public.maritime_messages
    set status = 'PENDING_VERIFICATION'
    where id = p_message_id
    returning * into v_row;

  insert into public.activity_logs (actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
  values (auth.uid(), 'SUBMIT_FOR_VERIFICATION', 'maritime_messages', p_message_id,
          jsonb_build_object('from', 'DRAFT', 'to', 'PENDING_VERIFICATION'), p_ip, p_user_agent);

  return v_row;
end;
$$;

comment on function public.submit_message_for_verification(uuid, inet, text) is
  'DRAFT -> PENDING_VERIFICATION. ADMIN/OPERATOR only; RLS additionally restricts OPERATOR to their own message.';

-- ---------------------------------------------------------------------
-- verify_message: PENDING_VERIFICATION -> VERIFIED
-- ---------------------------------------------------------------------
create or replace function public.verify_message(
  p_message_id uuid,
  p_ip inet default null,
  p_user_agent text default null
)
returns public.maritime_messages
language plpgsql
as $$
declare
  v_row public.maritime_messages;
begin
  if not public.has_any_role(array['ADMIN', 'MASTER']) then
    raise exception 'Hanya MASTER/ADMIN yang dapat memverifikasi berita.' using errcode = '42501';
  end if;

  select * into v_row from public.maritime_messages where id = p_message_id for update;
  if not found then
    raise exception 'Berita tidak ditemukan.' using errcode = 'P0002';
  end if;

  perform public.assert_message_transition(v_row.status, 'VERIFIED');

  update public.maritime_messages
    set status = 'VERIFIED', verifier_id = auth.uid()
    where id = p_message_id
    returning * into v_row;

  insert into public.activity_logs (actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
  values (auth.uid(), 'VERIFY_MESSAGE', 'maritime_messages', p_message_id,
          jsonb_build_object('from', 'PENDING_VERIFICATION', 'to', 'VERIFIED'), p_ip, p_user_agent);

  return v_row;
end;
$$;

comment on function public.verify_message(uuid, inet, text) is
  'PENDING_VERIFICATION -> VERIFIED. MASTER/ADMIN only — an OPERATOR calling this always fails, regardless of UI state, per the explicit role check above (not just RLS).';

-- ---------------------------------------------------------------------
-- mark_message_failed: VERIFIED -> FAILED
-- ---------------------------------------------------------------------
create or replace function public.mark_message_failed(
  p_message_id uuid,
  p_reason text default null,
  p_ip inet default null,
  p_user_agent text default null
)
returns public.maritime_messages
language plpgsql
as $$
declare
  v_row public.maritime_messages;
begin
  if not public.has_any_role(array['ADMIN', 'MASTER']) then
    raise exception 'Hanya MASTER/ADMIN yang dapat menandai berita gagal.' using errcode = '42501';
  end if;

  select * into v_row from public.maritime_messages where id = p_message_id for update;
  if not found then
    raise exception 'Berita tidak ditemukan.' using errcode = 'P0002';
  end if;

  perform public.assert_message_transition(v_row.status, 'FAILED');

  update public.maritime_messages
    set status = 'FAILED', delay_reason = p_reason
    where id = p_message_id
    returning * into v_row;

  insert into public.activity_logs (actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
  values (auth.uid(), 'MARK_MESSAGE_FAILED', 'maritime_messages', p_message_id,
          jsonb_build_object('from', 'VERIFIED', 'to', 'FAILED', 'reason', p_reason), p_ip, p_user_agent);

  return v_row;
end;
$$;

comment on function public.mark_message_failed(uuid, text, inet, text) is
  'VERIFIED -> FAILED. MASTER/ADMIN only. Records an optional reason.';

-- ---------------------------------------------------------------------
-- archive_message: DRAFT -> ARCHIVED, RELAYED -> ARCHIVED
-- ---------------------------------------------------------------------
create or replace function public.archive_message(
  p_message_id uuid,
  p_ip inet default null,
  p_user_agent text default null
)
returns public.maritime_messages
language plpgsql
as $$
declare
  v_row public.maritime_messages;
begin
  select * into v_row from public.maritime_messages where id = p_message_id for update;
  if not found then
    raise exception 'Berita tidak ditemukan.' using errcode = 'P0002';
  end if;

  if v_row.status = 'DRAFT' then
    if not (public.has_any_role(array['ADMIN']) or (public.has_any_role(array['OPERATOR']) and v_row.operator_id = auth.uid())) then
      raise exception 'Tidak memiliki hak akses untuk mengarsipkan draft ini.' using errcode = '42501';
    end if;
  elsif v_row.status = 'RELAYED' then
    if not public.has_any_role(array['ADMIN', 'MASTER']) then
      raise exception 'Hanya MASTER/ADMIN yang dapat mengarsipkan berita yang sudah di-relay.' using errcode = '42501';
    end if;
  end if;

  perform public.assert_message_transition(v_row.status, 'ARCHIVED');

  update public.maritime_messages
    set status = 'ARCHIVED'
    where id = p_message_id
    returning * into v_row;

  insert into public.activity_logs (actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
  values (auth.uid(), 'ARCHIVE_MESSAGE', 'maritime_messages', p_message_id,
          jsonb_build_object('from', v_row.status, 'to', 'ARCHIVED'), p_ip, p_user_agent);

  return v_row;
end;
$$;

comment on function public.archive_message(uuid, inet, text) is
  'DRAFT -> ARCHIVED (own draft for OPERATOR, any for ADMIN) or RELAYED -> ARCHIVED (MASTER/ADMIN).';

-- ---------------------------------------------------------------------
-- relay_message: (VERIFIED | FAILED) -> RELAYING -> RELAYED
-- Creates a relay_attempts row AND updates maritime_messages in the same
-- transaction (this function call). MVP relay is manual/synchronous
-- (see docs/ARCHITECTURE.md "Relay MVP = pencatatan manual saja"): the
-- operator is recording a relay they already performed, so the attempt
-- is logged as SUCCESS and the message moves straight through RELAYING
-- to RELAYED within this one call.
-- ---------------------------------------------------------------------
create or replace function public.relay_message(
  p_message_id uuid,
  p_station_id uuid,
  p_response_message text default null,
  p_ip inet default null,
  p_user_agent text default null
)
returns public.maritime_messages
language plpgsql
as $$
declare
  v_row public.maritime_messages;
  v_next_attempt integer;
  v_attempt_id uuid;
  v_from_status text;
begin
  if not public.has_any_role(array['ADMIN', 'OPERATOR']) then
    raise exception 'Tidak memiliki hak akses untuk melakukan relay.' using errcode = '42501';
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
    status, response_message, created_by
  )
  values (
    p_message_id, p_station_id, v_next_attempt, now(), now(),
    'SUCCESS', p_response_message, auth.uid()
  )
  returning id into v_attempt_id;

  -- Hop 1: (VERIFIED|FAILED) -> RELAYING
  update public.maritime_messages set status = 'RELAYING' where id = p_message_id;

  insert into public.activity_logs (actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
  values (auth.uid(), 'RELAY_STARTED', 'maritime_messages', p_message_id,
          jsonb_build_object('from', v_from_status, 'to', 'RELAYING', 'relay_attempt_id', v_attempt_id, 'station_id', p_station_id),
          p_ip, p_user_agent);

  perform public.assert_message_transition('RELAYING', 'RELAYED');

  -- Hop 2: RELAYING -> RELAYED
  update public.maritime_messages
    set status = 'RELAYED', relayed_at = now()
    where id = p_message_id
    returning * into v_row;

  insert into public.activity_logs (actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
  values (auth.uid(), 'RELAY_COMPLETED', 'maritime_messages', p_message_id,
          jsonb_build_object('from', 'RELAYING', 'to', 'RELAYED', 'relay_attempt_id', v_attempt_id, 'station_id', p_station_id),
          p_ip, p_user_agent);

  return v_row;
end;
$$;

comment on function public.relay_message(uuid, uuid, text, inet, text) is
  'Performs a full relay: inserts a relay_attempts row AND transitions the message (VERIFIED|FAILED) -> RELAYING -> RELAYED, atomically (one function call = one transaction). ADMIN/OPERATOR only.';
