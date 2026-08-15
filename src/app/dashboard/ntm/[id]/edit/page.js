import { notFound } from 'next/navigation';
import { requireAnyRole } from '@/lib/auth/guards';
import { rolesFor } from '@/lib/auth/permissions';
import { getNtmDocumentById } from '@/features/ntm/dal';
import { NtmForm } from '@/features/ntm/components/ntm-form';

function toDatetimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditNtmPage({ params }) {
  const user = await requireAnyRole(rolesFor('ntm.update_own_draft'));
  const { id } = await params;

  const ntm = await getNtmDocumentById(id);
  if (!ntm) notFound();

  // Ownership/status is the real gate via RLS + the update Server Action;
  // this is just a friendlier redirect than a raw RLS failure — "NTM
  // yang sudah published tidak dapat diedit langsung".
  if (ntm.status !== 'DRAFT' || (user.role !== 'ADMIN' && ntm.creator?.id !== user.id)) {
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold">Ubah NTM — {ntm.ntm_number}</h1>
      <div className="mt-6">
        <NtmForm
          mode="edit"
          ntmDocumentId={ntm.id}
          initialValues={{
            ntm_number: ntm.ntm_number,
            edition: ntm.edition ?? '',
            document_type: ntm.document_type,
            title: ntm.title,
            content: ntm.content ?? '',
            area_navigasi: ntm.area_navigasi ?? '',
            effective_from: toDatetimeLocal(ntm.effective_from),
            effective_until: toDatetimeLocal(ntm.effective_until),
          }}
        />
      </div>
    </div>
  );
}
