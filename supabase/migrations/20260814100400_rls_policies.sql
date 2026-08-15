-- =====================================================================
-- Digital Relay Berita Bahaya & Notice To Marine (NTM)
-- Migration: Row Level Security for all tables
-- =====================================================================
-- SECURITY MODEL OVERVIEW
--   Roles (public.profiles.role): ADMIN > MASTER > OPERATOR > VIEWER.
--   - ADMIN     : full access to everything (users, stations, messages).
--   - MASTER    : supervises operations (verify/approve, manage stations),
--                 cannot manage other users' roles.
--   - OPERATOR  : creates/updates their own draft messages and relay
--                 attempts; cannot verify/approve their own work.
--   - VIEWER    : read-only, and only sees messages once verified.
--
--   RLS is enabled on every table below (defense in depth). In addition:
--   - `public.ntm_documents` grants unauthenticated (anon) read access to
--     *published* documents only, because NTMs are official public safety
--     notices for mariners.
--   - No table has a DELETE policy: every table is either soft-deleted
--     (is_active) or intentionally append-only (audit/health/relay logs),
--     matching the safety-critical, auditable nature of this application.
--   - Helper functions below are SECURITY DEFINER with a pinned
--     search_path, which is the standard Supabase pattern to look up a
--     caller's role without triggering infinite RLS recursion on
--     public.profiles itself.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

comment on function public.current_profile_role() is
  'Returns the caller''s role from public.profiles. SECURITY DEFINER so this lookup bypasses RLS on profiles, avoiding recursive policy evaluation when used inside other tables'' policies (including profiles'' own policies).';

create or replace function public.has_any_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = any(roles), false);
$$;

comment on function public.has_any_role(text[]) is
  'True if the currently authenticated user''s profile role is one of the given roles. Used throughout RLS policies below instead of repeating a profiles subquery.';

-- =====================================================================
-- profiles
-- =====================================================================
alter table public.profiles enable row level security;

drop policy if exists profiles_select_self_or_privileged on public.profiles;
create policy profiles_select_self_or_privileged
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.has_any_role(array['ADMIN', 'MASTER'])
  );

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.has_any_role(array['ADMIN']))
  with check (id = auth.uid() or public.has_any_role(array['ADMIN']));

comment on policy profiles_update_self_or_admin on public.profiles is
  'Row-level: a user may update their own row, or ADMIN may update any row. Column-level protection (role/is_active only changeable by ADMIN) is enforced separately by trigger trg_profiles_guard_privilege, since RLS cannot restrict individual columns.';

-- No INSERT policy: profiles are only created by the SECURITY DEFINER
-- trigger public.handle_new_user(), which bypasses RLS by design.
-- No DELETE policy: profiles are soft-deactivated via is_active, never removed,
-- to preserve FK history (verifier_id/operator_id/created_by references).

-- =====================================================================
-- stations
-- =====================================================================
alter table public.stations enable row level security;

drop policy if exists stations_select_authenticated on public.stations;
create policy stations_select_authenticated
  on public.stations for select
  to authenticated
  using (true);

comment on policy stations_select_authenticated on public.stations is
  'All authenticated internal roles may view stations. This is safe even though connection_config is on the same row, because connection_config must only ever contain non-secret metadata (see column comment); real credentials live in Supabase Vault referenced by secret_id.';

drop policy if exists stations_insert_admin_master on public.stations;
create policy stations_insert_admin_master
  on public.stations for insert
  to authenticated
  with check (public.has_any_role(array['ADMIN', 'MASTER']));

drop policy if exists stations_update_admin_master on public.stations;
create policy stations_update_admin_master
  on public.stations for update
  to authenticated
  using (public.has_any_role(array['ADMIN', 'MASTER']))
  with check (public.has_any_role(array['ADMIN', 'MASTER']));

-- No DELETE policy: stations are deactivated via is_active, never removed,
-- to preserve referential history in maritime_messages/relay_attempts.

-- =====================================================================
-- maritime_messages
-- =====================================================================
alter table public.maritime_messages enable row level security;

drop policy if exists maritime_messages_select on public.maritime_messages;
create policy maritime_messages_select
  on public.maritime_messages for select
  to authenticated
  using (
    status not in ('DRAFT', 'PENDING_VERIFICATION')
    or operator_id = auth.uid()
    or verifier_id = auth.uid()
    or public.has_any_role(array['ADMIN', 'MASTER'])
  );

comment on policy maritime_messages_select on public.maritime_messages is
  'DRAFT/PENDING_VERIFICATION rows are only visible to their author, an assigned verifier, or ADMIN/MASTER; all other statuses (VERIFIED and beyond) are visible to every authenticated role, including VIEWER.';

drop policy if exists maritime_messages_insert on public.maritime_messages;
create policy maritime_messages_insert
  on public.maritime_messages for insert
  to authenticated
  with check (
    public.has_any_role(array['ADMIN', 'MASTER', 'OPERATOR'])
    and operator_id = auth.uid()
  );

