-- =====================================================================
-- Digital Relay Berita Bahaya & Notice To Marine (NTM)
-- Migration: system_health_checks, activity_logs
-- =====================================================================

-- ---------------------------------------------------------------------
-- Table: system_health_checks
-- Point-in-time health probe results. Append-only monitoring log.
-- ---------------------------------------------------------------------
create table if not exists public.system_health_checks (
  id uuid primary key default gen_random_uuid(),
  component_name text not null
    check (component_name in ('SERVER', 'DATABASE', 'INTERNET', 'RADIO_MF_HF', 'RADIO_DSC', 'AIS', 'VTS')),
  status text not null default 'UNKNOWN'
    check (status in ('ONLINE', 'OFFLINE', 'DEGRADED', 'UNKNOWN')),
  latency_ms integer check (latency_ms >= 0),
  checked_at timestamptz not null default now(),
  error_message text
);

comment on table public.system_health_checks is
  'Point-in-time health probe results for system components (server, database, connectivity, radio/AIS/VTS links). Append-only: no UPDATE/DELETE policy exists for any role.';

create index if not exists idx_system_health_checks_component_checked_at
  on public.system_health_checks (component_name, checked_at desc);
create index if not exists idx_system_health_checks_status on public.system_health_checks (status);

-- ---------------------------------------------------------------------
-- Table: activity_logs
-- Immutable audit trail of user/system actions.
-- ---------------------------------------------------------------------
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.activity_logs is
  'Immutable audit trail of user/system actions across the application. No UPDATE/DELETE policies exist for any role — rows are strictly append-only for auditability.';
comment on column public.activity_logs.actor_id is
  'NULL means a system-initiated action (no human actor); inserting a NULL actor_id is restricted to ADMIN/MASTER via RLS to prevent regular users from forging "system" log entries.';

create index if not exists idx_activity_logs_actor_id on public.activity_logs (actor_id);
create index if not exists idx_activity_logs_entity on public.activity_logs (entity_type, entity_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs (created_at desc);
