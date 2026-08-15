import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { FileClock, Newspaper, CheckCircle2, AlertTriangle } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import {
  getDashboardSummary,
  getOverdueMessageCount,
  getRecentMessages,
  getTodayMessageCount,
  getTodayRelayedCount,
  getWeeklyRelayCounts,
  getYesterdayMessageCount,
  getYesterdayRelayedCount,
} from '@/features/dashboard/dal';
import { computeTrend } from '@/features/dashboard/trend';
import { StatCard } from '@/components/dashboard/stat-card';
import { WeeklyRelayChart } from '@/components/dashboard/weekly-relay-chart';
import { SystemStatusPanel } from '@/components/dashboard/system-status-panel';
import { RecentMessagesTable } from '@/components/dashboard/recent-messages-table';
import { RecentMessagesFeed } from '@/components/dashboard/recent-messages-feed';

// Any authenticated role (ADMIN, MASTER, OPERATOR, VIEWER) may view the
// dashboard landing page — see permissions.js.
export default async function DashboardPage() {
  const user = await requireUser();

  const [
    summary,
    todayCount,
    yesterdayCount,
    todayRelayed,
    yesterdayRelayed,
    overdueCount,
    weekly,
    recentMessages,
  ] = await Promise.all([
    getDashboardSummary(),
    getTodayMessageCount(),
    getYesterdayMessageCount(),
    getTodayRelayedCount(),
    getYesterdayRelayedCount(),
    getOverdueMessageCount(),
    getWeeklyRelayCounts(),
    getRecentMessages(8),
  ]);

  const weeklyChartData = weekly.map((point) => ({
    label: format(point.date, 'EEE', { locale: idLocale }),
    total: point.total,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Masuk sebagai <span className="font-medium text-foreground">{user.full_name ?? user.username}</span> ({user.role}).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Newspaper}
          iconVariant="primary"
          label="Total Berita Hari Ini"
          value={todayCount}
          trend={computeTrend(todayCount, yesterdayCount)}
        />
        <StatCard
          icon={CheckCircle2}
          iconVariant="success"
          label="Sudah Di-relay"
          value={todayRelayed}
          trend={computeTrend(todayRelayed, yesterdayRelayed)}
        />
        <StatCard
          icon={FileClock}
          iconVariant="warning"
          label="Pending Verifikasi"
          value={summary.pending_verification_count ?? 0}
        />
        <StatCard icon={AlertTriangle} iconVariant="danger" label="Terlambat" value={overdueCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyRelayChart weekly={weeklyChartData} />
        </div>
        <SystemStatusPanel healthChecks={summary.system_health ?? []} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentMessagesTable messages={recentMessages} />
        </div>
        <RecentMessagesFeed messages={recentMessages.slice(0, 6)} />
      </div>
    </div>
  );
}
