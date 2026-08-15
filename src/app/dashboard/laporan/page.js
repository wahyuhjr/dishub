import { requireAnyRole } from '@/lib/auth/guards';
import { rolesFor } from '@/lib/auth/permissions';

export default async function LaporanPage() {
  await requireAnyRole(rolesFor('reports.view'));

  return (
    <div>
      <h1 className="text-lg font-semibold">Laporan</h1>
      <p className="mt-2 text-sm text-muted-foreground">Laporan periodik akan tampil di sini.</p>
    </div>
  );
}
