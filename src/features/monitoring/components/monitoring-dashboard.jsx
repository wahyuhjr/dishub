'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { toast } from 'sonner';
import {
  HEALTH_STATUS,
  HEALTH_STATUS_LABELS,
  COMPONENT_LABELS,
  COMPONENT_GROUP,
  HEALTH_GROUP,
} from '@/lib/health/constants';
import { RealtimeHealthChart } from './realtime-health-chart';

const AUTO_REFRESH_INTERVAL_MS = 30_000;

const PILL_VARIANT_BY_STATUS = {
  [HEALTH_STATUS.ONLINE]: 'success',
  [HEALTH_STATUS.DEGRADED]: 'warning',
  [HEALTH_STATUS.OFFLINE]: 'danger',
  [HEALTH_STATUS.UNKNOWN]: 'neutral',
};

const GROUP_LABELS = {
  [HEALTH_GROUP.APP]: 'App Health',
  [HEALTH_GROUP.DATABASE]: 'Database Health',
  [HEALTH_GROUP.EXTERNAL_DEVICE]: 'External Device Health',
};

function lastCheckedLabel(checkedAt) {
  if (!checkedAt) return 'Belum pernah diperiksa';
  return `Diperiksa ${formatDistanceToNow(new Date(checkedAt), { addSuffix: true, locale: idLocale })}`;
}

function HealthCard({ label, item }) {
  // `formatDistanceToNow` depends on the current instant, so the server-
  // rendered string ('1 menit yang lalu') and the client's first render
  // during hydration ('kurang dari 1 menit yang lalu') can legitimately
  // differ by a few seconds — a classic hydration mismatch. We render a
  // stable placeholder for the very first client render (identical to
  // what SSR produced isn't required here, only that both initial
  // passes match), then swap in the real relative label after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <StatusPill variant={PILL_VARIANT_BY_STATUS[item.status] ?? 'neutral'}>
          {HEALTH_STATUS_LABELS[item.status] ?? item.status}
        </StatusPill>
      </div>
      <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">
        {item.latency_ms != null ? `${item.latency_ms}ms` : '—'}
      </p>
      <p className="mt-1 text-xs text-muted-foreground" suppressHydrationWarning>
        {mounted ? lastCheckedLabel(item.checked_at) : '\u00A0'}
      </p>
      {item.error_message ? <p className="mt-1 text-xs text-danger">{item.error_message}</p> : null}
    </Card>
  );
}

/**
 * Client island for /dashboard/monitoring. Combines three update
 * mechanisms, each covering a different requirement:
 *   - initial data from the server (SSR props, always fresh on load)
 *   - a periodic fetch('/api/health') poll (item 10 — "auto-refresh
 *     berkala"), which also triggers a fresh check round if the viewer
 *     has `monitoring.log` (see the route)
 *   - a Supabase Realtime subscription on system_health_checks INSERTs
 *     (item 11), so every connected viewer sees updates the instant
 *     ANY client (or a future cron job) triggers a check — not just
 *     whoever happened to trigger it.
 *
 * Never pings a device directly (item 12) — this component only ever
 * talks to /api/health (our own server) and reads from Postgres via
 * Realtime; it has no knowledge of how a check is actually performed.
 */
export function MonitoringDashboard({ initialSystemHealth, initialStationHealth, canTriggerChecks }) {
  const [systemHealth, setSystemHealth] = useState(initialSystemHealth);
  const [stationHealth, setStationHealth] = useState(initialStationHealth);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);

  async function refresh() {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) {
        toast.error('Gagal memuat status kesehatan sistem.');
        return;
      }
      const data = await res.json();
      if (!mountedRef.current) return;
      if (data.systemHealth) {
        setSystemHealth((prev) => mergeSystemHealth(prev, data.systemHealth));
      }
      if (data.stationHealth) {
        setStationHealth((prev) => mergeStationHealth(prev, data.stationHealth));
      }
    } finally {
      if (mountedRef.current) setIsRefreshing(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    const interval = setInterval(refresh, AUTO_REFRESH_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel('system_health_checks_inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_health_checks' }, (payload) => {
        const row = payload.new;
        if (row.station_id) {
          setStationHealth((prev) =>
            prev.map((item) =>
              item.station.id === row.station_id
                ? { ...item, status: row.status, latency_ms: row.latency_ms, checked_at: row.checked_at, error_message: row.error_message }
                : item
            )
          );
        } else {
          setSystemHealth((prev) =>
            prev.map((item) =>
              item.component_name === row.component_name
                ? { ...item, status: row.status, latency_ms: row.latency_ms, checked_at: row.checked_at, error_message: row.error_message }
                : item
            )
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const grouped = useMemo(() => {
    const groups = { [HEALTH_GROUP.APP]: [], [HEALTH_GROUP.DATABASE]: [], [HEALTH_GROUP.EXTERNAL_DEVICE]: [] };
    for (const item of systemHealth) {
      const group = COMPONENT_GROUP[item.component_name];
      if (group) groups[group].push(item);
    }
    return groups;
  }, [systemHealth]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
          <RefreshCw className={isRefreshing ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
          {canTriggerChecks ? 'Periksa Sekarang' : 'Muat Ulang'}
        </Button>
      </div>

      <RealtimeHealthChart systemHealth={systemHealth} stationHealth={stationHealth} />

      {Object.entries(GROUP_LABELS).map(([group, groupLabel]) => (
        <div key={group}>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">{groupLabel}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {grouped[group].map((item) => (
              <HealthCard key={item.component_name} label={COMPONENT_LABELS[item.component_name] ?? item.component_name} item={item} />
            ))}
          </div>
        </div>
      ))}

      <div>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Status Setiap Station</h2>
        {stationHealth.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada station aktif.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stationHealth.map((item) => (
              <HealthCard key={item.station.id} label={item.station.station_name} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function mergeSystemHealth(prev, fresh) {
  const byComponent = new Map(fresh.map((row) => [row.component_name, row]));
  return prev.map((item) => {
    const latest = byComponent.get(item.component_name);
    return latest ? { ...item, status: latest.status, latency_ms: latest.latency_ms, checked_at: latest.checked_at, error_message: latest.error_message } : item;
  });
}

function mergeStationHealth(prev, fresh) {
  const byStationId = new Map(fresh.map((row) => [row.station_id, row]));
  return prev.map((item) => {
    const latest = byStationId.get(item.station.id);
    return latest ? { ...item, status: latest.status, latency_ms: latest.latency_ms, checked_at: latest.checked_at, error_message: latest.error_message } : item;
  });
}
