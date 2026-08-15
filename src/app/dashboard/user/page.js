import { requireRole } from '@/lib/auth/guards';

// ADMIN-only — mirrors the "User" sidebar item's visibility
// (see src/config/navigation.js), but enforced here independently:
// even if OPERATOR/VIEWER/MASTER navigate to this URL directly, they
// are redirected to /forbidden by requireRole('ADMIN').
export default async function UserManagementPage() {
  await requireRole('ADMIN');

  return (
    <div>
      <h1 className="text-lg font-semibold">Manajemen User</h1>
      <p className="mt-2 text-sm text-muted-foreground">Daftar & pengelolaan akun pengguna akan tampil di sini.</p>
    </div>
  );
}
