import { RadioTower } from "lucide-react";
import LoginForm from "./login-form";
import Image from "next/image";

// Public route (see proxy.js PUBLIC_PATHS). Two-column layout: a
// permanently-dark institutional identity panel on the left (same
// dark-panel tokens as the sidebar — gradient + glowing primary
// radio-tower focal point), light content-theme login card on the
// right — see globals.css.
export default function LoginPage() {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-2">
      <div className="relative hidden flex-col items-center justify-center gap-6 overflow-hidden bg-gradient-to-br from-dark-panel to-dark-panel-end px-12 lg:flex">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 40%, rgba(59,130,246,0.25), transparent 60%)",
          }}
          aria-hidden="true"
        />

        <div className="relative flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-4">
            <Image src="/dishub.svg" alt="" width={120} height={120} />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest text-dark-panel-secondary uppercase">
              Kementerian Perhubungan
            </p>
            <h1 className="mt-2 max-w-sm text-2xl font-bold tracking-tight text-dark-panel-foreground">
              Digital Relay Berita Bahaya &amp; Notice To Marine
            </h1>
            <p className="mt-3 max-w-sm text-sm text-dark-panel-secondary">
              Distrik Navigasi Tipe A Kelas III Merauke
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Digital Relay Berita Bahaya
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Notice To Marine &middot; Distrik Navigasi Merauke
            </p>
          </div>

          <div className="mb-6 hidden text-center lg:block">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Masuk ke Akun Anda
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gunakan kredensial internal Anda untuk melanjutkan.
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-surface p-8">
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-xs text-faint">
            Akses internal. Hubungi administrator jika belum memiliki akun.
          </p>
        </div>
      </div>
    </main>
  );
}