drop policy if exists maritime_messages_update on public.maritime_messages;
create policy maritime_messages_update
  on public.maritime_messages for update
  to authenticated
  using (
    public.has_any_role(array['ADMIN', 'MASTER'])
    or (operator_id = auth.uid() and status in ('DRAFT', 'PENDING_VERIFICATION'))
  )
  with check (
    public.has_any_role(array['ADMIN', 'MASTER'])
    or (operator_id = auth.uid() and status in ('DRAFT', 'PENDING_VERIFICATION'))
  );

comment on policy maritime_messages_update on public.maritime_messages is
  'OPERATOR may only edit their own message while it is still in DRAFT/PENDING_VERIFICATION (before verification); verification/approval/relay-state transitions are reserved for ADMIN/MASTER.';

-- No DELETE policy: messages are archived (status = ARCHIVED), never removed,
-- to preserve the safety-critical audit trail.

-- =====================================================================
-- relay_attempts
-- =====================================================================
alter table public.relay_attempts enable row level security;

drop policy if exists relay_attempts_select on public.relay_attempts;
create policy relay_attempts_select
  on public.relay_attempts for select
  to authenticated
  using (true);

drop policy if exists relay_attempts_insert on public.relay_attempts;
create policy relay_attempts_insert
  on public.relay_attempts for insert
  to authenticated
  with check (
    public.has_any_role(array['ADMIN', 'MASTER', 'OPERATOR'])
    and created_by = auth.uid()
  );

drop policy if exists relay_attempts_update on public.relay_attempts;
create policy relay_attempts_update
  on public.relay_attempts for update
  to authenticated
  using (public.has_any_role(array['ADMIN', 'MASTER']) or created_by = auth.uid())
  with check (public.has_any_role(array['ADMIN', 'MASTER']) or created_by = auth.uid());

-- No DELETE policy: relay attempts are an immutable attempt log.

-- =====================================================================
-- ntm_documents
-- =====================================================================
alter table public.ntm_documents enable row level security;

drop policy if exists ntm_documents_select_public on public.ntm_documents;
create policy ntm_documents_select_public
  on public.ntm_documents for select
  to anon, authenticated
  using (published_at is not null and archived_at is null);

comment on policy ntm_documents_select_public on public.ntm_documents is
  'NTM documents are official public safety notices for mariners: once published and not archived, ANYONE (including unauthenticated/anon clients) may read the metadata row. Combined with an internal-only policy below via OR (Postgres RLS policies for the same command are permissive/OR''d together).';

drop policy if exists ntm_documents_select_internal on public.ntm_documents;
create policy ntm_documents_select_internal
  on public.ntm_documents for select
  to authenticated
  using (created_by = auth.uid() or public.has_any_role(array['ADMIN', 'MASTER']));

drop policy if exists ntm_documents_insert on public.ntm_documents;
create policy ntm_documents_insert
  on public.ntm_documents for insert
  to authenticated
  with check (
    public.has_any_role(array['ADMIN', 'MASTER', 'OPERATOR'])
    and created_by = auth.uid()
  );

drop policy if exists ntm_documents_update on public.ntm_documents;
create policy ntm_documents_update
  on public.ntm_documents for update
  to authenticated
  using (public.has_any_role(array['ADMIN', 'MASTER']))
  with check (public.has_any_role(array['ADMIN', 'MASTER']));

comment on policy ntm_documents_update on public.ntm_documents is
  'Only ADMIN/MASTER may publish/archive an NTM document (set published_at/archived_at); OPERATOR may only create draft entries (see insert policy).';

-- No DELETE policy: published safety documents are archived, never removed.

-- =====================================================================
-- system_health_checks
-- =====================================================================
alter table public.system_health_checks enable row level security;

drop policy if exists system_health_checks_select on public.system_health_checks;
create policy system_health_checks_select
  on public.system_health_checks for select
  to authenticated
  using (true);

drop policy if exists system_health_checks_insert on public.system_health_checks;
create policy system_health_checks_insert
  on public.system_health_checks for insert
  to authenticated
  with check (public.has_any_role(array['ADMIN', 'MASTER', 'OPERATOR']));

comment on policy system_health_checks_insert on public.system_health_checks is
  'Automated monitoring agents are expected to use the service_role key (which bypasses RLS entirely) rather than an interactive user session; this policy only covers manual/interactive inserts by internal roles.';

-- No UPDATE/DELETE policy: health checks are an append-only monitoring log.

-- =====================================================================
-- activity_logs
-- =====================================================================
alter table public.activity_logs enable row level security;

drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select
  on public.activity_logs for select
  to authenticated
  using (actor_id = auth.uid() or public.has_any_role(array['ADMIN', 'MASTER']));

drop policy if exists activity_logs_insert on public.activity_logs;
create policy activity_logs_insert
  on public.activity_logs for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    or (actor_id is null and public.has_any_role(array['ADMIN', 'MASTER']))
  );

comment on policy activity_logs_insert on public.activity_logs is
  'A user may only log actions attributed to themselves (actor_id = auth.uid()), preventing spoofed entries; system-attributed rows (actor_id NULL) require ADMIN/MASTER.';

-- No UPDATE/DELETE policy anywhere on activity_logs: the audit trail is strictly append-only.
