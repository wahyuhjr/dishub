import Link from 'next/link';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Eye, Pencil } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NtmStatusBadge } from './ntm-status-badge';
import { NTM_DOCUMENT_TYPE_LABELS } from '@/features/ntm/status-machine';

function fmt(dateString) {
  if (!dateString) return '—';
  return format(new Date(dateString), 'dd MMM yyyy', { locale: idLocale });
}

/** Server-side paginated NTM table, with an explicit empty state. */
export function NtmTable({ rows }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
        <p className="text-sm font-medium text-foreground">Belum ada NTM yang cocok dengan filter ini.</p>
        <p className="text-sm text-muted-foreground">Coba ubah filter, atau buat NTM baru.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Nomor NTM</TableHead>
            <TableHead className="w-[80px]">Edisi</TableHead>
            <TableHead>Judul</TableHead>
            <TableHead className="w-[120px]">Jenis</TableHead>
            <TableHead className="w-[130px]">Status</TableHead>
            <TableHead className="w-[130px]">Terbit</TableHead>
            <TableHead className="w-[140px]">Pembuat</TableHead>
            <TableHead className="w-px text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-sm tabular-nums">
                {row.ntm_number}
                {row.revision_number > 1 ? (
                  <span className="ml-1 text-xs text-muted-foreground">rev.{row.revision_number}</span>
                ) : null}
              </TableCell>
              <TableCell className="text-muted-foreground">{row.edition || '—'}</TableCell>
              <TableCell>
                <div className="max-w-[260px] truncate" title={row.title}>{row.title}</div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {NTM_DOCUMENT_TYPE_LABELS[row.document_type] ?? row.document_type}
              </TableCell>
              <TableCell>
                <NtmStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{fmt(row.published_at)}</TableCell>
              <TableCell>
                <div
                  className="max-w-[140px] truncate text-muted-foreground"
                  title={row.creator?.full_name ?? row.creator?.username}
                >
                  {row.creator?.full_name ?? row.creator?.username ?? '—'}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/dashboard/ntm/${row.id}`}
                    aria-label={`Lihat detail NTM ${row.ntm_number}`}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Eye className="size-4" aria-hidden="true" />
                  </Link>
                  {row.status === 'DRAFT' ? (
                    <Link
                      href={`/dashboard/ntm/${row.id}/edit`}
                      aria-label={`Ubah NTM ${row.ntm_number}`}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
