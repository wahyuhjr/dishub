import { requireUser } from '@/lib/auth/guards';

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="max-w-md">
      <h1 className="text-lg font-semibold">Profil Saya</h1>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">Nama</dt>
          <dd className="font-medium">{user.full_name || '—'}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">Username</dt>
          <dd className="font-medium">{user.username}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium">{user.email}</dd>
        </div>
        <div className="flex justify-between pb-2">
          <dt className="text-muted-foreground">Role</dt>
          <dd className="font-medium">{user.role}</dd>
        </div>
      </dl>
    </div>
  );
}
