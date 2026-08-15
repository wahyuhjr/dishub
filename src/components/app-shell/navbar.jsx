import { Anchor, Bell, Search } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Breadcrumbs } from './breadcrumbs';
import { UserMenu } from './user-menu';

/**
 * Navbar: Kemenhub logo, system name, breadcrumb, a decorative search
 * bar, a notification bell, and the user profile dropdown. Server
 * Component — the interactive bits (SidebarTrigger, Breadcrumbs,
 * UserMenu) are themselves Client Components, composed here.
 *
 * Background matches the page body (bg-background, no border) per the
 * dark minimalist design system — layers are told apart by tone, not by
 * hard borders.
 *
 * NOTE: the search bar and notification bell are presentational only —
 * there is no global search or notifications backend yet. Wire them up
 * once those features exist rather than faking behavior here.
 *
 * NOTE: the official Kemenhub logo image isn't bundled in this repo (no
 * license to redistribute it here) — replace the placeholder mark below
 * with `public/logo-kemenhub.svg` (via next/image) once the asset is
 * available.
 */
export function Navbar({ user }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 bg-background px-4 md:px-6">
      <SidebarTrigger aria-label="Buka/tutup sidebar navigasi" className="-ml-1" />

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <span
            className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
            role="img"
            aria-label="Logo Kementerian Perhubungan"
          >
            <Anchor className="size-4" aria-hidden="true" />
          </span>
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
