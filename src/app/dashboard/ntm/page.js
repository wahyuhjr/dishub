import Link from 'next/link';
import { requireAnyRole } from '@/lib/auth/guards';
import { rolesFor, can } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import { listNtmDocuments, listNtmCreatorsForFilter } from '@/features/ntm/dal';
import { NtmFilters } from '@/features/ntm/components/ntm-filters';
import { NtmTable } from '@/features/ntm/components/ntm-table';
import { Pagination } from '@/features/relay-news/components/pagination';

export default async function NtmPage({ searchParams }) {
  const user = await requireAnyRole(rolesFor('ntm.view'));
  const sp = await searchParams;

  const filters = {
    ntmNumber: sp?.ntm_number ?? '',
    edition: sp?.edition ?? '',
    status: sp?.status ?? '',
    creatorId: sp?.creator ?? '',
    publishedFrom: sp?.published_from ?? '',
    publishedTo: sp?.published_to ?? '',
    page: sp?.page ?? '1',
  };

  const [{ rows, total, page, pageSize }, creators] = await Promise.all([
    listNtmDocuments(filters),
    listNtmCreatorsForFilter(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Notice To Marine</h1>
          <p className="text-sm text-muted-foreground">{total} NTM ditemukan.</p>
        </div>
        {can(user.role, 'ntm.create') && (
          <Button asChild>
            <Link href="/dashboard/ntm/new">Buat NTM Baru</Link>
          </Button>
        )}
      </div>

      <NtmFilters creators={creators} />

      <NtmTable rows={rows} />

      <Pagination page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
