-- =====================================================================
-- Digital Relay Berita Bahaya & Notice To Marine (NTM)
-- Migration: /monitoring module support — per-station health checks +
-- Supabase Realtime on system_health_checks
-- =====================================================================

-- Optional link to a specific station (for "status setiap station",
-- distinct from the 7 fixed component_name categories which represent
-- one check per device TYPE, not per physical station instance).
alter table public.system_health_checks
  add column if not exists station_id uuid references public.stations (id) on delete set null;

comment on column public.system_health_checks.station_id is
  'Set when this row is a per-station device check (see src/lib/health/**); NULL for the app-level SERVER/DATABASE/INTERNET checks and the aggregate RADIO_MF_HF/RADIO_DSC/AIS/VTS category checks.';

create index if not exists idx_system_health_checks_station_id on public.system_health_checks (station_id);

-- Latest health check per STATION (as opposed to v_system_health_latest,
-- which is latest per component_name CATEGORY) — supports multiple
-- stations sharing the same station_type.
create or replace view public.v_station_health_latest as
select distinct on (station_id)
  station_id,
  component_name,
  status,
  latency_ms,
  checked_at,
  error_message
from public.system_health_checks
where station_id is not null
order by station_id, checked_at desc;

comment on view public.v_station_health_latest is
  'Latest health check row per station_id, for the /monitoring per-station table.';

grant select on public.v_station_health_latest to authenticated;

-- ---------------------------------------------------------------------
-- Supabase Realtime: broadcast INSERTs on system_health_checks so
-- /dashboard/monitoring can update live without polling alone (item 11:
-- "Gunakan Supabase Realtime untuk memperbarui status di dashboard").
-- Idempotent guard since re-adding an already-published table errors.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'system_health_checks'
  ) then
    alter publication supabase_realtime add table public.system_health_checks;
  end if;
end $$;
