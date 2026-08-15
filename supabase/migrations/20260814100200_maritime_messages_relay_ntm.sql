-- =====================================================================
-- Digital Relay Berita Bahaya & Notice To Marine (NTM)
-- Migration: maritime_messages, relay_attempts, ntm_documents
-- =====================================================================

-- ---------------------------------------------------------------------
-- Table: maritime_messages
-- Danger messages / distress-urgency-safety traffic / NTM items, tracked
-- through their verification and relay workflow.
-- ---------------------------------------------------------------------
create table if not exists public.maritime_messages (
  id uuid primary key default gen_random_uuid(),
  message_number text not null unique,
  message_type text not null
    check (message_type in ('DISTRESS', 'URGENCY', 'SAFETY', 'NTM')),
  title text not null,
  received_at timestamptz not null default now(),
  scheduled_at timestamptz,
  relayed_at timestamptz,
  origin_station_id uuid references public.stations (id) on delete set null,
  destination_station_id uuid references public.stations (id) on delete set null,
  content text not null,
  location_description text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  sender_name text,
  verifier_id uuid references public.profiles (id) on delete set null,
  operator_id uuid references public.profiles (id) on delete set null,
  status text not null default 'DRAFT'
    check (status in (
      'DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'RELAYING',
      'RELAYED', 'FAILED', 'DELAYED', 'ARCHIVED'
    )),
  priority text not null default 'NORMAL'
    check (priority in ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  delay_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_maritime_messages_delay_reason
    check (status <> 'DELAYED' or delay_reason is not null)
);

comment on table public.maritime_messages is
  'Danger messages, distress/urgency/safety traffic, and Notice to Marine (NTM) items, tracked through their verification and relay workflow. No physical DELETE is supported: messages are archived (status = ARCHIVED) to preserve the safety-critical audit trail.';
comment on column public.maritime_messages.status is
  'Workflow: DRAFT -> PENDING_VERIFICATION -> VERIFIED -> RELAYING -> RELAYED (or FAILED/DELAYED); ARCHIVED is terminal.';
comment on column public.maritime_messages.delay_reason is
  'Required whenever status = DELAYED (enforced by chk_maritime_messages_delay_reason).';

create index if not exists idx_maritime_messages_message_type on public.maritime_messages (message_type);
create index if not exists idx_maritime_messages_status on public.maritime_messages (status);
create index if not exists idx_maritime_messages_received_at on public.maritime_messages (received_at);
create index if not exists idx_maritime_messages_operator_id on public.maritime_messages (operator_id);
-- Supporting indexes for FK columns used in joins/dashboards.
create index if not exists idx_maritime_messages_verifier_id on public.maritime_messages (verifier_id);
create index if not exists idx_maritime_messages_origin_station_id on public.maritime_messages (origin_station_id);
create index if not exists idx_maritime_messages_destination_station_id on public.maritime_messages (destination_station_id);
-- message_number already has a unique index created implicitly by the UNIQUE constraint above.

drop trigger if exists trg_maritime_messages_set_updated_at on public.maritime_messages;
create trigger trg_maritime_messages_set_updated_at
  before update on public.maritime_messages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Table: relay_attempts
-- Individual relay attempts of a message to a specific station.
-- ---------------------------------------------------------------------
create table if not exists public.relay_attempts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.maritime_messages (id) on delete cascade,
  station_id uuid not null references public.stations (id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT')),
  response_message text,
  external_reference text,
  created_by uuid references public.profiles (id) on delete set null,
  unique (message_id, station_id, attempt_number)
);

comment on table public.relay_attempts is
  'Immutable log of individual relay attempts of a maritime_messages row to a specific station, including outcome and any external system reference. No UPDATE/DELETE beyond marking completion is intended for this audit-relevant log.';

create index if not exists idx_relay_attempts_message_id on public.relay_attempts (message_id);
create index if not exists idx_relay_attempts_station_id on public.relay_attempts (station_id);
create index if not exists idx_relay_attempts_status on public.relay_attempts (status);
create index if not exists idx_relay_attempts_created_by on public.relay_attempts (created_by);

-- ---------------------------------------------------------------------
-- Table: ntm_documents
-- Published/archived Notice to Marine documents (files live in Supabase
-- Storage; this table only stores metadata + the storage object path).
-- ---------------------------------------------------------------------
create table if not exists public.ntm_documents (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.maritime_messages (id) on delete set null,
  ntm_number text not null,
  edition text,
  document_type text not null default 'PERMANENT'
    check (document_type in ('PERMANENT', 'TEMPORARY', 'PRELIMINARY', 'AMENDMENT', 'CANCELLATION')),
  file_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint check (file_size >= 0),
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  unique (ntm_number, edition)
);

comment on table public.ntm_documents is
  'Notice to Marine (NTM) documents. Once published (published_at set, archived_at null) a document is intentionally public-readable (see RLS) since NTMs are official safety notices for mariners.';
comment on column public.ntm_documents.file_path is
  'Path/key of the object inside Supabase Storage — not the file bytes. Storage bucket policies must independently restrict who can read/write the underlying object; this table only governs metadata visibility.';

create index if not exists idx_ntm_documents_message_id on public.ntm_documents (message_id);
create index if not exists idx_ntm_documents_ntm_number on public.ntm_documents (ntm_number);
create index if not exists idx_ntm_documents_created_by on public.ntm_documents (created_by);
create index if not exists idx_ntm_documents_published_at on public.ntm_documents (published_at);
