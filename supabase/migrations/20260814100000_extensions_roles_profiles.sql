-- =====================================================================
-- Digital Relay Berita Bahaya & Notice To Marine (NTM)
-- Migration: extensions, reference roles, and user profiles
-- =====================================================================
-- SECURITY NOTE (applies to this entire schema):
--   Passwords / authentication secrets are NEVER stored in public.profiles
--   or in any other custom table created by these migrations. Credentials
--   are managed exclusively by Supabase Auth (schema `auth`, table
--   `auth.users`), which stores salted/hashed passwords internally and is
--   not exposed to application code. `public.profiles` only stores
--   non-secret profile metadata, linked 1:1 to `auth.users(id)`.
--
--   All SECURITY DEFINER functions below explicitly pin `search_path` to
--   `public` to avoid search_path hijacking, a common privilege-escalation
--   vector for definer functions.
-- =====================================================================

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Reference table: roles
-- Descriptive/lookup table listing the four application roles (used by
-- the app UI for labels/descriptions, e.g. role pickers). This table is
-- intentionally NOT foreign-keyed from profiles.role: the single source
-- of truth for *valid* role values is the CHECK constraint on
-- public.profiles.role below, keeping validation self-contained.
-- ---------------------------------------------------------------------
create table if not exists public.roles (
  code text primary key,
  display_name text not null,
  description text,
  created_at timestamptz not null default now()
);

comment on table public.roles is
  'Reference/lookup table describing the application roles (labels + descriptions for UI). Not FK-enforced from profiles.role; see the CHECK constraint on profiles.role for the authoritative allow-list.';

insert into public.roles (code, display_name, description)
values
  ('ADMIN', 'Administrator', 'Full system access: manage users, stations, master data, and security settings.'),
  ('MASTER', 'Master Operator', 'Supervises operations: verifies/approves danger messages and NTM, manages stations.'),
  ('OPERATOR', 'Operator', 'Front-line staff: creates and relays messages, records relay attempts.'),
  ('VIEWER', 'Viewer', 'Read-only access to monitoring dashboards and reports.')
on conflict (code) do update
  set display_name = excluded.display_name,
      description = excluded.description;

-- ---------------------------------------------------------------------
-- Table: profiles
-- 1:1 extension of auth.users. Never stores credentials.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text,
  email text unique,
  phone text,
  avatar_url text,
  role text not null default 'VIEWER'
    check (role in ('ADMIN', 'MASTER', 'OPERATOR', 'VIEWER')),
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile for each Supabase Auth user (1:1 with auth.users). Never stores passwords or any authentication secret.';
comment on column public.profiles.role is
  'Application role, validated by CHECK constraint (ADMIN, MASTER, OPERATOR, VIEWER). Only ADMIN may change role/is_active on any profile, including their own — enforced by trigger trg_profiles_guard_privilege, not by RLS alone, since RLS is row-level and cannot restrict individual columns.';
comment on column public.profiles.username is
  'Unique handle, auto-generated on signup by public.handle_new_user() from email/metadata and de-duplicated if needed.';

-- ---------------------------------------------------------------------
-- Shared trigger function: keep updated_at current on every UPDATE.
-- Reused by profiles, stations, and maritime_messages.
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger function that stamps updated_at = now() on every row update.';

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Security guard: prevent privilege escalation via profile self-service.
-- RLS (see later migration) allows a user to UPDATE their own profile
-- row, but RLS cannot restrict which *columns* are changed. This trigger
-- adds that column-level protection: only ADMIN may change role/is_active
-- on any row, and non-admins may only ever touch their own row.
-- ---------------------------------------------------------------------
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_role text;
begin
  -- No JWT/session context (e.g. server-side migration or service_role job): allow.
  if auth.uid() is null then
    return new;
  end if;

  select role into acting_role from public.profiles where id = auth.uid();

  if acting_role = 'ADMIN' then
    return new;
  end if;

  if new.id <> auth.uid() then
    raise exception 'Not authorized to modify another user''s profile';
  end if;

  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    raise exception 'Only an ADMIN may change role or is_active on a profile';
  end if;

  return new;
end;
$$;

comment on function public.prevent_profile_privilege_escalation() is
  'Column-level guard complementing RLS: blocks privilege escalation (role/is_active changes) by anyone other than ADMIN, and blocks cross-user edits outright.';

drop trigger if exists trg_profiles_guard_privilege on public.profiles;
create trigger trg_profiles_guard_privilege
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

-- ---------------------------------------------------------------------
-- Trigger: auto-provision a profile row whenever a new auth.users row
-- is created (e.g. on sign-up). Runs as SECURITY DEFINER because the
-- auth.users insert happens outside of any authenticated session.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate_username text;
  attempt int := 0;
  requested_role text;
begin
  base_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, 'user'), '@', 1)),
    '[^a-z0-9_]', '_', 'g'
  ));

  if base_username is null or length(trim(base_username)) = 0 then
    base_username := 'user';
  end if;

  candidate_username := base_username;

  loop
    exit when not exists (select 1 from public.profiles p where p.username = candidate_username);
    attempt := attempt + 1;
    candidate_username := base_username || '_' || attempt::text;
  end loop;

  -- Never trust a client-supplied role beyond this fixed allow-list.
  requested_role := upper(coalesce(new.raw_user_meta_data ->> 'role', 'VIEWER'));
  if requested_role not in ('ADMIN', 'MASTER', 'OPERATOR', 'VIEWER') then
    requested_role := 'VIEWER';
  end if;

  insert into public.profiles (id, username, full_name, email, role, is_active)
  values (
    new.id,
    candidate_username,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    requested_role,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Auto-provisions a public.profiles row for every new auth.users row (sign-up). SECURITY DEFINER so it can insert into profiles despite RLS (profiles has no client-facing INSERT policy).';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
