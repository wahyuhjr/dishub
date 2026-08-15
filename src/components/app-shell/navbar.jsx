import { Anchor, Bell, Search } from 'lucide-react';
import Image from 'next/image';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Breadcrumbs } from './breadcrumbs';
import { UserMenu } from './user-menu';

export function Navbar({ user }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 bg-background px-4 md:px-6">
      <SidebarTrigger aria-label="Buka/tutup sidebar navigasi" className="-ml-1" />

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <Image src="/dishub.svg" alt="" width={32} height={32} />
          <span className="hidden text-sm font-semibold sm:inline">
            Digital Relay Berita Bahaya &amp; NTM
          </span>
        </div>
        <nav aria-label="Breadcrumb" className="min-w-0">
          <Breadcrumbs />
        </nav>

        <div className="relative ml-auto hidden w-full max-w-xs md:block">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            placeholder="Cari berita, stasiun..."
            aria-label="Pencarian"
            className="w-full rounded-full border border-border/60 bg-surface py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-faint outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <button
        type="button"
        aria-label="Notifikasi"
        className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        <Bell className="size-4.5" aria-hidden="true" />
        <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-danger" aria-hidden="true" />
      </button>

      <UserMenu user={user} />
    </header>
  );
}
