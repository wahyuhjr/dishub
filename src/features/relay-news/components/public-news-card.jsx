import Link from 'next/link';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MessageStatusBadge, PriorityBadge } from './status-badge';
import { MESSAGE_TYPE_LABELS, MESSAGE_TYPE_BADGE_CLASSNAMES } from '@/features/relay-news/status-machine';
import { cn } from '@/lib/utils';

/**
 * Public (no-auth) card for a single berita on the homepage list — see
 * src/app/page.js. Clicking anywhere on the card navigates to the
 * public detail page (/berita/[id]).
 */
export function PublicNewsCard({ message }) {
  return (
    <Link
      href={`/berita/${message.id}`}
      aria-label={`Lihat detail berita ${message.message_number}: ${message.title}`}
      className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="flex h-full flex-col transition-colors group-hover:border-primary/50 group-hover:bg-surface-hover">
        <CardHeader className="gap-2 pb-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium',
                MESSAGE_TYPE_BADGE_CLASSNAMES[message.message_type] ?? 'bg-surface-hover text-muted-foreground'
              )}
            >
              {MESSAGE_TYPE_LABELS[message.message_type] ?? message.message_type}
            </span>
            <MessageStatusBadge status={message.status} />
          </div>
          <h2 className="line-clamp-2 text-base font-semibold tracking-tight text-foreground">{message.title}</h2>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 pt-3">
          <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">{message.content}</p>

          {message.location_description ? (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span className="line-clamp-1">{message.location_description}</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{message.message_number}</span>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={message.priority} />
              <span className="text-xs whitespace-nowrap text-muted-foreground">
                {format(new Date(message.received_at), 'dd MMM yyyy', { locale: idLocale })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
