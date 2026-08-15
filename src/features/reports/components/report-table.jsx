'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageStatusBadge } from '@/features/relay-news/components/status-badge';
import { MESSAGE_TYPE_LABELS, MESSAGE_TYPE_BADGE_CLASSNAMES } from '@/features/relay-news/status-machine';

function SortableHeader({ column, label, className }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSort = searchParams.get('sort') ?? 'received_at';
  const activeDir = searchParams.get('dir') ?? 'desc';
  const isActive = activeSort === column;
  const nextDir = isActive && activeDir === 'asc' ? 'desc' : 'asc';

  function toggleSort() {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', column);
    params.set('dir', nextDir);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  }

  const Icon = isActive ? (activeDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={toggleSort}
        className="inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Urutkan berdasarkan ${label}${isActive ? `, saat ini ${activeDir === 'asc' ? 'menaik' : 'menurun'}` : ''}`}
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    </TableHead>
  );
}

function formatWib(value) {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm', { locale: idLocale });
  } catch {
    return '—';
  }
}

/** Server-sorted, server-paginated report result table. */
export function ReportTable({ rows }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader column="message_number" label="No. Berita" className="w-[160px]" />
            <SortableHeader column="message_type" label="Jenis" className="w-[110px]" />
            <TableHead>Judul</TableHead>
            <SortableHeader column="received_at" label="Diterima (WIB)" className="w-[160px]" />
            <SortableHeader column="relayed_at" label="Direlay (WIB)" className="w-[160px]" />
            <SortableHeader column="status" label="Status" className="w-[140px]" />
            <TableHead className="w-[140px]">Operator</TableHead>
            <TableHead className="w-[150px]">Stasiun Asal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                Tidak ada berita yang cocok dengan filter.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium tabular-nums">{row.message_number}</TableCell>
                <TableCell>
                  <span className={`inline-flex w-fit items-center rounded-full border px-2 py-px text-xs font-medium ${MESSAGE_TYPE_BADGE_CLASSNAMES[row.message_type] ?? ''}`}>
                    {MESSAGE_TYPE_LABELS[row.message_type] ?? row.message_type}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="max-w-[280px] truncate" title={row.title}>{row.title}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatWib(row.received_at)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatWib(row.relayed_at)}</TableCell>
                <TableCell><MessageStatusBadge status={row.status} /></TableCell>
                <TableCell>
                  <div className="max-w-[140px] truncate text-muted-foreground" title={row.operator?.full_name || row.operator?.username}>
                    {row.operator?.full_name || row.operator?.username || '—'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-[150px] truncate text-muted-foreground" title={row.origin_station?.station_name || row.origin_station?.station_code}>
                    {row.origin_station?.station_name || row.origin_station?.station_code || '—'}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
