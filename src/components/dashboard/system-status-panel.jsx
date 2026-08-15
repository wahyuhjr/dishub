import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { HEALTH_STATUS, HEALTH_STATUS_LABELS, COMPONENT_LABELS } from '@/lib/health/constants';

const STATUS_VARIANT = {
  [HEALTH_STATUS.ONLINE]: { variant: 'success', dot: 'bg-success' },
  [HEALTH_STATUS.DEGRADED]: { variant: 'warning', dot: 'bg-warning' },
  [HEALTH_STATUS.OFFLINE]: { variant: 'danger', dot: 'bg-danger' },
  [HEALTH_STATUS.UNKNOWN]: { variant: 'neutral', dot: 'bg-faint' },
};

/** Vertical list of system component health, from get_dashboard_summary().system_health. */
export function SystemStatusPanel({ healthChecks = [] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Sistem</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {healthChecks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada data health check.</p>
        ) : (
          healthChecks.map((check) => {
            const meta = STATUS_VARIANT[check.status] ?? STATUS_VARIANT[HEALTH_STATUS.UNKNOWN];
            return (
              <div
                key={check.component_name}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-hover"
              >
                <span className={`size-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
                <span className="flex-1 truncate text-sm text-foreground">
                  {COMPONENT_LABELS[check.component_name] ?? check.component_name}
                </span>
                {check.latency_ms != null ? (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{check.latency_ms}ms</span>
                ) : null}
                <StatusPill variant={meta.variant}>{HEALTH_STATUS_LABELS[check.status] ?? check.status}</StatusPill>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
