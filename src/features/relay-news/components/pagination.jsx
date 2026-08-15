'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

/** Server-side pagination controls for /dashboard/relay-news. */
export function Pagination({ page, pageSize, total }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function goTo(nextPage) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <nav className="flex items-center justify-between" aria-label="Navigasi halaman">
      <p className="text-sm text-muted-foreground">
        Menampilkan {start}–{end} dari {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => goTo(page - 1)}
          aria-label="Halaman sebelumnya"
        >
          Sebelumnya
        </Button>
        <span className="text-sm" aria-current="page">
          Halaman {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => goTo(page + 1)}
          aria-label="Halaman berikutnya"
        >
          Berikutnya
        </Button>
      </div>
    </nav>
  );
}
