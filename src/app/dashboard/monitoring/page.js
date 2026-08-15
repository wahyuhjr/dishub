import { requireAnyRole } from '@/lib/auth/guards';
import { rolesFor, can } from '@/lib/auth/permissions';
import { getSystemHealth, getStationHealth } from '@/features/monitoring/dal';
import { MonitoringDashboard } from '@/features/monitoring/components/monitoring-dashboard';

export default async function MonitoringPage() {
  const user = await requireAnyRole(rolesFor('monitoring.view'));

  const [systemHealth, stationHealth] = await Promise.all([getSystemHealth(), getStationHealth()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Monitoring</h1>
        <p className="text-sm text-muted-foreground">Status sistem, database, dan setiap perangkat/station.</p>
      </div>
      <MonitoringDashboard
        initialSystemHealth={systemHealth}
        initialStationHealth={stationHealth}
        canTriggerChecks={can(user.role, 'monitoring.log')}
      />
    </div>
  );
}
