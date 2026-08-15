import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { requireAnyRole } from '@/lib/auth/guards';
import { rolesFor, can } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import { getNtmDocumentById } from '@/features/ntm/dal';
import { NtmStatusBadge } from '@/features/ntm/components/ntm-status-badge';
import { NtmActions } from '@/features/ntm/components/ntm-actions';
import { NtmDocumentPanel } from '@/features/ntm/components/ntm-document-panel';
import { NTM_DOCUMENT_TYPE_LABELS } from '@/features/ntm/status-machine';

function fmt(dateString) {
  if (!dateString) return '—';
  return format(new Date(dateString), 'dd MMM yyyy HH:mm', { locale: idLocale });
}

export default async function NtmDetailPage({ params }) {
  const user = await requireAnyRole(rolesFor('ntm.view'));
  const { id } = await params;

  const ntm = await getNtmDocumentById(id);
  if (!ntm) notFound();

  const canEdit = ntm.status === 'DRAFT' && can(user.role, 'ntm.update_own_draft') && (user.role === 'ADMIN' || ntm.creator?.id === user.id);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">
              {ntm.ntm_number}
              {ntm.revision_number > 1 ? <span className="ml-1 text-sm text-muted-foreground">(revisi {ntm.revision_number})</span> : null}
            </h1>
            <NtmStatusBadge status={ntm.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{ntm.title}</p>
        </div>
        {canEdit && (
          <Button asChild variant="outline">
            <Link href={`/dashboard/ntm/${ntm.id}/edit`}>Edit</Link>
          </Button>
        )}
      </div>

      <NtmActions ntm={ntm} role={user.role} currentUserId={user.id} />

      <NtmDocumentPanel ntm={ntm} />

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Edisi</dt>
          <dd className="font-medium">{ntm.edition || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Jenis Dokumen</dt>
          <dd className="font-medium">{NTM_DOCUMENT_TYPE_LABELS[ntm.document_type] ?? ntm.document_type}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Area Navigasi</dt>
          <dd className="font-medium">{ntm.area_navigasi || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Berlaku</dt>
          <dd className="font-medium">
            {fmt(ntm.effective_from)} — {fmt(ntm.effective_until)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Pembuat</dt>
          <dd className="font-medium">{ntm.creator?.full_name ?? ntm.creator?.username ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Verifikator</dt>
          <dd className="font-medium">{ntm.verifier?.full_name ?? ntm.verifier?.username ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Diterbitkan</dt>
          <dd className="font-medium">{fmt(ntm.published_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Diarsipkan</dt>
          <dd className="font-medium">{fmt(ntm.archived_at)}</dd>
        </div>
        {ntm.previous_version?.id ? (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Revisi Dari</dt>
            <dd className="font-medium">
              <Link href={`/dashboard/ntm/${ntm.previous_version.id}`} className="underline">
                {ntm.previous_version.ntm_number} (rev.{ntm.previous_version.revision_number}) — {ntm.previous_version.status}
              </Link>
            </dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Isi/Keterangan</dt>
          <dd className="mt-1 whitespace-pre-wrap">{ntm.content || '—'}</dd>
        </div>
      </dl>
    </div>
  );
}
