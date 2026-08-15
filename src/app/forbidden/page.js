import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Target of requireRole()/requireAnyRole() when an authenticated user
// lacks the required role (see src/lib/auth/guards.js).
export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600" aria-hidden="true">
        <ShieldAlert className="size-6" />
      </span>
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">403 — Akses ditolak</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Akun Anda tidak memiliki hak akses untuk membuka halaman ini.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Kembali ke dashboard</Link>
      </Button>
    </main>
  );
}
