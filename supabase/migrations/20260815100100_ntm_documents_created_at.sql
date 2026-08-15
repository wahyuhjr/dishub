-- =====================================================================
-- Digital Relay Berita Bahaya & Notice To Marine (NTM)
-- Migration: add missing created_at to ntm_documents
-- =====================================================================
-- ntm_documents was originally created without created_at (unlike every
-- other table in this schema) — the /ntm module's list page orders by
-- it, so add it now.

alter table public.ntm_documents
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_ntm_documents_created_at on public.ntm_documents (created_at desc);
