# Arsitektur Aplikasi — Digital Relay Berita Bahaya (Notice To Marine / NTM)
Distrik Navigasi Tipe A Kelas III Merauke

Status dokumen: **Draft v2 — sudah memasukkan keputusan hasil klarifikasi** (Tahap Perencanaan — belum ada implementasi fitur)
Terakhir diperbarui: 2026-08-13

> **Keputusan terkonfirmasi (hasil sesi klarifikasi)**: (1) Format nomor NTM dirancang bebas oleh sistem (bukan mengikuti format baku eksternal); (2) Relay MVP = pencatatan manual saja (tanpa integrasi gateway otomatis di fase awal); (3) **Aplikasi harus multi-tenant sejak awal** (mendukung banyak Distrik Navigasi, bukan hanya Merauke) — ini mengubah beberapa keputusan arsitektur signifikan dibanding draft awal, lihat §4a & bagian yang ditandai **[MULTI-TENANT]**; (4) Hosting: Vercel + Supabase Cloud; (5) **Bahasa: JavaScript murni (bukan TypeScript)** — seluruh referensi `.ts`/`.tsx`/`tsconfig.json` di draft sebelumnya diganti `.js`/`.jsx`/`jsconfig.json`, lihat catatan di §3, §8, §9. Dokumen di bawah sudah direvisi mengikuti keputusan ini.

> Catatan penting terkait stack: Next.js yang terpasang di repo ini adalah **v16.3.0**. Versi ini membawa perubahan konvensi dibanding pengetahuan umum tentang Next.js (mis. `middleware.ts` → `proxy.ts`, model caching baru "Cache Components" via `"use cache"`, `params`/`searchParams` async, `refresh()` dari `next/cache`, dsb). Seluruh keputusan arsitektur di bawah ini sudah disesuaikan dengan dokumentasi resmi versi ini (`node_modules/next/dist/docs`), bukan asumsi versi lama.

---

## 1. Analisis Requirement

### 1.1 Domain
Distrik Navigasi bertanggung jawab atas keselamatan pelayaran di wilayah kerjanya, mencakup:

- **Berita Bahaya**: laporan bahaya navigasi (kerusakan Sarana Bantu Navigasi Pelayaran/SBNP, bangkai kapal, pendangkalan, objek terapung, kegiatan pengerukan, dsb.) yang masuk dari kapal, syahbandar, stasiun radio pantai, atau petugas lapangan.
- **Notice to Marine (NTM)**: dokumen resmi bernomor yang diterbitkan berdasarkan berita bahaya (atau informasi lain), berisi peringatan navigasi ke pelaut, dengan status berlaku/berakhir dan wilayah koordinat tertentu. NTM harus **publik** (dapat diakses pelaut/kapal tanpa login).
- **Relay Berita**: penerusan/broadcast NTM & berita bahaya melalui berbagai kanal (radio SSB/VHF, NAVTEX, e-mail, faksimile, WhatsApp/SMS gateway, forward ke Distrik Navigasi/instansi lain) dengan pencatatan status kirim & acknowledgement.
- **Monitoring Status Sistem**: pemantauan kondisi aset SBNP (menara suar, rambu suar, pelampung, dll.) dan infrastruktur pendukung (radio, genset, jaringan) secara near-real-time.
- **Pelaporan**: laporan periodik (harian/bulanan/tahunan) untuk pimpinan/Ditjen Hubla — statistik berita bahaya, NTM aktif, status SBNP, performa relay.

### 1.2 Sifat Kritis
- Ini adalah aplikasi **keselamatan pelayaran** → data harus akurat, auditable, dan tidak boleh hilang. Semua perubahan status (approve/publish/cabut) wajib tercatat di audit trail.
- NTM yang sudah **published** bersifat *append-only* secara semantik (revisi harus berupa NTM baru/amendemen yang mereferensikan NTM lama, bukan edit diam-diam).
- Publikasi NTM harus **tersedia publik** (tanpa login) karena dikonsumsi oleh pelaut/kapal, sementara proses pembuatan/verifikasi bersifat internal dan berbasis peran (RBAC).

### 1.3 Non-fungsional
- Scalable & maintainable (modular, feature-based).
- **Multi-tenant**: satu instalasi aplikasi harus dapat melayani banyak Distrik Navigasi (bukan hanya Merauke), dengan isolasi data antar-tenant dan kemungkinan peran lintas-tenant (mis. pengawasan dari Ditjen Hubla Pusat).
- Kemungkinan koneksi terbatas di lokasi terpencil/stasiun pantai → perlu strategi resiliency (retry, optimistic UI, kemungkinan mode offline-terbatas).
- Auditabilitas & keamanan data tinggi (instansi pemerintah).
- **JavaScript murni** (bukan TypeScript) dengan disiplin validasi runtime via Zod di setiap boundary (Server Action, Route Handler) untuk mengkompensasi tidak adanya type-checking statis; testable (unit + e2e).

---

## 2. Modul-Modul Utama

| # | Modul | Ringkasan |
|---|-------|-----------|
| 1 | **Auth & Manajemen Pengguna** | Login, sesi, RBAC, manajemen akun pegawai, unit kerja/seksi |
| 2 | **Berita Bahaya** | Intake, workflow verifikasi/persetujuan, lampiran, riwayat |
| 3 | **Notice to Marine (NTM)** | Penomoran resmi, penerbitan, masa berlaku, pencabutan/amendemen, feed publik |
| 4 | **Relay Komunikasi** | Multi-channel relay, tujuan (stasiun/kapal/instansi), status kirim & ack |
| 5 | **Monitoring SBNP & Sistem** | Registry aset, status operasional realtime, riwayat pemeliharaan |
| 6 | **Pelaporan & Analitik** | Dashboard, laporan periodik, export PDF/XLSX |
| 7 | **Master Data** | Wilayah kerja, kategori bahaya, daftar penerima relay, jenis aset SBNP |
| 8 | **Audit Trail & Notifikasi** | Log aktivitas, notifikasi in-app untuk perubahan status penting |

Modul 3 (NTM) adalah satu-satunya modul dengan **permukaan publik** (public read surface); modul lain sepenuhnya internal/terautentikasi.

Seluruh modul di atas beroperasi **dalam konteks satu tenant** (satu Distrik Navigasi) kecuali peran `PUSAT_ADMIN`/`PUSAT_VIEWER` yang dapat melihat lintas-tenant untuk keperluan pengawasan pusat (lihat §4a).

---

## 3. Batasan Server Component / Client Component / Server Action / Route Handler / Service Layer

Prinsip umum: **default ke Server Component**, gunakan Client Component seminimal mungkin (hanya untuk interaktivitas), dan **semua akses data + otorisasi terjadi di server** (Data Access Layer), sesuai rekomendasi resmi Next.js untuk proyek baru ("Data Access Layer" pattern di `guides/data-security`).

