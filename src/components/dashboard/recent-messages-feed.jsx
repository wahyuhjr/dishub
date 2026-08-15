import { format, isToday, isYesterday } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MESSAGE_TYPE_LABELS, MESSAGE_TYPE_BADGE_CLASSNAMES } from '@/features/relay-news/status-machine';
import { cn } from '@/lib/utils';

/** "Hari ini 11:36" / "Kemarin" / "12 Agt 2026" — matches the design spec's relative-time examples. */
function relativeLabel(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isToday(date)) return `Hari ini ${format(date, 'HH:mm', { locale: idLocale })}`;
  if (isYesterday(date)) return 'Kemarin';
  return format(date, 'dd MMM yyyy', { locale: idLocale });
}

/**
 * "Notifikasi Berita Terbaru" — compact list of the latest messages with
 * a colored jenis-berita tag on the left and a relative timestamp on the
 * right.
 */
export function RecentMessagesFeed({ messages = [] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifikasi Berita Terbaru</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada berita terbaru.</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-hover">
              <span
                className={cn(
                  'mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
                  MESSAGE_TYPE_BADGE_CLASSNAMES[message.message_type] ?? 'bg-surface-hover text-muted-foreground'
                )}
              >
                {MESSAGE_TYPE_LABELS[message.message_type] ?? message.message_type}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{message.title}</span>
              <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">{relativeLabel(message.received_at)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
