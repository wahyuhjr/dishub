import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { requireAnyRole } from '@/lib/auth/guards';
import { rolesFor, can } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import { getMessageById, listRelayAttempts, listStationsForSelect } from '@/features/relay-news/dal';
import { MessageStatusBadge } from '@/features/relay-news/components/status-badge';
import { MessageActions } from '@/features/relay-news/components/message-actions';
import { MESSAGE_TYPE_LABELS, PRIORITY_LABELS } from '@/features/relay-news/status-machine';

function fmt(dateString) {
  if (!dateString) return '—';
  return format(new Date(dateString), 'dd MMM yyyy HH:mm', { locale: idLocale });
}

export default async function RelayNewsDetailPage({ params }) {
  const user = await requireAnyRole(rolesFor('messages.view'));
  const { id } = await params;

  const [message, relayAttempts, stations] = await Promise.all([
    getMessageById(id),
    listRelayAttempts(id),
    listStationsForSelect(),
  ]);

  if (!message) {
    notFound();
  }

  const canEdit =
    message.status === 'DRAFT' &&
    can(user.role, 'messages.update_own_draft') &&
    (user.role === 'ADMIN' || message.operator?.id === user.id);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{message.message_number}</h1>
            <MessageStatusBadge status={message.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{message.title}</p>
        </div>
        {canEdit && (
          <Button asChild variant="outline">
            <Link href={`/dashboard/relay-news/${message.id}/edit`}>Edit</Link>
          </Button>
        )}
      </div>

      <MessageActions message={message} stations={stations} role={user.role} currentUserId={user.id} />

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Jenis Berita</dt>
          <dd className="font-medium">{MESSAGE_TYPE_LABELS[message.message_type]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Prioritas</dt>
          <dd className="font-medium">{PRIORITY_LABELS[message.priority]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Diterima</dt>
          <dd className="font-medium">{fmt(message.received_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Jadwal Relay</dt>
          <dd className="font-medium">{fmt(message.scheduled_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Stasiun Asal</dt>
          <dd className="font-medium">{message.origin_station?.station_name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Stasiun Tujuan</dt>
          <dd className="font-medium">{message.destination_station?.station_name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Lokasi</dt>
          <dd className="font-medium">{message.location_description ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Koordinat</dt>
          <dd className="font-medium">
            {message.latitude ?? '—'}, {message.longitude ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Nama Pengirim</dt>
          <dd className="font-medium">{message.sender_name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Operator</dt>
          <dd className="font-medium">{message.operator?.full_name || message.operator?.username || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Verifikator</dt>
          <dd className="font-medium">{message.verifier?.full_name || message.verifier?.username || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Relay Selesai</dt>
          <dd className="font-medium">{fmt(message.relayed_at)}</dd>
        </div>
        {message.delay_reason ? (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Alasan Gagal/Tertunda</dt>
            <dd className="font-medium">{message.delay_reason}</dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Isi Berita</dt>
          <dd className="mt-1 whitespace-pre-wrap font-medium">{message.content}</dd>
        </div>
      </dl>

      <section aria-labelledby="relay-history-heading" className="rounded-lg border p-4">
        <h2 id="relay-history-heading" className="text-sm font-semibold">
          Riwayat Relay
        </h2>
        {relayAttempts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Belum ada percobaan relay.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {relayAttempts.map((attempt) => (
              <li key={attempt.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                <span>
                  Percobaan #{attempt.attempt_number} ke {attempt.station?.station_name} — {fmt(attempt.started_at)}
                </span>
                <span className="font-medium">{attempt.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