| Layer | Tanggung jawab | Lokasi | Aturan |
|---|---|---|---|
| **Server Component** | Fetch data awal halaman, render UI non-interaktif, compose layout | `app/**/page.jsx`, `layout.jsx` | Tidak pernah memanggil Supabase langsung — selalu lewat fungsi DAL (`src/server/dal/*`). Tidak menerima/melempar secret ke Client Component. |
| **Client Component** | State lokal, interaktivitas (form, filter tabel, chart, modal, realtime subscription UI) | file dengan `"use client"` di baris pertama, umumnya di `src/features/*/components` | Tidak pernah mengakses Supabase dengan service-role key. Hanya memakai Supabase browser client (anon key + RLS) untuk kebutuhan realtime subscription; mutasi data tetap lewat Server Action. |
| **Server Action** (`"use server"`) | Mutasi data (create/update/delete), validasi Zod, re-check otorisasi, revalidate/refresh | `src/features/*/actions.js` | **Wajib** memvalidasi input dengan Zod dan memverifikasi sesi + role di awal fungsi (defense-in-depth — Server Action dapat dipanggil langsung via POST, bukan hanya dari UI). Memanggil service layer, tidak menulis query SQL langsung di action. |
| **Route Handler** (`route.js`) | Endpoint publik non-HTML: feed NTM publik (`/api/ntm/feed`, RSS/JSON), export PDF/XLSX, webhook (mis. Supabase Auth hooks), health-check | `src/app/api/**/route.js` | Dipakai hanya jika: (a) perlu diakses tanpa sesi Next (mis. integrasi eksternal/NAVTEX), (b) perlu content-type non-HTML, (c) perlu dipanggil dari luar (mobile/pihak ketiga di masa depan). Selain itu, gunakan Server Action. |
| **Service Layer** | Aturan bisnis (transisi status workflow, penomoran NTM, orkestrasi relay, kalkulasi laporan) | `src/server/services/*` | Tidak tahu tentang HTTP/Next — murni fungsi JavaScript agar mudah di-unit-test (Vitest) tanpa mocking Next runtime. Bentuk data didokumentasikan via JSDoc `@typedef` (opsional, untuk intellisense editor), bukan tipe statis. |
| **Data Access Layer (DAL)** | Query Supabase + mapping ke DTO aman (tanpa field sensitif), caching in-request via `react cache()` | `src/server/dal/*` | Satu-satunya lapisan yang membuat Supabase server client & menjalankan query. Melakukan **authorization check** (bukan hanya RLS) sebelum mengembalikan data ke pemanggil. |
| **`proxy.js`** (pengganti `middleware.js` di Next 16) | Refresh sesi Supabase (cookie) di setiap request, redirect optimistik user belum login | root `proxy.js` | Hanya optimistic check (sesuai dokumentasi resmi: proxy bukan pengganti otorisasi penuh) — keputusan otorisasi final tetap di DAL/Server Action + RLS. |

Ringkas alur: `Page (Server Component)` → `DAL` (baca) / `Server Action` → `Service` → `DAL`/Supabase client (tulis) → RLS Postgres sebagai lapisan pertahanan terakhir.

Setiap pemanggilan DAL/Service **wajib membawa `tenant_id` dari sesi user yang login** (bukan dari input client) untuk mencegah *tenant confusion/IDOR* lintas-Distrik Navigasi — lihat §4a.

---

## 4. Strategi Autentikasi & Otorisasi

### 4.1 Autentikasi
- **Supabase Auth** (email + password) dengan `@supabase/ssr` untuk sinkronisasi cookie sesi antara Server Component, Server Action, dan Route Handler.
- `proxy.js` bertugas memanggil `supabase.auth.getUser()`/refresh token pada setiap request agar cookie sesi selalu valid, dan melakukan redirect optimistik ke `/login` untuk rute terproteksi jika belum ada sesi.
- Tidak ada self sign-up publik — akun dibuat oleh Admin (pegawai instansi), sesuai konteks aplikasi internal pemerintahan. Reset password via email Supabase Auth.
- Opsional (perlu klarifikasi): SSO/integrasi dengan sistem kepegawaian (mis. SIMPEG/SSO Kemenhub).

### 4.2 Otorisasi (RBAC)
- Tabel `profiles` (1:1 dengan `auth.users`) menyimpan `role`, `unit_kerja_id`, **`tenant_id`** (nullable — null hanya untuk peran pusat lintas-tenant), `status_aktif`.
- Peran **tenant-scoped** (usulan awal, perlu konfirmasi struktur organisasi riil per Distrik Navigasi):
  - `TENANT_ADMIN` — admin lokal per Distrik Navigasi: kelola user & master data di tenant-nya saja.
  - `KEPALA_KANTOR` — approve NTM final, lihat semua laporan di tenant-nya.
  - `KEPALA_SEKSI` (mis. Seksi Sarana/Operasi) — verifikasi berita bahaya, approve tingkat seksi.
  - `PETUGAS_OPERASIONAL` — input berita bahaya, eksekusi relay, update status.
  - `PETUGAS_TEKNIS` — kelola registry & status SBNP.
  - `VERIFIKATOR` — cek kelengkapan/validitas sebelum ke tahap approval.
  - `VIEWER_INTERNAL` — hanya baca (mis. auditor, staf lain) di tenant-nya.
- Peran **lintas-tenant (global, `tenant_id = null`)**:
  - `SUPER_ADMIN` — provisioning tenant baru, kelola seluruh sistem (operasional pengembang/pusat IT).
  - `PUSAT_VIEWER` (opsional, mis. Ditjen Hubla) — hanya baca lintas semua tenant untuk pengawasan/rekap nasional.
  - *(Publik/anonim, tanpa akun)* — hanya baca NTM berstatus `published`, difilter per-tenant sesuai konteks yang diakses.
- **Custom claims di JWT** direkomendasikan: gunakan Supabase Auth Hook ("Customize Access Token") untuk menyisipkan `role` **dan `tenant_id`** ke JWT, sehingga RLS policy bisa membaca `auth.jwt() ->> 'role'` & `auth.jwt() ->> 'tenant_id'` tanpa join tambahan (lebih cepat, menghindari recursive RLS lookup, dan jadi mekanisme utama isolasi antar-tenant).
- Setiap Server Action & fungsi DAL **wajib** memverifikasi role **dan tenant_id** secara eksplisit di kode (defense-in-depth), tidak bergantung 100% pada RLS — sesuai panduan resmi Next.js: *"Server Functions are reachable via direct POST requests... always verify authentication and authorization inside every Server Function."* Ini penting khusus di konteks multi-tenant untuk mencegah IDOR lintas-tenant (mis. user tenant A mengirim `id` milik tenant B).
- Alur workflow (state machine) untuk Berita Bahaya → NTM ditegakkan di **service layer**, bukan hanya di UI: `draft → diajukan → diverifikasi → disetujui → diterbitkan (NTM published) → (relay) → berakhir/dicabut`. Transisi tidak sah ditolak di service layer meski request datang langsung ke Server Action.

