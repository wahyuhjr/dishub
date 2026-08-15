import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/guards';
import { listUsers } from '@/features/users/dal';
import { UserFilters } from '@/features/users/components/user-filters';
import { UsersTable } from '@/features/users/components/users-table';
import { AddUserButton } from '@/features/users/components/add-user-button';
import { Pagination } from '@/features/relay-news/components/pagination';

// ADMIN-only — mirrors the "User" sidebar item's visibility
// (see src/config/navigation.js), but enforced here independently:
// even if OPERATOR/VIEWER/MASTER navigate to this URL directly, they
// are redirected to /forbidden by requireRole('ADMIN').
export default async function UserManagementPage({ searchParams }) {
  const admin = await requireRole('ADMIN');
  const sp = await searchParams;

  const filters = {
    search: sp?.q ?? '',
    role: sp?.role ?? '',
    active: sp?.active ?? '',
    sortBy: sp?.sort ?? 'created_at',
    sortDir: sp?.dir ?? 'desc',
    page: sp?.page ?? '1',
  };

  const { rows, total, page, pageSize } = await listUsers(filters);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Manajemen User</h1>
          <p className="text-sm text-muted-foreground">{total} pengguna terdaftar.</p>
        </div>
        <AddUserButton />
      </div>

      <Suspense fallback={null}>
        <UserFilters />
      </Suspense>

      <UsersTable rows={rows} currentUserId={admin.id} />

      <Pagination page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
