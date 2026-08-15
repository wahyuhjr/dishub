'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MESSAGE_TYPE_LABELS, STATUS_LABELS } from '@/features/reports/filters';

const ALL = '__all__';

/**
 * Report filter bar for /dashboard/laporan. Reads/writes URL search
 * params so the active report is shareable/bookmarkable and survives a
 * refresh — and so the export links can reuse the exact same params
 * (server-side, RLS-scoped export).
 */
export function ReportFilters({ operators, stations }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = useCallback(
    (key, value) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === ALL) params.delete(key);
      else params.set(key, value);
      params.set('page', '1');
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [pathname, router, searchParams]
  );

  function resetFilters() {
    startTransition(() => router.push(pathname));
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4" aria-busy={isPending}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-from">Dari Tanggal</Label>
        <Input
          id="report-from"
          type="date"
          className="w-40"
          defaultValue={searchParams.get('from') ?? ''}
          onChange={(e) => updateParam('from', e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-to">Sampai Tanggal</Label>
        <Input
          id="report-to"
          type="date"
          className="w-40"
          defaultValue={searchParams.get('to') ?? ''}
          onChange={(e) => updateParam('to', e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-type">Jenis Berita</Label>
        <Select defaultValue={searchParams.get('type') ?? ALL} onValueChange={(v) => updateParam('type', v)}>
          <SelectTrigger id="report-type" className="w-44" aria-label="Filter jenis berita">
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
        <Label htmlFor="report-status">Status Relay</Label>
        <Select defaultValue={searchParams.get('status') ?? ALL} onValueChange={(v) => updateParam('status', v)}>
          <SelectTrigger id="report-status" className="w-48" aria-label="Filter status relay">
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
        <Label htmlFor="report-operator">Operator</Label>
        <Select defaultValue={searchParams.get('operator') ?? ALL} onValueChange={(v) => updateParam('operator', v)}>
          <SelectTrigger id="report-operator" className="w-44" aria-label="Filter operator">
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
        <Label htmlFor="report-station">Stasiun</Label>
        <Select defaultValue={searchParams.get('station') ?? ALL} onValueChange={(v) => updateParam('station', v)}>
          <SelectTrigger id="report-station" className="w-44" aria-label="Filter stasiun">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua Stasiun</SelectItem>
            {stations.map((st) => (
              <SelectItem key={st.id} value={st.id}>
                {st.station_name || st.station_code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="button" variant="ghost" onClick={resetFilters}>
        Reset Filter
      </Button>
    </div>
  );
}
