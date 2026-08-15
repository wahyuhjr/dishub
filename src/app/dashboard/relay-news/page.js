import Link from 'next/link';
import { requireAnyRole } from '@/lib/auth/guards';
import { rolesFor, can } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import { listMessages, listStationsForSelect, listOperatorsForFilter, PAGE_SIZE } from '@/features/relay-news/dal';
import { RelayNewsFilters } from '@/features/relay-news/components/relay-news-filters';
import { RelayNewsTable } from '@/features/relay-news/components/relay-news-table';
import { Pagination } from '@/features/relay-news/components/pagination';

export default async function RelayNewsPage({ searchParams }) {
  const user = await requireAnyRole(rolesFor('messages.view'));
  const sp = await searchParams;

  const filters = {
    search: sp?.q ?? '',
    messageType: sp?.type ?? '',
    status: sp?.status ?? '',
    operatorId: sp?.operator ?? '',
    dateFrom: sp?.from ?? '',
    dateTo: sp?.to ?? '',
    sortBy: sp?.sort ?? 'received_at',
    sortDir: sp?.dir ?? 'desc',
    page: sp?.page ?? '1',
  };

  const [{ rows, total, page, pageSize }, stations, operators] = await Promise.all([
    listMessages(filters),
    listStationsForSelect(),
    listOperatorsForFilter(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Relay Berita Bahaya</h1>
          <p className="text-sm text-muted-foreground">
            {total} berita ditemukan{filters.search ? ` untuk "${filters.search}"` : ''}.
          </p>
        </div>
        {can(user.role, 'messages.create') && (
          <Button asChild>
            <Link href="/dashboard/relay-news/new">Buat Berita Baru</Link>
          </Button>
        )}
      </div>

      <RelayNewsFilters operators={operators} />

      <RelayNewsTable rows={rows} stations={stations} role={user.role} currentUserId={user.id} />

      <Pagination page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
