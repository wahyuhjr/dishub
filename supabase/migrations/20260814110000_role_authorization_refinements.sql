-- =====================================================================
-- Digital Relay Berita Bahaya & Notice To Marine (NTM)
-- Migration: role-based authorization refinements
-- =====================================================================
-- Role matrix being enforced from this point on:
--   ADMIN    : full access to everything, including user & station
--              management (only role that can hard-delete anything).
--   MASTER   : verifies/rejects messages, publishes/archives NTM,
--              views reports and monitoring. Does NOT author new
--              messages, does NOT manage stations/users, and has no
--              delete rights.
--   OPERATOR : creates messages/drafts, performs relay attempts, views
--              their own operational history. Cannot verify their own
--              work, cannot publish NTM, cannot manage stations/users.
--   VIEWER   : strictly read-only across dashboard, monitoring,
--              messages, and reports. No mutation of any kind.
--
-- This migration only ADDS/REDEFINES policies and functions (idempotent,
-- via CREATE OR REPLACE / DROP POLICY IF EXISTS + CREATE POLICY). It does
-- not rewrite the earlier migration file — Postgres resolves a policy by
-- its name, so redefining the same-named policy here supersedes the
-- version created in 20260814100400_rls_policies.sql once both
-- migrations have been applied, in order.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Canonical role helper: get_current_user_role()
-- ---------------------------------------------------------------------
create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

comment on function public.get_current_user_role() is
  'Canonical helper returning the CALLER''s role, read from public.profiles keyed by auth.uid(). Never derived from request body/query parameters or any client-supplied value. SECURITY DEFINER + pinned search_path so this lookup bypasses RLS on profiles without causing recursive policy evaluation.';

-- Kept for backward compatibility with the earlier migration/functions
-- that reference current_profile_role(); both now delegate to the
-- canonical get_current_user_role().
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.get_current_user_role();
$$;

comment on function public.current_profile_role() is
  'Deprecated alias for public.get_current_user_role(); retained so existing policies/functions keep working unchanged.';

create or replace function public.has_any_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_current_user_role() = any(roles), false);
$$;

-- =====================================================================
-- stations — configuration is an ADMIN-only responsibility
-- =====================================================================
drop policy if exists stations_insert_admin_master on public.stations;
drop policy if exists stations_update_admin_master on public.stations;

drop policy if exists stations_insert_admin on public.stations;
create policy stations_insert_admin
  on public.stations for insert
  to authenticated
  with check (public.has_any_role(array['ADMIN']));

drop policy if exists stations_update_admin on public.stations;
create policy stations_update_admin
  on public.stations for update
  to authenticated
  using (public.has_any_role(array['ADMIN']))
  with check (public.has_any_role(array['ADMIN']));

drop policy if exists stations_delete_admin on public.stations;
create policy stations_delete_admin
  on public.stations for delete
  to authenticated
  using (public.has_any_role(array['ADMIN']));

comment on policy stations_delete_admin on public.stations is
  'Hard delete of a station is an exceptional ADMIN-only capability; prefer deactivating via is_active to preserve referential history in maritime_messages/relay_attempts.';

-- =====================================================================
-- maritime_messages — authoring is ADMIN/OPERATOR; MASTER verifies only
-- =====================================================================
drop policy if exists maritime_messages_insert on public.maritime_messages;
create policy maritime_messages_insert
  on public.maritime_messages for insert
  to authenticated
  with check (
    public.has_any_role(array['ADMIN', 'OPERATOR'])
    and operator_id = auth.uid()
  );

comment on policy maritime_messages_insert on public.maritime_messages is
  'Only ADMIN/OPERATOR author new messages. MASTER supervises/verifies existing messages (see maritime_messages_update) but does not create them.';

-- maritime_messages_update is unchanged: ADMIN/MASTER may update any row
-- (verification/workflow transitions); OPERATOR may only edit their own
-- row while it is still DRAFT/PENDING_VERIFICATION.

drop policy if exists maritime_messages_delete_admin on public.maritime_messages;
create policy maritime_messages_delete_admin
  on public.maritime_messages for delete
  to authenticated
  using (public.has_any_role(array['ADMIN']));

