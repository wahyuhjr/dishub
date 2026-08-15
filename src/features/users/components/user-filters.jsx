'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_VALUES } from '@/features/users/schema';

const ALL = '__all__';

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  MASTER: 'Master',
  OPERATOR: 'Operator',
  VIEWER: 'Viewer',
};

/** Search + role + active/inactive filter bar for /dashboard/user. */
export function UserFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');

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

  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (search === current) return;
    const timeout = setTimeout(() => updateParam('q', search), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4" aria-busy={isPending}>
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <Label htmlFor="user-search">Cari</Label>
        <Input
          id="user-search"
          placeholder="Username atau nama lengkap..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-role">Role</Label>
        <Select defaultValue={searchParams.get('role') ?? ALL} onValueChange={(v) => updateParam('role', v)}>
          <SelectTrigger id="user-role" className="w-44" aria-label="Filter role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua Role</SelectItem>
            {ROLE_VALUES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-active">Status</Label>
        <Select defaultValue={searchParams.get('active') ?? ALL} onValueChange={(v) => updateParam('active', v)}>
          <SelectTrigger id="user-active" className="w-40" aria-label="Filter status aktif">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="inactive">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="button" variant="ghost" onClick={() => { setSearch(''); startTransition(() => router.push(pathname)); }}>
        Reset Filter
      </Button>
    </div>
  );
}

export { ROLE_LABELS };
