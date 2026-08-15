import { requireAnyRole } from '@/lib/auth/guards';
import { rolesFor } from '@/lib/auth/permissions';
import { DocumentGeneratorForm } from '@/features/document-generator/components/document-generator-form';

export default async function DocumentGeneratorPage() {
  await requireAnyRole(rolesFor('documents.generate'));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Generator Dokumen Berita Bahaya</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Isi form di kiri untuk melihat preview resmi secara langsung, lalu buat &amp; simpan sebagai PDF atau cetak langsung.
        </p>
      </div>
      <DocumentGeneratorForm />
    </div>
  );
}
