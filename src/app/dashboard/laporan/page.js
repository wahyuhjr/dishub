import { Suspense } from 'react';
import { requireAnyRole } from '@/lib/auth/guards';
import { rolesFor } from '@/lib/auth/permissions';
import { parseReportFilters } from '@/features/reports/filters';
import { listReportRows, getReportSummary, listOperatorsForFilter, listStationsForFilter } from '@/features/reports/dal';
import { ReportFilters } from '@/features/reports/components/report-filters';
import { ReportSummary } from '@/features/reports/components/report-summary';
import { ReportTable } from '@/features/reports/components/report-table';
import { ReportExportButtons } from '@/features/reports/components/report-export-buttons';
import { Pagination } from '@/features/relay-news/components/pagination';

export default async function LaporanPage({ searchParams }) {
  await requireAnyRole(rolesFor('reports.view'));
  const sp = await searchParams;
  const filters = parseReportFilters(sp ?? {});

  const [{ rows, total, page, pageSize }, { summary, capped }, operators, stations] = await Promise.all([
    listReportRows(filters),
    getReportSummary(filters),
    listOperatorsForFilter(),
    listStationsForFilter(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Laporan Relay Berita</h1>
          <p className="text-sm text-muted-foreground">
            {total} berita sesuai filter · zona waktu Asia/Jakarta (WIB).
          </p>
        </div>
        <Suspense fallback={null}>
          <ReportExportButtons />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <ReportFilters operators={operators} stations={stations} />
      </Suspense>

      <ReportSummary summary={summary} capped={capped} />

      <ReportTable rows={rows} />

      <Pagination page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