comment on policy maritime_messages_delete_admin on public.maritime_messages is
  'Hard delete is an exceptional ADMIN-only capability (e.g. correcting erroneous test data). The normal lifecycle for every other role is status = ARCHIVED, never a physical delete.';

-- =====================================================================
-- relay_attempts — relay is performed by ADMIN/OPERATOR (MASTER only views)
-- =====================================================================
drop policy if exists relay_attempts_insert on public.relay_attempts;
create policy relay_attempts_insert
  on public.relay_attempts for insert
  to authenticated
  with check (
    public.has_any_role(array['ADMIN', 'OPERATOR'])
    and created_by = auth.uid()
  );

drop policy if exists relay_attempts_update on public.relay_attempts;
create policy relay_attempts_update
  on public.relay_attempts for update
  to authenticated
  using (public.has_any_role(array['ADMIN']) or created_by = auth.uid())
  with check (public.has_any_role(array['ADMIN']) or created_by = auth.uid());

comment on policy relay_attempts_update on public.relay_attempts is
  'Only the OPERATOR who created a relay attempt (or ADMIN) may update it, e.g. to mark completion/outcome. MASTER has read-only (monitoring/reporting) access to relay_attempts.';

drop policy if exists relay_attempts_delete_admin on public.relay_attempts;
create policy relay_attempts_delete_admin
  on public.relay_attempts for delete
  to authenticated
  using (public.has_any_role(array['ADMIN']));

-- =====================================================================
-- ntm_documents — publishing NTM is ADMIN/MASTER only
-- =====================================================================
drop policy if exists ntm_documents_insert on public.ntm_documents;
create policy ntm_documents_insert
  on public.ntm_documents for insert
  to authenticated
  with check (
    public.has_any_role(array['ADMIN', 'MASTER'])
    and created_by = auth.uid()
  );

comment on policy ntm_documents_insert on public.ntm_documents is
  'Only ADMIN/MASTER author NTM documents — publishing NTM is a MASTER responsibility per the role matrix; OPERATOR no longer has draft-insert rights here.';

-- ntm_documents_update is unchanged: ADMIN/MASTER may publish/archive.

drop policy if exists ntm_documents_delete_admin on public.ntm_documents;
create policy ntm_documents_delete_admin
  on public.ntm_documents for delete
  to authenticated
  using (public.has_any_role(array['ADMIN']));

-- =====================================================================
-- system_health_checks — manual logging is ADMIN-only
-- =====================================================================
drop policy if exists system_health_checks_insert on public.system_health_checks;
create policy system_health_checks_insert
  on public.system_health_checks for insert
  to authenticated
  with check (public.has_any_role(array['ADMIN']));

comment on policy system_health_checks_insert on public.system_health_checks is
  'Manual health-check inserts are ADMIN-only. Automated monitoring agents should use the service_role key (bypasses RLS) rather than an interactive user session — see src/lib/supabase/admin.js.';

drop policy if exists system_health_checks_delete_admin on public.system_health_checks;
create policy system_health_checks_delete_admin
  on public.system_health_checks for delete
  to authenticated
  using (public.has_any_role(array['ADMIN']));

-- =====================================================================
-- profiles — ADMIN-only hard delete (rarely used; auth.users cascade
-- already removes the profile automatically when the underlying auth
-- user is deleted via the Auth Admin API)
-- =====================================================================
drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin
  on public.profiles for delete
  to authenticated
  using (public.has_any_role(array['ADMIN']));

comment on policy profiles_delete_admin on public.profiles is
  'ADMIN-only. Deleting the auth.users row (Auth Admin API) already cascades to profiles; this policy only covers the unusual case of removing a profile row directly.';

-- =====================================================================
-- activity_logs — DELIBERATELY has NO delete policy for ANY role
-- =====================================================================
-- SECURITY: the audit trail must remain append-only/tamper-proof, even
-- for ADMIN, otherwise "ADMIN can delete their own audit trail" becomes
-- a compliance and forensic-integrity risk. If retention/purging is ever
-- required, do it out-of-band with the service_role key (bypasses RLS)
-- via a scheduled job — never through a client-facing RLS policy.
comment on table public.activity_logs is
  'Immutable audit trail of user/system actions across the application. No UPDATE/DELETE policy exists for ANY role, including ADMIN, by design (see 20260814110000_role_authorization_refinements.sql).';