---

## 4a. Strategi Multi-Tenant [MULTI-TENANT]

### Model isolasi data
- Tenant = **satu Distrik Navigasi** (mis. Merauke, Sorong, dst). Entitas baru `distrik_navigasi` (tenant) menjadi root dari seluruh data operasional: `unit_kerja` → `distrik_navigasi_id`; dan setiap tabel transaksional (`berita_bahaya`, `ntm`, `relay_logs`, `sbnp_assets`, dst.) memiliki kolom `tenant_id` langsung (denormalisasi dari `unit_kerja`) agar RLS bisa memfilter tanpa join berlapis — trade-off disengaja demi kecepatan & kesederhanaan policy.
- **Penomoran NTM per-tenant**: karena format bebas dirancang sistem, `nomor_ntm` unik per **(tenant_id, tahun)**, bukan unik global — setiap Distrik Navigasi punya urutan nomornya sendiri (constraint: `unique (tenant_id, tahun, nomor_ntm)`).
- Seorang user (kecuali peran global) hanya terdaftar di **satu tenant**. Tidak ada dukungan multi-tenant-per-user di versi awal (bisa jadi kebutuhan lanjutan jika ada pegawai rotasi/pusat yang mengawasi 2+ distrik tertentu saja, bukan semua).

### Tenant resolution (bagaimana request tahu "ini tenant mana")
Dua opsi, **direkomendasikan opsi (a)**:

- **(a) Subdomain per tenant** — mis. `merauke.ntm-hubla.go.id`, `sorong.ntm-hubla.go.id`. `proxy.js` membaca `request.headers.get('host')`, memetakan subdomain → `tenant_id` (via cache lookup, bukan query DB setiap request — di-cache di edge/memory dengan TTL pendek), lalu meneruskan `tenant_id` lewat header internal ke Server Component. Cocok untuk instansi pemerintah yang biasanya sudah terbiasa dengan penamaan subdomain per unit kerja, dan lebih tegas secara branding/URL per kantor. Vercel mendukung wildcard domain untuk kasus ini.
- **(b) Path-based** (`/d/merauke/...`) — lebih sederhana dari sisi DNS/SSL (tidak perlu wildcard domain), tapi URL publik NTM jadi kurang "resmi" terasa dan berpotensi ambigu dengan route Next.js lain.

> Untuk **halaman/route publik NTM** (§7.2, tanpa login), tenant tetap wajib eksplisit di URL (baik lewat subdomain atau path) karena publik tidak punya sesi untuk menyimpan konteks tenant.
> Untuk **area login/dashboard internal**, setelah login, `tenant_id` user diambil dari JWT — tidak perlu berasal dari URL lagi (mencegah user mengganti tenant lewat URL manipulation).

### Provisioning tenant baru
- Dilakukan oleh `SUPER_ADMIN` lewat modul admin lintas-tenant terpisah (bukan bagian dari dashboard tenant biasa): buat baris `distrik_navigasi`, buat akun `TENANT_ADMIN` pertama, (jika opsi subdomain) daftarkan subdomain.

### Dampak ke skema & folder
- §6 (skema DB) & §8 (struktur folder) di bawah sudah direvisi mengikuti model ini.

---

## 5. Strategi RLS Supabase

Prinsip: **RLS aktif di semua tabel** sebagai pertahanan lapis basis data; DAL/service layer sebagai pertahanan lapis aplikasi. Tidak ada akses langsung dari Client Component ke tabel sensitif memakai service-role key. Di konteks multi-tenant, **isolasi tenant adalah lapisan RLS pertama** sebelum cek role.

Pola umum:

```sql
-- Helper disimpan sbg SQL function, security definer/stable, dipakai di banyak policy
create or replace function auth_role() returns text
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', 'anon')
$$;

create or replace function auth_tenant_id() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid
$$;

create or replace function is_global_role() returns boolean
language sql stable as $$
  select auth_role() in ('SUPER_ADMIN', 'PUSAT_VIEWER')
$$;
```

- **`distrik_navigasi`** (tabel tenant): `SELECT` hanya untuk peran global (`SUPER_ADMIN`/`PUSAT_VIEWER`) atau user yang `tenant_id`-nya cocok (untuk menampilkan identitas kantornya sendiri). `INSERT`/`UPDATE` hanya `SUPER_ADMIN`.
- **`ntm`**
  - `SELECT` untuk role `anon` & authenticated non-global: hanya baris `status = 'published' AND tenant_id = <tenant dari konteks request>` (untuk anon, tenant ditentukan dari subdomain/path publik, bukan dari sesi).
  - `SELECT` penuh (semua status) untuk role internal **dalam tenant_id yang sama** dengan user (mis. draft hanya terlihat oleh pembuat, seksi terkait, dan approver di tenant tersebut); peran global bisa lihat lintas-tenant (khusus published, untuk `PUSAT_VIEWER`).
  - `INSERT`/`UPDATE` hanya untuk role `PETUGAS_OPERASIONAL`+ ke atas **dan `tenant_id` baris = tenant_id user**, dan hanya kolom-kolom tertentu per status (mis. `PETUGAS_OPERASIONAL` tidak boleh mengubah baris berstatus `published`).
  - Tidak ada `DELETE` fisik — pencabutan = `status = 'cancelled'` (soft, auditable). `DELETE` policy sengaja tidak dibuat (default deny).
