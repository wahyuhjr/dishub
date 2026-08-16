'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { can } from '@/lib/auth/permissions';
import { MessageStatusBadge, PriorityBadge } from './status-badge';
import { MESSAGE_TYPE_LABELS, MESSAGE_TYPE_BADGE_CLASSNAMES, PRIORITY_LABELS, availableActions } from '@/features/relay-news/status-machine';

function SortableHeader({ column, label }) {
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
    router.push(`${pathname}?${params.toString()}`);
  }

  const Icon = isActive ? (activeDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={toggleSort}
      className="inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Urutkan berdasarkan ${label}${isActive ? `, saat ini ${activeDir === 'asc' ? 'menaik' : 'menurun'}` : ''}`}
    >
      {label}
      <Icon className="size-3.5" aria-hidden="true" />
    </button>
  );
}

export function RelayNewsTable({ rows, role, currentUserId }) {
  const columns = useMemo(
    () => [
      {
        accessorKey: 'message_number',
        size: 160,
        header: () => <SortableHeader column="message_number" label="No. Berita" />,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium tabular-nums">{row.original.message_number}</span>
            {/* <span className={`inline-flex w-fit items-center rounded-full border px-2 py-px text-xs font-medium ${MESSAGE_TYPE_BADGE_CLASSNAMES[row.original.message_type] ?? ''}`}>
              {MESSAGE_TYPE_LABELS[row.original.message_type]}
            </span> */}
          </div>
        ),
      },
      {
        accessorKey: 'title',
        size: 280,
        header: 'Judul',
        cell: ({ row }) => (
          <div className="max-w-[280px] truncate" title={row.original.title}>
            {row.original.title}
          </div>
        ),
      },
      {
        accessorKey: 'received_at',
        size: 160,
        header: () => <SortableHeader column="received_at" label="Diterima" />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {format(new Date(row.original.received_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        size: 140,
        header: () => <SortableHeader column="status" label="Status" />,
        cell: ({ row }) => <MessageStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'priority',
        size: 110,
        header: () => <SortableHeader column="priority" label="Prioritas" />,
        cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
      },
      {
        id: 'operator',
        size: 140,
        header: 'Operator',
        cell: ({ row }) => (
          <div className="max-w-[140px] truncate text-muted-foreground" title={row.original.operator?.full_name || row.original.operator?.username}>
            {row.original.operator?.full_name || row.original.operator?.username || '—'}
          </div>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => {
          const message = row.original;
          const actions = availableActions({
            status: message.status,
            role,
            isOwner: message.operator?.id === currentUserId,
          });
          const canEdit = message.status === 'DRAFT' && can(role, 'messages.update_own_draft') && (role === 'ADMIN' || message.operator?.id === currentUserId);

          return (
            <div className="flex justify-end gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/relay-news/${message.id}`} aria-label={`Lihat detail berita ${message.message_number}`}>
                  Detail
                </Link>
              </Button>
              {canEdit && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/relay-news/${message.id}/edit`} aria-label={`Ubah berita ${message.message_number}`}>
                    Edit
                  </Link>
                </Button>
              )}
              {actions.includes('relay') && (
                <Button asChild size="sm" className="bg-accent-primary text-white hover:bg-accent-primary/90">
                  <Link href={`/dashboard/relay-news/${message.id}`} aria-label={`Relay berita ${message.message_number}`}>
                    Relay
                  </Link>
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [role, currentUserId]
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={header.column.columnDef.size ? { width: header.column.columnDef.size } : undefined}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-16 text-center text-sm text-muted-foreground">
                Tidak ada berita yang cocok dengan filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
