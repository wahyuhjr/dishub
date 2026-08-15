import Link from 'next/link';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Eye, Pencil } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageStatusBadge } from '@/features/relay-news/components/status-badge';
import { MESSAGE_TYPE_LABELS } from '@/features/relay-news/status-machine';

/**
 * "Riwayat Berita" — recent messages table for the dashboard. Uppercase
 * text-secondary header, row hover, status pill, and minimalist icon-only
 * action buttons (no big text buttons here — full CRUD lives on
 * /dashboard/relay-news).
 */
export function RecentMessagesTable({ messages = [] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Berita</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead className="pl-6 text-xs font-medium tracking-wide text-muted-foreground uppercase">No. Berita</TableHead>
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Judul</TableHead>
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Diterima</TableHead>
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Status</TableHead>
              <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Operator</TableHead>
              <TableHead className="pr-6 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.length === 0 ? (
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada berita.
                </TableCell>
              </TableRow>
            ) : (
              messages.map((message) => (
                <TableRow key={message.id} className="border-border/60 hover:bg-surface-hover">
                  <TableCell className="pl-6">
                    <div className="flex flex-col">
                      <span className="font-mono text-sm tabular-nums text-foreground">{message.message_number}</span>
                      <span className="text-xs text-muted-foreground">{MESSAGE_TYPE_LABELS[message.message_type] ?? message.message_type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-sm text-foreground">{message.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {message.received_at ? format(new Date(message.received_at), 'dd MMM yyyy HH:mm', { locale: idLocale }) : '—'}
                  </TableCell>
                  <TableCell>
                    <MessageStatusBadge status={message.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {message.operator?.full_name ?? message.operator?.username ?? '—'}
                  </TableCell>
                  <TableCell className="pr-6">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/dashboard/relay-news/${message.id}`}
                        aria-label={`Lihat detail berita ${message.message_number}`}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                      >
                        <Eye className="size-4" aria-hidden="true" />
                      </Link>
                      {message.status === 'DRAFT' ? (
                        <Link
                          href={`/dashboard/relay-news/${message.id}/edit`}
                          aria-label={`Ubah berita ${message.message_number}`}
                          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
