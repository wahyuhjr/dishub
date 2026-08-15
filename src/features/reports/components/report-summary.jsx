import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRelayDuration } from '@/features/reports/summary';

function SummaryCard({ label, value, hint, colorClass }) {
  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs opacity-60">{hint}</p> : null}
    </div>
  );
}

/** Summary counters + per-operator / per-station breakdown (requirement 2). */
export function ReportSummary({ summary, capped }) {
  return (
    <div className="flex flex-col gap-4">
      {capped ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          Ringkasan dihitung dari sebagian data karena hasil filter sangat besar. Persempit rentang tanggal untuk angka yang akurat, atau gunakan ekspor CSV/XLSX.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total — neutral blue */}
        <SummaryCard
          label="Total Berita"
          value={summary.total}
          colorClass="border-blue-200 bg-blue-50 text-blue-900"
        />
        {/* Relayed — green */}
        <SummaryCard
          label="Berhasil Relay"
          value={summary.relayedCount}
          colorClass="border-emerald-200 bg-emerald-50 text-emerald-900"
        />
        {/* Failed — red */}
        <SummaryCard
          label="Gagal"
          value={summary.failedCount}
          colorClass="border-red-200 bg-red-50 text-red-900"
        />
        {/* Delayed — amber */}
        <SummaryCard
          label="Terlambat"
          value={summary.delayedCount}
          colorClass="border-amber-200 bg-amber-50 text-amber-900"
        />
        {/* Avg relay time — purple */}
        <SummaryCard
          label="Rata-rata Waktu Relay"
          value={formatRelayDuration(summary.avgRelaySeconds)}
          colorClass="border-purple-200 bg-purple-50 text-purple-900"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Relay per Operator</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operator</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Berhasil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.perOperator.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              ) : (
                summary.perOperator.map((op) => (
                  <TableRow key={op.id ?? 'none'}>
                    <TableCell>{op.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{op.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{op.relayed}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Relay per Stasiun</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stasiun</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Berhasil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.perStation.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              ) : (
                summary.perStation.map((st) => (
                  <TableRow key={st.id ?? 'none'}>
                    <TableCell>{st.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{st.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{st.relayed}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
