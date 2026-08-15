'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NTM_STATUS_LABELS } from '@/features/ntm/status-machine';

const ALL = '__all__';

/**
 * Filter bar for /dashboard/ntm — filters by NTM number, edisi, tanggal
 * terbit (published date range), status, and pembuat (creator). Reads/
 * writes the URL's search params so filters are shareable/bookmarkable.
 */
export function NtmFilters({ creators }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [ntmNumber, setNtmNumber] = useState(searchParams.get('ntm_number') ?? '');
  const [edition, setEdition] = useState(searchParams.get('edition') ?? '');

  useEffect(() => {
    setNtmNumber(searchParams.get('ntm_number') ?? '');
    setEdition(searchParams.get('edition') ?? '');
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

  useEffect(() => {
    const current = searchParams.get('ntm_number') ?? '';
    if (ntmNumber === current) return;
    const timeout = setTimeout(() => updateParam('ntm_number', ntmNumber), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ntmNumber]);

  useEffect(() => {
    const current = searchParams.get('edition') ?? '';
    if (edition === current) return;
    const timeout = setTimeout(() => updateParam('edition', edition), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edition]);

  function resetFilters() {
    startTransition(() => {
      router.push(pathname);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4" aria-busy={isPending}>
      <div className="flex min-w-40 flex-col gap-1.5">
        <Label htmlFor="ntm-filter-number">Nomor NTM</Label>
        <Input id="ntm-filter-number" value={ntmNumber} onChange={(e) => setNtmNumber(e.target.value)} />
      </div>

      <div className="flex min-w-32 flex-col gap-1.5">
        <Label htmlFor="ntm-filter-edition">Edisi</Label>
        <Input id="ntm-filter-edition" value={edition} onChange={(e) => setEdition(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ntm-filter-status">Status</Label>
        <Select defaultValue={searchParams.get('status') ?? ALL} onValueChange={(v) => updateParam('status', v)}>
          <SelectTrigger id="ntm-filter-status" className="w-44" aria-label="Filter status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua Status</SelectItem>
            {Object.entries(NTM_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ntm-filter-creator">Pembuat</Label>
        <Select defaultValue={searchParams.get('creator') ?? ALL} onValueChange={(v) => updateParam('creator', v)}>
          <SelectTrigger id="ntm-filter-creator" className="w-44" aria-label="Filter pembuat">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua Pembuat</SelectItem>
            {creators.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.full_name ?? c.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ntm-filter-published-from">Terbit Dari</Label>
        <Input
          id="ntm-filter-published-from"
          type="date"
          defaultValue={searchParams.get('published_from') ?? ''}
          onChange={(e) => updateParam('published_from', e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ntm-filter-published-to">Terbit Sampai</Label>
        <Input
          id="ntm-filter-published-to"
          type="date"
          defaultValue={searchParams.get('published_to') ?? ''}
          onChange={(e) => updateParam('published_to', e.target.value)}
        />
      </div>

      <Button type="button" variant="ghost" onClick={resetFilters}>
        Reset Filter
      </Button>
    </div>
  );
}