- **`berita_bahaya`**: `SELECT`/`UPDATE` dibatasi ke `tenant_id` user + unit kerja pembuat + role approver/admin; publik tidak punya akses sama sekali (tabel ini internal, tidak ada exception lintas-tenant).
- **`relay_logs`**: `SELECT`/`INSERT` untuk role operasional ke atas **dalam tenant & unit yang sama**; tidak ada akses publik/anon maupun lintas-tenant.
- **`sbnp_assets` & `sbnp_status_logs`**: baca oleh seluruh internal **di tenant yang sama** (lintas seksi butuh visibilitas, tapi tidak lintas-tenant); tulis hanya `PETUGAS_TEKNIS`/admin tenant tersebut. Status **ringkasan** (bukan detail teknis) dapat diekspos ke halaman publik "status layanan" per-tenant jika suatu saat dibutuhkan (via view terpisah, bukan expose tabel asli).
- **`profiles`**: user hanya bisa `SELECT`/`UPDATE` baris miliknya sendiri (kolom terbatas); `TENANT_ADMIN` bisa kelola user **dalam tenant_id yang sama saja**; hanya `SUPER_ADMIN` bisa mengelola lintas-tenant (lewat Server Action dengan service-role client, bukan lewat RLS langsung).
- **`audit_logs`**: `INSERT`-only dari server (service-role, via trigger atau service layer), `SELECT` dibatasi `tenant_id` yang sama (kecuali peran global). Tidak ada `UPDATE`/`DELETE` policy sama sekali (immutable).
- **Storage (lampiran, PDF NTM)**: bucket privat untuk lampiran berita bahaya (RLS Storage berbasis path `tenant/{tenant_id}/unit/{unit_id}/...`), bucket **publik read-only** khusus untuk dokumen PDF NTM yang sudah `published`, path tetap disertakan `tenant/{tenant_id}/...` agar mudah diaudit per-tenant meski bucket-nya publik.

Keputusan kunci: **service-role key hanya dipakai di server** (Route Handler/Server Action tertentu yang butuh bypass RLS terkontrol, mis. provisioning tenant baru oleh `SUPER_ADMIN`), **tidak pernah** di Client Component maupun diekspos ke bundle browser.

---

## 6. Skema Database Tingkat Tinggi (ERD Teks)

```
distrik_navigasi (TENANT ROOT)                          <── [MULTI-TENANT]
   │ 1:N
   ▼
unit_kerja (seksi/stasiun, milik 1 tenant)
   ▲
   │ 1:N
auth.users (Supabase managed)
   │ 1:1
   ▼
profiles (tenant_id, unit_kerja_id, role) ─────────────< (semua tabel di bawah ikut bawa tenant_id)
   │
   │ 1:N (dibuat_oleh)
   ▼
berita_bahaya (tenant_id) ──────< berita_bahaya_lampiran (storage refs)
   │
   │ 1:1 / 1:N (opsional amendemen)
   ▼
ntm (tenant_id) ───────< ntm_area_koordinat (titik/polygon wilayah bahaya)
   │
   │ 1:N
   ▼
relay_logs (tenant_id) >──────── relay_recipients (master: stasiun/kapal/instansi, tenant_id)

sbnp_assets (tenant_id) ───1:N──> sbnp_status_logs

laporan (tenant_id, metadata laporan yang digenerate)

audit_logs (tenant_id, generic: entity_type, entity_id, actor_id, before/after)

notifications (user_id, judul, isi, tipe, dibaca)
```

### Ringkasan kolom penting per entitas

- **distrik_navigasi** *(tenant root)*: id, kode (mis. `MRK` untuk Merauke, dipakai di subdomain/path), nama, alamat, zona_waktu, status_aktif, created_at.
- **profiles**: id (=auth.users.id), **tenant_id** (nullable untuk peran global), nama, nip, jabatan, role, unit_kerja_id, status_aktif, created_at.
- **unit_kerja**: id, **tenant_id**, nama, jenis (seksi/stasiun_pantai), induk_id (self-reference, opsional hierarki).
- **berita_bahaya**: id, **tenant_id**, nomor_internal, kategori, judul, deskripsi, lokasi (lat/lon), tanggal_kejadian, sumber_informasi, tingkat_urgensi, status (`draft|diajukan|diverifikasi|disetujui|ditolak|selesai`), dibuat_oleh, diverifikasi_oleh, disetujui_oleh, unit_kerja_id, created_at, updated_at.
- **ntm**: id, **tenant_id**, nomor_ntm (dirancang bebas oleh sistem, mis. `NTM-{tahun}-{urut}`; **unik per `(tenant_id, tahun)`**, bukan unik global), tahun, jenis (`permanent|temporary|preliminary|amendment|cancellation`), berita_bahaya_id (nullable — NTM bisa terbit tanpa berita bahaya, mis. info dari pusat), judul, isi, wilayah_perairan, tanggal_berlaku, tanggal_berakhir, status (`draft|menunggu_approval|published|expired|cancelled`), diterbitkan_oleh, diterbitkan_pada, referensi_ntm_sebelumnya (self-reference untuk amendemen), dokumen_pdf_path.
- **ntm_area_koordinat**: id, ntm_id, urutan, lat, lon.
- **relay_recipients**: id, **tenant_id**, nama, jenis (`stasiun_radio|kapal|instansi|dinas_terkait`), kontak (freeform/JSON: frekuensi radio, email, no. telepon).
- **relay_logs**: id, **tenant_id**, ntm_id (atau berita_bahaya_id), recipient_id, kanal (`manual` saja untuk MVP — kolom tetap dirancang enum agar mudah tambah `email|whatsapp|navtex` di fase lanjutan), status (`terkirim|gagal|menunggu_ack|ack_diterima`), dikirim_oleh, waktu_kirim, waktu_ack, catatan.
- **sbnp_assets**: id, **tenant_id**, nama, jenis (`menara_suar|rambu_suar|pelampung|lainnya`), lat, lon, status_operasional (`aktif|rusak|dalam_perbaikan|nonaktif`), unit_kerja_id, deskripsi.
- **sbnp_status_logs**: id, asset_id, status_baru, dilaporkan_oleh, waktu, catatan, foto_path.
- **laporan**: id, **tenant_id**, jenis_laporan, periode_awal, periode_akhir, format, file_path, dibuat_oleh, created_at.
- **audit_logs**: id, **tenant_id**, actor_id, aksi, entity_type, entity_id, data_sebelum (jsonb), data_sesudah (jsonb), ip, created_at.
- **notifications**: id, user_id, judul, isi, tipe, tautan, dibaca, created_at.

> Skema di atas adalah rancangan tingkat tinggi. Definisi kolom presisi, constraint (termasuk `unique (tenant_id, tahun, nomor_ntm)`), dan index (termasuk index komposit yang diawali `tenant_id` di semua tabel besar, agar query per-tenant tetap cepat) akan dituangkan di migration Supabase (`supabase/migrations`) pada tahap implementasi Modul Master Data & Berita Bahaya.

---

## 7. Diagram Alur Data (Berbasis Teks)

### 7.1 Login & Sesi
```
Browser (Client Component: LoginForm)
  → Server Action `login()` [features/auth/actions.js]
    → Supabase Auth signInWithPassword (server client, cookie-based)
    → set-cookie sesi (access/refresh token)
  ← redirect ke /dashboard sesuai role

Setiap request berikutnya:
Browser → proxy.js (refresh sesi via Supabase SSR helper)
        → Server Component membaca sesi via DAL `getCurrentUser()` (cached per-request via react `cache()`)
```

