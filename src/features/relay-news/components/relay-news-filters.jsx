'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MESSAGE_TYPE_LABELS, STATUS_LABELS } from '@/features/relay-news/status-machine';

const ALL = '__all__';

/**
 * Search + filter bar for /dashboard/relay-news. Reads/writes the URL's
 * search params directly (the Server Component page reads them back) so
 * filters are shareable/bookmarkable and survive a refresh.
 */
export function RelayNewsFilters({ operators }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    setSearch(searchParams.get('q') ?? '');
  }, [searchParams]);

  const updateParam = useCallback(
    (key, value) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === ALL) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      params.set('page', '1');
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  // Debounce the free-text search so we don't navigate on every keystroke.
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (search === current) return;
    const timeout = setTimeout(() => updateParam('q', search), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function resetFilters() {
    startTransition(() => {
      router.push(pathname);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4" aria-busy={isPending}>
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <Label htmlFor="relay-news-search">Cari</Label>
        <Input
          id="relay-news-search"
          placeholder="Nomor, judul, atau isi berita..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-type">Jenis Berita</Label>
        <Select defaultValue={searchParams.get('type') ?? ALL} onValueChange={(v) => updateParam('type', v)}>
          <SelectTrigger id="filter-type" className="w-40" aria-label="Filter jenis berita">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua Jenis</SelectItem>
            {Object.entries(MESSAGE_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-status">Status</Label>
        <Select defaultValue={searchParams.get('status') ?? ALL} onValueChange={(v) => updateParam('status', v)}>
          <SelectTrigger id="filter-status" className="w-44" aria-label="Filter status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-operator">Operator</Label>
        <Select defaultValue={searchParams.get('operator') ?? ALL} onValueChange={(v) => updateParam('operator', v)}>
          <SelectTrigger id="filter-operator" className="w-44" aria-label="Filter operator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua Operator</SelectItem>
            {operators.map((op) => (
              <SelectItem key={op.id} value={op.id}>
                {op.full_name || op.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-from">Dari Tanggal</Label>
        <Input
          id="filter-from"
          type="date"
          className="w-40"
          defaultValue={searchParams.get('from') ?? ''}
          onChange={(e) => updateParam('from', e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-to">Sampai Tanggal</Label>
        <Input
          id="filter-to"
          type="date"
          className="w-40"
          defaultValue={searchParams.get('to') ?? ''}
          onChange={(e) => updateParam('to', e.target.value)}
        />
      </div>

      <Button type="button" variant="ghost" onClick={resetFilters}>
        Reset Filter
      </Button>
    </div>
  );
}
