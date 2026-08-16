import Link from 'next/link';
import Image from 'next/image';
import { RadioTower, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listPublicMessages, PUBLIC_PAGE_SIZE } from '@/features/relay-news/dal';
import { PublicNewsCard } from '@/features/relay-news/components/public-news-card';

// Public route (see proxy.js PUBLIC_PATHS) — no login required. Lists
// every berita that has left DRAFT/PENDING_VERIFICATION (enforced by the
// maritime_messages_select_public RLS policy, not just this query — see
// supabase/migrations/20260816100000_public_relay_news_homepage.sql).
export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params?.page) || 1);
  const { rows, total } = await listPublicMessages({ page });
  const totalPages = Math.max(1, Math.ceil(total / PUBLIC_PAGE_SIZE));

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/dishub.svg" alt="" width={36} height={36} />
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground">
                Digital Relay Berita Bahaya &amp; Notice To Marine
              </p>
              <p className="text-xs text-muted-foreground">Distrik Navigasi Tipe A Kelas III Merauke</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Masuk</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-2">
          <Newspaper className="size-5 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Berita Bahaya Terkini</h1>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
            <RadioTower className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Belum ada berita yang dipublikasikan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((message) => (
              <PublicNewsCard key={message.id} message={message} />
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link href={`/?page=${page - 1}`} aria-disabled={page <= 1}>
                Sebelumnya
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground">
              Halaman {page} dari {totalPages}
            </span>
            <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
              <Link href={`/?page=${page + 1}`} aria-disabled={page >= totalPages}>
                Berikutnya
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
