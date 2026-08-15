import { requireAnyRole } from '@/lib/auth/guards';
import { rolesFor } from '@/lib/auth/permissions';
import { NtmForm } from '@/features/ntm/components/ntm-form';

export default async function NewNtmPage() {
  await requireAnyRole(rolesFor('ntm.create'));

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold">Buat NTM Baru</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        NTM disimpan sebagai draft — lengkapi lalu ajukan untuk verifikasi.
      </p>
      <div className="mt-6">
        <NtmForm mode="create" />
      </div>
    </div>
  );
}
