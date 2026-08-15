// Public route (see proxy.js PUBLIC_PATHS).
export default function AuthCodeErrorPage() {
  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', textAlign: 'center' }}>
      <h1>Autentikasi gagal</h1>
      <p>Tautan masuk tidak valid atau sudah kedaluwarsa. Silakan coba masuk kembali.</p>
      <a href="/login">Kembali ke halaman masuk</a>
    </main>
  );
}
