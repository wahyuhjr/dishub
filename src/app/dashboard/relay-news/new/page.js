import { requireAnyRole } from '@/lib/auth/guards';
import { rolesFor } from '@/lib/auth/permissions';
import { listStationsForSelect } from '@/features/relay-news/dal';
import { MessageForm } from '@/features/relay-news/components/message-form';

export default async function NewRelayNewsPage() {
  await requireAnyRole(rolesFor('messages.create'));
  const stations = await listStationsForSelect();

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold">Buat Berita Baru</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Simpan sebagai draft untuk dilengkapi nanti, atau ajukan langsung untuk verifikasi.
      </p>
      <div className="mt-6">
        <MessageForm stations={stations} mode="create" />
      </div>
    </div>
  );
}