### 7.2 Berita Bahaya → NTM → Relay (alur inti aplikasi)
```
[Petugas Operasional] isi form Berita Bahaya (Client Component + RHF + Zod)
        │  submit
        ▼
Server Action `createBeritaBahaya()`
        │  - validasi Zod ulang di server
        │  - cek role/otorisasi + ambil tenant_id dari sesi (bukan dari form)  [MULTI-TENANT]
        │  - service.beritaBahaya.create()
        ▼
DB: berita_bahaya (tenant_id, status=diajukan) + audit_logs (INSERT)
        │
        ▼
[Verifikator] buka daftar (TanStack Table, Server Component + Client filter)
        │  action verifikasi
        ▼
Server Action `verifikasiBeritaBahaya()` → status=diverifikasi → notifications ke approver
        │
        ▼
[Kepala Seksi/Kepala Kantor] approve
        │
        ▼
Server Action `setujuiBeritaBahaya()`
        │  - service.ntm.generateNomor() (penomoran resmi, transactional)
        │  - service.ntm.createFromBeritaBahaya()
        ▼
DB: ntm (status=draft/menunggu_approval)
        │
        ▼
Server Action `publishNtm()` (role approver akhir)
        │  - update status=published, diterbitkan_pada
        │  - generate PDF (service, di server) → simpan ke Storage bucket publik
        │  - refresh()/revalidateTag halaman publik NTM
        ▼
DB: ntm.status=published  ──────────► Halaman & feed publik `/ntm` , `/api/ntm/feed`
        │                              (dapat diakses tanpa login, RLS anon SELECT)
        ▼
[Petugas Operasional] pilih penerima relay → Server Action `relayNtm()`
        │  - loop per recipient → insert relay_logs (status=terkirim/menunggu_ack) — dicatat manual oleh operator (MVP)
        │  - (fase lanjutan, opsional) integrasi gateway radio/NAVTEX/WA otomatis jika tersedia
        ▼
DB: relay_logs  ──► Dashboard monitoring relay (Client Component + Supabase Realtime subscription)
```

### 7.3 Monitoring Status SBNP (Realtime)
```
[Petugas Teknis lapangan] update status aset (Client Component form)
        → Server Action `updateAssetStatus()` → DB sbnp_status_logs + sbnp_assets.status_operasional
                → Supabase Realtime broadcast (Postgres changes)
                        → Client Component `StatusBoard` (subscribed via supabase browser client)
                        → update UI tanpa refresh, badge warna status berubah
```

### 7.4 Pelaporan
```
[User] pilih periode & jenis laporan (Client form)
   → Server Action `generateLaporan()` (atau Route Handler jika perlu streaming file besar)
      → service.laporan.compute() (agregasi dari DAL, banyak query paralel di 1 fungsi service)
      → generate PDF/XLSX (lib: pdf-lib / exceljs) → simpan Storage
      → insert row `laporan`
   ← link download disajikan ke user (signed URL Storage privat)
```

---

## 8. Struktur Folder yang Direkomendasikan

```
dishub/
├─ proxy.ts                         # Pengganti middleware.ts (Next 16): refresh sesi, resolusi tenant dari subdomain, optimistic auth redirect [MULTI-TENANT]
├─ next.config.ts
├─ tsconfig.json                    # strict: true
├─ eslint.config.mjs
├─ .prettierrc
├─ vitest.config.ts
├─ playwright.config.ts
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/                   # SQL migration bertahap (schema + RLS policy)
│  └─ seed.sql
├─ e2e/                             # Playwright tests
│  └─ auth.spec.ts
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                 # Root layout (Server Component)
│  │  ├─ globals.css
│  │  ├─ (public)/                  # Route group: dapat diakses tanpa login
│  │  │  ├─ ntm/                    # Halaman publik daftar/detail NTM published (tenant diresolusi via subdomain oleh proxy.ts) [MULTI-TENANT]
│  │  │  │  ├─ page.tsx
│  │  │  │  └─ [id]/page.tsx
│  │  │  └─ login/page.tsx
│  │  ├─ (dashboard)/                # Route group: butuh sesi (dicek di layout + proxy)
│  │  │  ├─ layout.tsx                # Sidebar/nav berbasis role
│  │  │  ├─ dashboard/page.tsx
│  │  │  ├─ berita-bahaya/
│  │  │  │  ├─ page.tsx
│  │  │  │  ├─ baru/page.tsx
│  │  │  │  └─ [id]/page.tsx
│  │  │  ├─ ntm/
│  │  │  │  ├─ page.tsx              # kelola (internal), beda dari (public)/ntm
│  │  │  │  ├─ baru/page.tsx
│  │  │  │  └─ [id]/page.tsx
│  │  │  ├─ relay/
│  │  │  │  ├─ page.tsx
│  │  │  │  └─ [id]/page.tsx
│  │  │  ├─ monitoring/
│  │  │  │  └─ page.tsx
│  │  │  ├─ laporan/
│  │  │  │  └─ page.tsx
│  │  │  └─ pengaturan/
│  │  │     ├─ pengguna/page.tsx
│  │  │     └─ master-data/page.tsx
│  │  ├─ (super-admin)/              # Route group global lintas-tenant: hanya SUPER_ADMIN [MULTI-TENANT]
│  │  │  └─ tenants/
│  │  │     ├─ page.tsx              # daftar Distrik Navigasi terdaftar
│  │  │     └─ baru/page.tsx         # provisioning tenant baru
│  │  └─ api/
│  │     ├─ ntm/
│  │     │  ├─ feed/route.ts         # JSON/RSS feed publik, tenant dari subdomain
│  │     │  └─ [id]/pdf/route.ts     # generate/stream PDF
│  │     ├─ laporan/[id]/export/route.ts
│  │     └─ webhooks/
│  │        └─ supabase-auth/route.ts
│  │
│  ├─ features/                      # Modular per domain (colocation)
│  │  ├─ auth/
│  │  │  ├─ actions.ts               # "use server"
│  │  │  ├─ schema.ts                # Zod
│  │  │  └─ components/
│  │  ├─ berita-bahaya/
│  │  │  ├─ actions.ts
│  │  │  ├─ schema.ts
│  │  │  ├─ types.ts
│  │  │  └─ components/
│  │  │     ├─ berita-bahaya-form.tsx     # "use client"
│  │  │     ├─ berita-bahaya-table.tsx    # "use client" (TanStack Table)
│  │  │     └─ status-badge.tsx
│  │  ├─ ntm/
│  │  ├─ relay/
│  │  ├─ monitoring/
│  │  ├─ laporan/
│  │  ├─ pengguna/
│  │  ├─ master-data/
│  │  └─ tenants/                    # [MULTI-TENANT] provisioning & kelola distrik_navigasi, khusus SUPER_ADMIN
│  │     ├─ actions.ts
│  │     ├─ schema.ts
│  │     └─ components/
│  │
│  ├─ server/                        # Tidak pernah diimpor oleh Client Component
│  │  ├─ dal/                        # Data Access Layer: query + DTO + authz check (setiap query difilter tenant_id)
│  │  │  ├─ berita-bahaya.dal.ts
│  │  │  ├─ ntm.dal.ts
│  │  │  ├─ relay.dal.ts
│  │  │  ├─ monitoring.dal.ts
│  │  │  ├─ tenant.dal.ts            # [MULTI-TENANT] resolve tenant dari subdomain/host, lookup distrik_navigasi
│  │  │  └─ user.dal.ts              # getCurrentUser() dgn react cache(), termasuk tenant_id & role dari sesi
│  │  ├─ services/                   # Business logic murni (unit-testable)
│  │  │  ├─ berita-bahaya.service.ts
│  │  │  ├─ ntm.service.ts           # penomoran per-tenant, workflow, PDF
│  │  │  ├─ relay.service.ts
│  │  │  ├─ laporan.service.ts
│  │  │  └─ tenant.service.ts        # [MULTI-TENANT] provisioning tenant baru (pakai admin-client)
│  │  ├─ auth/
│  │  │  ├─ rbac.ts                  # helper cek role/permission + tenant match
│  │  │  └─ session.ts
│  │  └─ supabase/
│  │     ├─ server-client.ts         # createServerClient (cookies) — untuk Server Component/Action
│  │     ├─ admin-client.ts          # service-role, 'server-only', dipakai sangat terbatas (mis. provisioning tenant)
│  │     └─ browser-client.ts        # untuk Client Component (Realtime only)
│  │
│  ├─ components/
│  │  ├─ ui/                         # shadcn/ui generated components
│  │  ├─ layout/                     # Sidebar, Navbar, Breadcrumb
│  │  └─ charts/                     # wrapper Recharts
│  │
│  ├─ lib/
│  │  ├─ utils.ts
│  │  ├─ constants.ts
│  │  ├─ date.ts                     # wrapper date-fns (format Indonesia)
│  │  └─ validation/                 # Zod schema bersama (mis. koordinat, enum status)
│  │
│  ├─ hooks/                         # custom hooks client (mis. useRealtimeStatus)
│  │
│  ├─ types/
│  │  ├─ database.types.ts           # generated: supabase gen types typescript
│  │  └─ index.ts
│  │
│  ├─ config/
│  │  ├─ site.ts
│  │  ├─ navigation.ts               # menu per role
│  │  └─ roles.ts                    # definisi enum role & permission matrix
│  │
│  └─ test/
│     ├─ setup.ts                    # Vitest setup (jsdom, testing-library)
│     └─ mocks/
│
├─ public/
└─ docs/
   └─ ARCHITECTURE.md                # dokumen ini
```

