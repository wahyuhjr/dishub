-- Allow free-form text for maritime_messages.latitude/longitude instead of
-- strict numeric(9,6) with a -90..90 / -180..180 check constraint.
-- Operators need to record coordinates in whatever notation they receive
-- them (decimal degrees, DMS, etc.) — see /dashboard/relay-news form.
alter table public.maritime_messages
  drop constraint if exists maritime_messages_latitude_check,
  drop constraint if exists maritime_messages_longitude_check;

alter table public.maritime_messages
  alter column latitude type text using latitude::text,
  alter column longitude type text using longitude::text;
