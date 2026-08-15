-- =====================================================================
-- Digital Relay Berita Bahaya & Notice To Marine (NTM)
-- Migration: reporting support + user-management (avatars bucket,
--            last-admin safety guards, report indexes)
-- =====================================================================
-- This migration adds infrastructure for two modules:
--   1. /dashboard/laporan (reports)  — supporting indexes only; all
--      filtering/aggregation happens through the RLS-scoped server
--      client in src/features/reports/**.
--   2. /dashboard/user (ADMIN user management) — a public avatars
--      Storage bucket, and DB-level safety guards that make it
--      impossible to ever remove/deactivate/demote the LAST active
--      ADMIN, even if the application layer has a bug or is bypassed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Report supporting indexes.
-- The reports module filters maritime_messages by received_at (range),
-- message_type, status, operator_id and either origin/destination
-- station. Most single-column indexes already exist (see
-- 20260814100200); add a composite to speed up the common
-- "date-range + status" report query.
-- ---------------------------------------------------------------------
create index if not exists idx_maritime_messages_status_received_at
  on public.maritime_messages (status, received_at desc);

-- Speed up "relay per station" / station-filtered reports.
create index if not exists idx_maritime_messages_relayed_at
  on public.maritime_messages (relayed_at);

-- ---------------------------------------------------------------------
-- Last-ADMIN safety guards.
--
-- SECURITY / SAFETY (requirement: "Cegah ADMIN menghapus akun ADMIN
-- terakhir"): the application layer (src/features/users/actions.js)
-- checks this before calling the Auth Admin API, but that is a
-- convenience/UX check only. These triggers are the authoritative
-- guarantee — they run inside the same transaction as the mutation and
-- cannot be bypassed by the service_role key, a direct SQL console, or
-- an application bug.
--
-- "Active ADMIN" = profiles.role = 'ADMIN' AND is_active = true.
-- ---------------------------------------------------------------------
create or replace function public.count_other_active_admins(exclude_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.profiles
  where role = 'ADMIN'
    and is_active = true
    and id <> exclude_id;
$$;

comment on function public.count_other_active_admins(uuid) is
  'Number of active ADMIN profiles OTHER than exclude_id. Used by the last-admin guard triggers/actions to prevent removing the final administrator.';

-- Guard against UPDATE that would demote or deactivate the last admin.
create or replace function public.prevent_last_admin_downgrade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only relevant when the row WAS an active admin and is losing that status.
  if old.role = 'ADMIN' and old.is_active = true then
    if (new.role is distinct from 'ADMIN' or new.is_active = false) then
      if public.count_other_active_admins(old.id) = 0 then
        raise exception 'Cannot demote or deactivate the last active ADMIN'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.prevent_last_admin_downgrade() is
  'BEFORE UPDATE guard on profiles: blocks demoting (role change) or deactivating (is_active=false) the final active ADMIN, guaranteeing at least one administrator always remains.';

drop trigger if exists trg_profiles_prevent_last_admin_downgrade on public.profiles;
create trigger trg_profiles_prevent_last_admin_downgrade
  before update on public.profiles
  for each row execute function public.prevent_last_admin_downgrade();

-- Guard against DELETE of the last admin's profile (profiles are deleted
-- only via ON DELETE CASCADE when the underlying auth.users row is
-- removed by the Admin API — this still fires in that transaction).
create or replace function public.prevent_last_admin_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'ADMIN' and old.is_active = true then
    if public.count_other_active_admins(old.id) = 0 then
      raise exception 'Cannot delete the last active ADMIN'
        using errcode = 'check_violation';
    end if;
  end if;
  return old;
end;
$$;

comment on function public.prevent_last_admin_delete() is
  'BEFORE DELETE guard on profiles: blocks removing the final active ADMIN. Fires even when the delete cascades from auth.users via the Supabase Auth Admin API.';

drop trigger if exists trg_profiles_prevent_last_admin_delete on public.profiles;
create trigger trg_profiles_prevent_last_admin_delete
  before delete on public.profiles
  for each row execute function public.prevent_last_admin_delete();

-- ---------------------------------------------------------------------
-- Public "avatars" Storage bucket for user profile photos.
-- Unlike the private "documents" bucket, avatars are low-sensitivity and
-- may be served directly via their public URL (profiles.avatar_url), so
-- this bucket is public-readable. Writes are still restricted to
-- authenticated users, and the application only ever uploads through a
-- server action (src/features/users/actions.js) using the admin client.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists avatars_bucket_select_public on storage.objects;
create policy avatars_bucket_select_public
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

comment on policy avatars_bucket_select_public on storage.objects is
  'Avatars are public-readable (low sensitivity, referenced by profiles.avatar_url). Uploads/updates/deletes are ADMIN-only (see policies below); the app always mediates writes through a server action using the service-role client.';

drop policy if exists avatars_bucket_insert_admin on storage.objects;
create policy avatars_bucket_insert_admin
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and public.has_any_role(array['ADMIN']));

drop policy if exists avatars_bucket_update_admin on storage.objects;
create policy avatars_bucket_update_admin
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and public.has_any_role(array['ADMIN']))
  with check (bucket_id = 'avatars' and public.has_any_role(array['ADMIN']));

drop policy if exists avatars_bucket_delete_admin on storage.objects;
create policy avatars_bucket_delete_admin
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and public.has_any_role(array['ADMIN']));