**Aturan pemisahan kunci:**
- `src/server/**` mengandung `import 'server-only'` di setiap file agar build gagal jika ada Client Component yang salah impor.
- `src/features/**` boleh berisi campuran Server & Client Component, tapi Client Component di dalamnya **tidak boleh** mengimpor apa pun dari `src/server/**` secara langsung — hanya lewat Server Action yang di-passing sebagai prop, atau memanggil `fetch`/action import biasa (Next otomatis membuat network call).
- `components/ui` hasil generate shadcn **tidak diedit manual** kecuali untuk kustomisasi tema; kustomisasi lebih baik lewat wrapper di `components/` domain lain.

---

## 9. Daftar Dependency

### Runtime
| Package | Kebutuhan |
|---|---|
| `next` (16.x, sudah terpasang) | Framework |
| `react`, `react-dom` (19.x, sudah terpasang) | UI runtime |
| `typescript` | Strict typing (migrasi dari JS) |
| `@supabase/supabase-js` | Supabase client |
| `@supabase/ssr` | Supabase SSR helper (cookie-based session utk Server Component/Action) |
| `zod` | Validasi schema (client + server) |
| `react-hook-form` | Form state |
| `@hookform/resolvers` | Bridge RHF ↔ Zod |
| `@tanstack/react-table` | Tabel data (berita bahaya, NTM, relay log) |
| `recharts` | Chart dashboard (lihat catatan pilihan di bawah) |
| `date-fns` (+ `date-fns-tz` bila perlu zona waktu WIT Merauke) | Manipulasi tanggal |
| `clsx`, `tailwind-merge`, `class-variance-authority` | Util shadcn/ui |
| `lucide-react` | Ikon (dipakai shadcn/ui) |
| `sonner` | Toast notification (rekomendasi shadcn) |
| `next-themes` | Dark mode (opsional, sesuai kebutuhan UX) |
| `pdf-lib` atau `@react-pdf/renderer` | Generate dokumen PDF NTM/laporan |
| `exceljs` | Export laporan XLSX |

### Dev / Tooling
| Package | Kebutuhan |
|---|---|
| `tailwindcss` (v4, sudah terpasang), `@tailwindcss/postcss` | Styling |
| `eslint`, `eslint-config-next` (sudah terpasang) | Lint |
| `prettier`, `prettier-plugin-tailwindcss` | Format kode konsisten |
| `vitest`, `@vitejs/plugin-react`, `@vitest/coverage-v8` | Unit test |
| `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` | Testing Client Component |
| `@playwright/test` | E2E test |
| `supabase` (CLI, devDependency) | Migration lokal & generate types |
| `husky`, `lint-staged` | Git hook pra-commit (lint/format/test cepat) |

### Catatan pilihan library
- **Chart.js vs Recharts** → Direkomendasikan **Recharts** karena berbasis komponen React (lebih idiomatis dengan Server/Client Component boundary, lebih mudah di-tree-shake per chart). Chart.js dipertimbangkan ulang hanya jika nanti dibutuhkan render volume data sangat besar (>>ribuan titik) di canvas.
- **shadcn/ui** bukan dependency npm biasa — komponennya di-generate lewat CLI (`npx shadcn@latest add ...`) ke `src/components/ui`, jadi entri di atas hanya mencantumkan dependency runtime di baliknya.
- **Cache Components (`cacheComponents: true`, direktif `"use cache"`)** — **tidak diaktifkan secara default** di fase awal, karena mayoritas data (dashboard, status realtime, data per-user/role) bersifat dinamis dan sensitif terhadap otorisasi. Fitur ini dipertimbangkan hanya untuk halaman publik NTM yang perubahannya tidak sering (opsional, fase lanjutan).

---

## 10. Rencana Implementasi Bertahap

> Setiap fase menghasilkan sesuatu yang bisa didemokan; tidak menunggu semua modul selesai baru testing.

