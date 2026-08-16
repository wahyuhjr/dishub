import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MessageStatusBadge, PriorityBadge } from '@/features/relay-news/components/status-badge';
import { MESSAGE_TYPE_LABELS, MESSAGE_TYPE_BADGE_CLASSNAMES } from '@/features/relay-news/status-machine';
import { getPublicMessageById } from '@/features/relay-news/dal';
import { cn } from '@/lib/utils';

// Public route (see proxy.js PUBLIC_PATHS) — no login required. Relies on
// the maritime_messages_select_public RLS policy: DRAFT/PENDING_VERIFICATION
// rows resolve to `null` here (not visible to anon) and render a 404,
// exactly as if the row didn't exist.
export default async function PublicBeritaDetailPage({ params }) {
  const { id } = await params;
  const message = await getPublicMessageById(id);

  if (!message) notFound();

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Image src="/dishub.svg" alt="" width={32} height={32} />
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Digital Relay Berita Bahaya &amp; Notice To Marine
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali ke daftar berita
          </Link>
        </Button>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  MESSAGE_TYPE_BADGE_CLASSNAMES[message.message_type] ?? 'bg-surface-hover text-muted-foreground'
                )}
              >
                {MESSAGE_TYPE_LABELS[message.message_type] ?? message.message_type}
              </span>
              <MessageStatusBadge status={message.status} />
              <PriorityBadge priority={message.priority} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{message.title}</h1>
            <p className="font-mono text-xs tabular-nums text-muted-foreground">{message.message_number}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="whitespace-pre-wrap text-sm text-foreground">{message.content}</p>

            {message.location_description ? (
              <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{message.location_description}</span>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
              <span>Diterima: {format(new Date(message.received_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}</span>
              {message.relayed_at ? (
                <span>Di-relay: {format(new Date(message.relayed_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}</span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
