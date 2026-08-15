'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserRowActions } from './user-row-actions';
import { ROLE_LABELS } from './user-filters';

function SortableHeader({ column, label, className }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSort = searchParams.get('sort') ?? 'created_at';
  const activeDir = searchParams.get('dir') ?? 'desc';
  const isActive = activeSort === column;
  const nextDir = isActive && activeDir === 'asc' ? 'desc' : 'asc';

  function toggleSort() {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', column);
    params.set('dir', nextDir);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  }

  const Icon = isActive ? (activeDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={toggleSort}
        className="inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Urutkan berdasarkan ${label}`}
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    </TableHead>
  );
}

const ROLE_BADGE_CLASSNAMES = {
  ADMIN:    'border-red-300    bg-red-50    text-red-700    font-semibold',
  MASTER:   'border-purple-300 bg-purple-50 text-purple-700',
  OPERATOR: 'border-blue-300   bg-blue-50   text-blue-700',
  VIEWER:   'border-slate-300  bg-slate-100 text-slate-500',
};

function initials(user) {
  const source = user.full_name || user.username || '?';
  return source.trim().slice(0, 2).toUpperCase();
}

function formatWib(value) {
  if (!value) return 'Belum pernah';
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm', { locale: idLocale });
  } catch {
    return '—';
  }
}

export function UsersTable({ rows, currentUserId }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader column="username" label="User" />
            <SortableHeader column="role" label="Role" className="w-[120px]" />
            <SortableHeader column="is_active" label="Status" className="w-[110px]" />
            <SortableHeader column="last_login_at" label="Login Terakhir" className="w-[170px]" />
            <TableHead className="w-px">
              <span className="sr-only">Aksi</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-16 text-center text-sm text-muted-foreground">
                Tidak ada user yang cocok.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8 shrink-0">
                      {user.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
                      <AvatarFallback className="text-xs">{initials(user)}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                      <span className="max-w-[180px] truncate font-medium" title={user.full_name || user.username}>
                        {user.full_name || user.username}
                      </span>
                      <span className="max-w-[180px] truncate text-xs text-muted-foreground">@{user.username}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={ROLE_BADGE_CLASSNAMES[user.role] ?? 'border-border text-muted-foreground'}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.is_active ? (
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">Aktif</Badge>
                  ) : (
                    <Badge variant="outline" className="border-red-300 bg-red-50 text-red-600">Nonaktif</Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatWib(user.last_login_at)}</TableCell>
                <TableCell>
                  <UserRowActions user={user} currentUserId={currentUserId} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