**Fase 0 — Fondasi Proyek**
- Migrasi proyek dari JS → TypeScript strict (`tsconfig.json`, rename file).
- Setup ESLint + Prettier, Vitest, Playwright (skeleton config, 1 test contoh masing-masing).
- Inisialisasi shadcn/ui (tema, `components.json`).
- Buat proyek Supabase Cloud, setup `@supabase/ssr` client (server/browser/admin), `proxy.ts` dasar (refresh sesi).
- Setup CI (lint + typecheck + unit test).

**Fase 1 — Multi-Tenant Foundation [MULTI-TENANT]**
- Tabel `distrik_navigasi` (tenant root), mekanisme tenant resolution di `proxy.ts` (subdomain → tenant_id, dengan cache/TTL pendek agar tidak query DB tiap request).
- Provisioning awal: 1 tenant seed untuk Merauke agar modul lain bisa dikembangkan & didemokan dengan data konkret.
- Modul admin lintas-tenant dasar (`(super-admin)/tenants`) untuk `SUPER_ADMIN`.

**Fase 2 — Auth & RBAC**
- Tabel `profiles` (dengan `tenant_id`), `unit_kerja`, enum role (tenant-scoped + global), Auth Hook custom claims (`role`, `tenant_id`).
- Halaman login/logout, proxy redirect, layout dashboard per role, navigasi dinamis.
- Modul manajemen pengguna (CRUD oleh `TENANT_ADMIN`, dibatasi ke tenant sendiri).
- RLS baseline untuk `profiles` & `distrik_navigasi` (isolasi tenant + role).

**Fase 3 — Master Data**
- CRUD `unit_kerja`, kategori bahaya, `relay_recipients`, master jenis SBNP — semua tenant-scoped.
- RLS & DAL dasar untuk semua master data (filter `tenant_id` wajib).

**Fase 4 — Berita Bahaya**
- Form input (RHF+Zod), upload lampiran (Storage, path menyertakan `tenant/{tenant_id}/...`), listing (TanStack Table), detail, workflow status (diajukan→diverifikasi→disetujui), audit log otomatis.

**Fase 5 — Notice to Marine (NTM)**
- Skema penomoran per-tenant (`unique (tenant_id, tahun, nomor_ntm)`, format bebas dirancang sistem), generate dari berita bahaya, workflow approval, generate PDF, halaman & feed publik `(public)/ntm` per-tenant, mekanisme amendemen/pencabutan.

**Fase 6 — Relay (MVP: manual saja)**
- Pencatatan relay manual multi-kanal (kanal dicatat sebagai metadata, pengiriman fisik dilakukan operator di luar sistem/radio), tracking status/acknowledgement, notifikasi in-app ke petugas terkait.
- Integrasi gateway otomatis (email/WA/NAVTEX) **secara eksplisit di luar cakupan MVP** — baru dipertimbangkan sebagai fase terpisah jika ada kebutuhan & API tersedia di kemudian hari.

**Fase 7 — Monitoring SBNP**
- Registry aset + peta lokasi, update status oleh Petugas Teknis, Supabase Realtime subscription untuk status board (tenant-scoped), riwayat status.

**Fase 8 — Pelaporan & Analitik**
- Dashboard ringkasan (Recharts) per tenant, opsional rekap lintas-tenant untuk `PUSAT_VIEWER`, generator laporan periodik (PDF/XLSX), riwayat laporan.

**Fase 9 — Pengerasan (Hardening)**
- Audit menyeluruh RLS & Server Action **khusus uji isolasi antar-tenant** (mis. coba akses data tenant lain dgn user tenant A — harus selalu gagal), review OWASP Top 10, uji performa (banyak baris NTM historis, banyak tenant sekaligus), aksesibilitas (WCAG dasar), backup/restore drill, load test relay/monitoring realtime.

**Fase 10 — UAT, Deployment (Vercel + Supabase Cloud), Dokumentasi**
- Setup wildcard domain di Vercel untuk subdomain per tenant (jika opsi subdomain dikonfirmasi), environment production Supabase Cloud, User Acceptance Test dengan operator riil dari minimal 2 tenant (untuk memvalidasi isolasi), dokumentasi pengguna, pelatihan, deployment produksi + rollback plan.

---

## 11. Risiko Teknis & Asumsi

| Risiko / Asumsi | Dampak | Mitigasi awal |
|---|---|---|
| Format penomoran NTM dirancang bebas oleh sistem (bukan standar eksternal baku) — **[terkonfirmasi]** | Rendah — tapi jika belakangan ternyata ada standar Ditjen Hubla/IHO yang wajib diikuti, perlu migrasi data nomor | Kolom `nomor_ntm` tetap string bebas format + komponen (`tenant`, `tahun`, `urut`) terpisah secara internal agar mudah re-format tampilan tanpa migrasi data |
| Relay MVP = pencatatan manual saja — **[terkonfirmasi]** | Modul Relay fase awal tidak mengirim pesan otomatis, murni logging aktivitas operator | Desain skema `relay_logs`/`kanal` tetap generik (enum extensible) agar otomatisasi bisa ditambah tanpa migrasi besar di masa depan |
| **Multi-tenant sejak awal — [terkonfirmasi]**: menambah kompleksitas signifikan (isolasi RLS, tenant resolution, provisioning) dibanding rencana single-tenant awal | Effort desain & testing lebih besar; risiko *tenant data leakage* jika RLS/DAL keliru | RLS + app-level check ganda (§4a/§5), test khusus isolasi tenant di Fase 9, index & constraint semua diawali `tenant_id` |
| Mekanisme tenant resolution (subdomain vs path) — **direkomendasikan subdomain, tapi domain/DNS final belum ditentukan** | Mempengaruhi setup Vercel (wildcard domain), desain `proxy.ts`, dan URL publik NTM | Perlu konfirmasi domain resmi sebelum Fase 1; desain `tenant.dal.ts` dibuat abstrak agar strategi resolusi bisa diganti (subdomain ↔ path) tanpa mengubah seluruh codebase |
| Konektivitas terbatas di stasiun pantai terpencil | Risiko kegagalan submit data penting | Pertimbangkan PWA/offline queue (`useOffline` eksperimental Next 16) di fase lanjutan; untuk MVP, pastikan pesan error jelas + retry manual |
| Kebutuhan tanda tangan elektronik berkekuatan hukum pada dokumen NTM (BSrE/PSrE) | PDF NTM mungkin perlu digital signature resmi, bukan sekadar cap gambar | Perlu konfirmasi; jika ya, ini modul tambahan terpisah (integrasi PSrE) |
| Retensi/arsip data jangka panjang (aturan kearsipan negara) belum jelas | Kebijakan `DELETE` & backup storage jangka panjang tidak terdefinisi | Default: tidak ada hard delete di data operasional; kebijakan arsip final menyusul |
| Server Actions mem-proses submission satu per satu secara berurutan (bukan paralel) — batasan resmi Next.js saat ini | Relay massal ke banyak penerima sekaligus bisa terasa lambat jika dilakukan lewat banyak Server Action terpisah | Untuk operasi bulk (relay ke banyak recipient), lakukan **di dalam satu Server Action/service** yang memproses banyak baris sekaligus (paralel di server), bukan memanggil Server Action berkali-kali dari client |
| Kebutuhan bahasa Inggris untuk NTM (pelayaran internasional) belum dikonfirmasi | Berpengaruh ke i18n & template dokumen | Perlu klarifikasi (lihat §12) |
| Provisioning tenant baru: siapa yang berwenang & seberapa sering terjadi (self-service vs manual oleh developer) belum jelas | Mempengaruhi apakah modul `(super-admin)/tenants` perlu UI lengkap di MVP atau cukup dilakukan lewat migration/skrip manual dulu | Asumsi awal: MVP cukup dengan skrip/SQL manual oleh `SUPER_ADMIN`/tim pengembang; UI provisioning lengkap menyusul jika frekuensi onboarding tenant baru tinggi |

