import { notFound } from 'next/navigation';
import { requireAnyRole } from '@/lib/auth/guards';
import { rolesFor } from '@/lib/auth/permissions';
import { getMessageById, listStationsForSelect } from '@/features/relay-news/dal';
import { MessageForm } from '@/features/relay-news/components/message-form';

function toDatetimeLocal(value) {
  if (!value) return '';
  // <input type="datetime-local"> expects "YYYY-MM-DDTHH:mm" in local time.
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditRelayNewsPage({ params }) {
  const user = await requireAnyRole(rolesFor('messages.update_own_draft'));
  const { id } = await params;

  const message = await getMessageById(id);
  if (!message) notFound();

  // Ownership/status is the real gate via RLS + the update Server Action;
  // this is just a friendlier redirect than a raw RLS failure.
  if (message.status !== 'DRAFT' || (user.role !== 'ADMIN' && message.operator?.id !== user.id)) {
    notFound();
  }

  const stations = await listStationsForSelect();

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold">Ubah Berita — {message.message_number}</h1>
      <div className="mt-6">
        <MessageForm
          stations={stations}
          mode="edit"
          messageId={message.id}
          initialValues={{
            message_number: message.message_number,
            message_type: message.message_type,
            title: message.title,
            received_at: toDatetimeLocal(message.received_at),
            scheduled_at: toDatetimeLocal(message.scheduled_at),
            origin_station_id: message.origin_station?.id ?? '',
            destination_station_id: message.destination_station?.id ?? '',
            content: message.content,
            location_description: message.location_description ?? '',
            latitude: message.latitude != null ? String(message.latitude) : '',
            longitude: message.longitude != null ? String(message.longitude) : '',
            sender_name: message.sender_name ?? '',
            priority: message.priority,
          }}
        />
      </div>
    </div>
  );
}
