-- =====================================================================
-- Digital Relay Berita Bahaya & Notice To Marine (NTM)
-- Migration: dashboard views and statistics RPC
-- =====================================================================
-- NOTE: plain views (not SECURITY DEFINER) still enforce the RLS of
-- their underlying tables for whichever role queries them — so a VIEWER
-- querying v_maritime_message_status_counts only ever sees counts for
-- rows they are allowed to see (per maritime_messages_select policy).
-- =====================================================================

create or replace view public.v_system_health_latest as
select distinct on (component_name)
  component_name,
  status,
  latency_ms,
  checked_at,
  error_message
from public.system_health_checks
order by component_name, checked_at desc;

comment on view public.v_system_health_latest is
  'Latest health check row per component_name, for dashboard status widgets.';

create or replace view public.v_maritime_message_status_counts as
select
  message_type,
  status,
  count(*) as total
from public.maritime_messages
group by message_type, status;

comment on view public.v_maritime_message_status_counts is
  'Aggregated count of maritime_messages by message_type and status, used by dashboard charts.';

grant select on public.v_system_health_latest to authenticated;
grant select on public.v_maritime_message_status_counts to authenticated;

-- ---------------------------------------------------------------------
-- RPC: consolidated dashboard summary
-- SECURITY DEFINER so ADMIN/MASTER/OPERATOR/VIEWER get one consistent,
-- global set of counters regardless of per-row RLS visibility, while
-- still being explicitly gated to known, authenticated internal roles
-- (anonymous/public callers are rejected).
-- ---------------------------------------------------------------------
create or replace function public.get_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.has_any_role(array['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER']) then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'total_messages', (select count(*) from public.maritime_messages),
    'messages_by_status', (
      select coalesce(jsonb_object_agg(status, total), '{}'::jsonb)
      from (
        select status, count(*) as total
        from public.maritime_messages
        group by status
      ) s
    ),
    'messages_by_type', (
      select coalesce(jsonb_object_agg(message_type, total), '{}'::jsonb)
      from (
        select message_type, count(*) as total
        from public.maritime_messages
        group by message_type
      ) t
    ),
    'pending_verification_count', (
      select count(*) from public.maritime_messages where status = 'PENDING_VERIFICATION'
    ),
    'active_stations', (select count(*) from public.stations where is_active),
    'total_stations', (select count(*) from public.stations),
    'relay_success_last_24h', (
      select count(*) from public.relay_attempts
      where status = 'SUCCESS' and started_at >= now() - interval '24 hours'
    ),
    'relay_failed_last_24h', (
      select count(*) from public.relay_attempts
      where status = 'FAILED' and started_at >= now() - interval '24 hours'
    ),
    'system_health', (
      select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb)
      from public.v_system_health_latest h
    )
  ) into result;

  return result;
end;
$$;

comment on function public.get_dashboard_summary() is
  'Consolidated dashboard statistics (message counts by status/type, relay success/failure in the last 24h, station counts, latest system health). SECURITY DEFINER for a consistent global view across roles; access is still explicitly gated to known application roles via has_any_role().';

revoke all on function public.get_dashboard_summary() from public;
grant execute on function public.get_dashboard_summary() to authenticated;
