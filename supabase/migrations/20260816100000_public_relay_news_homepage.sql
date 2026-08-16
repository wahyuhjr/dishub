-- Public (anonymous) read access to maritime_messages for the new public
-- homepage ("/") and its detail page ("/berita/[id]") — see src/app/page.js
-- and src/app/berita/[id]/page.js.
--
-- Mirrors the existing authenticated-visibility rule (DRAFT and
-- PENDING_VERIFICATION stay internal-only) but grants it to the `anon`
-- role too, since these two statuses are unverified/unpublished and must
-- never be exposed to unauthenticated visitors.
drop policy if exists maritime_messages_select_public on public.maritime_messages;
create policy maritime_messages_select_public
  on public.maritime_messages for select
  to anon
  using (status not in ('DRAFT', 'PENDING_VERIFICATION'));

comment on policy maritime_messages_select_public on public.maritime_messages is
  'Public homepage/detail page: anonymous visitors may read any message that has left DRAFT/PENDING_VERIFICATION (i.e. VERIFIED and beyond) — same status boundary already used for authenticated VIEWER access.';