---

## 12. Daftar Pertanyaan Klarifikasi

> Butir yang sudah terjawab di sesi ini ditandai ✅ dan tidak perlu dijawab ulang; sisanya masih terbuka.

1. ✅ ~~Format penomoran NTM~~ — dirancang bebas oleh sistem, unik per `(tenant_id, tahun)`.
2. ✅ ~~Kanal relay MVP~~ — pencatatan manual saja, tanpa integrasi gateway otomatis di fase awal.
3. ✅ ~~Cakupan tenant~~ — multi-tenant sejak awal (banyak Distrik Navigasi).
4. ✅ ~~Hosting~~ — Vercel + Supabase Cloud.
5. **Struktur organisasi & peran**: Apa daftar jabatan/peran riil di tiap Distrik Navigasi beserta hierarki approval-nya (siapa berwenang memverifikasi vs menyetujui vs menerbitkan NTM)? Apakah strukturnya seragam di semua tenant atau bisa berbeda per kantor?
6. **Tenant resolution**: Subdomain (mis. `merauke.ntm-hubla.go.id`) atau path (`/d/merauke/...`)? Apakah domain resmi (`.go.id`) untuk ini sudah tersedia/bisa didaftarkan, termasuk wildcard subdomain?
7. **Provisioning tenant**: Siapa yang berwenang menambahkan Distrik Navigasi baru ke sistem, dan seberapa sering ini diperkirakan terjadi (jarang/manual vs perlu self-service UI)?
8. **Peran lintas-tenant**: Apakah benar-benar dibutuhkan peran `PUSAT_VIEWER` (mis. Ditjen Hubla) yang bisa melihat rekap dari semua Distrik Navigasi, atau setiap tenant sepenuhnya independen tanpa pengawasan terpusat?
9. **Legalitas dokumen**: Apakah PDF NTM yang diterbitkan memerlukan tanda tangan elektronik bersertifikat (BSrE/PSrE) agar sah secara hukum, atau cukup cap/tanda tangan digital biasa?
10. **Konsumsi publik**: Siapa saja konsumen NTM publik (pelaut umum via web, sistem pihak ketiga via API, aplikasi mobile khusus)? Apakah perlu endpoint machine-readable standar (mis. format sesuai konvensi NAVTEX/RSS), dan apakah perlu halaman agregasi NTM **lintas-tenant** untuk publik (bukan hanya per-tenant)?
11. **Bahasa**: Apakah NTM/berita bahaya perlu disediakan dalam Bahasa Indonesia & Inggris (untuk pelayaran internasional)?
12. **Retensi data**: Berapa lama data (berita bahaya, NTM kadaluarsa, log relay, log status SBNP) wajib disimpan sesuai aturan kearsipan instansi?
13. **Konektivitas lapangan**: Seberapa sering petugas di stasiun pantai/lapangan bekerja dalam kondisi koneksi buruk/offline? Apakah dibutuhkan mode offline-first (PWA) di MVP atau bisa menyusul?
14. **Integrasi eksisting**: Apakah ada sistem lama (spreadsheet, aplikasi lama, database existing per Distrik Navigasi) yang datanya perlu dimigrasikan ke sistem baru?
15. **Notifikasi eksternal**: Apakah dibutuhkan notifikasi keluar sistem (email/WA/SMS) ke pejabat terkait saat ada berita bahaya baru/butuh approval, atau cukup notifikasi in-app?
16. **SSO/Identitas**: Apakah login harus terintegrasi dengan sistem identitas kepegawaian instansi (SSO), atau akun mandiri di Supabase Auth sudah cukup? Apakah SSO (jika ada) juga perlu membawa info tenant/unit kerja?
17. **Skala data**: Estimasi jumlah tenant di tahun pertama, dan volume transaksi per tenant per bulan (jumlah berita bahaya, NTM, entri relay) untuk membantu keputusan indexing, paginasi, dan tier Supabase yang dibutuhkan?
18. **Peta/GIS**: Apakah dibutuhkan visualisasi peta interaktif (mis. Leaflet/Mapbox) untuk lokasi bahaya & aset SBNP, atau cukup koordinat tekstual di tabel untuk versi awal?

---

## 13. Ringkasan Keputusan yang Sudah Diambil di Dokumen Ini
(agar mudah direview cepat, bisa disetujui/ditolak per poin)

- [x] Format nomor NTM dirancang bebas oleh sistem, unik per `(tenant_id, tahun)`.
- [x] Relay MVP = pencatatan manual saja.
- [x] **Multi-tenant sejak awal** — arsitektur RLS, skema, folder, dan urutan fase sudah direvisi mengikuti ini (§4a, §5, §6, §8, §10).
- [x] Hosting: Vercel + Supabase Cloud.
- [ ] Pola Data Access Layer + Service Layer + Server Action seperti dijabarkan di §3.
- [ ] RBAC berbasis JWT custom claims (`role` + `tenant_id`) + RLS + app-level check ganda (§4–5).
- [ ] `proxy.ts` untuk refresh sesi + resolusi tenant (subdomain, opsi (a) di §4a) + optimistic redirect (bukan otorisasi final).
- [ ] Struktur folder feature-based di §8, termasuk modul `tenants` khusus `SUPER_ADMIN`.
- [ ] Recharts dipilih sebagai library chart utama.
- [ ] Cache Components (`use cache`) tidak diaktifkan di fase awal.
- [ ] Urutan fase implementasi 0–10 di §10 (ditambah Fase 1 khusus Multi-Tenant Foundation).
