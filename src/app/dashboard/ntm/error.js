'use client';

import { Button } from '@/components/ui/button';

/** Error boundary for /dashboard/ntm — Next.js requires this to be a Client Component. */
export default function NtmError({ error, reset }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <p className="text-sm font-medium text-foreground">Gagal memuat data Notice To Marine.</p>
      <p className="max-w-md text-sm text-muted-foreground">{error?.message ?? 'Terjadi kesalahan tak terduga.'}</p>
      <Button type="button" onClick={() => reset()}>
        Coba Lagi
      </Button>
    </div>
  );
}
