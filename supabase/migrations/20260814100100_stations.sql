-- =====================================================================
-- Digital Relay Berita Bahaya & Notice To Marine (NTM)
-- Migration: stations (radio/AIS/VTS communication & monitoring nodes)
-- =====================================================================

create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  station_code text not null unique,
  station_name text not null,
  station_type text not null
    check (station_type in ('SROP', 'RADIO_MF_HF', 'RADIO_DSC', 'AIS', 'VTS')),
  location text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  connection_config jsonb not null default '{}'::jsonb,
  secret_id uuid,
  is_active boolean not null default true,
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.stations is
  'Communication/monitoring stations (coast radio, AIS, VTS, etc.) used to relay and receive maritime messages.';
comment on column public.stations.connection_config is
  'SECURITY: non-secret connection metadata only (host, port, protocol, channel/frequency). NEVER store API keys, passwords, or tokens in this jsonb column.';
comment on column public.stations.secret_id is
  'SECURITY: opaque reference to a secret stored in Supabase Vault (vault.secrets.id) holding the actual connection credential, if any. Intentionally has no FK to vault.secrets so this migration stays portable across projects where Vault may not be enabled; the application/service layer resolves it via the Vault API using the service_role key, never the client.';

drop trigger if exists trg_stations_set_updated_at on public.stations;
create trigger trg_stations_set_updated_at
  before update on public.stations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Seed: a handful of dummy stations covering every station_type, for
-- local development and demos. Idempotent via ON CONFLICT.
-- ---------------------------------------------------------------------
insert into public.stations
  (station_code, station_name, station_type, location, latitude, longitude, is_active)
values
  ('MRK-SROP-01', 'SROP Merauke', 'SROP', 'Kantor Distrik Navigasi Merauke', -8.499200, 140.401700, true),
  ('MRK-HF-01', 'Radio MF/HF Merauke', 'RADIO_MF_HF', 'Stasiun Radio Pantai Merauke', -8.499500, 140.402100, true),
  ('MRK-DSC-01', 'Radio DSC Merauke', 'RADIO_DSC', 'Stasiun Radio Pantai Merauke', -8.499500, 140.402100, true),
  ('MRK-AIS-01', 'AIS Base Station Merauke', 'AIS', 'Menara AIS Merauke', -8.498800, 140.403300, true),
  ('MRK-VTS-01', 'VTS Merauke', 'VTS', 'Pusat VTS Merauke', -8.500100, 140.400900, false)
on conflict (station_code) do nothing;
