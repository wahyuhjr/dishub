-- =====================================================================
-- Digital Relay Berita Bahaya & Notice To Marine (NTM)
-- Migration: broaden profiles visibility for internal operational views
-- =====================================================================
-- The /relay-news list needs to display and filter by the authoring
-- operator/verifier name for EVERY row any authenticated role can see
-- (messages.view = all 4 roles), e.g. via PostgREST embedded selects
-- like `operator:profiles!operator_id(username, full_name)`. The
-- previous policy (self or ADMIN/MASTER only) silently nulled out that
-- embed for OPERATOR/VIEWER viewers, since embedded-resource reads are
-- themselves subject to RLS on the embedded table.
--
-- This is a small internal team application (one Distrik Navigasi
-- office) — knowing a colleague's name/role/username is normal
-- "internal directory" information, not sensitive PII, so we broaden
-- SELECT to all authenticated users. UPDATE remains unchanged (self or
-- ADMIN only) and DELETE remains ADMIN-only.
-- =====================================================================

drop policy if exists profiles_select_self_or_privileged on public.profiles;
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

comment on policy profiles_select_authenticated on public.profiles is
  'Any authenticated user may view any profile row (internal team directory info — username/full_name/role/etc., never a password). Needed so operator/verifier names are visible on messages any role is otherwise allowed to view. UPDATE/DELETE remain restricted (see profiles_update_self_or_admin, profiles_delete_admin).';
