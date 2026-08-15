'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Printer, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { documentFormSchema } from '@/features/document-generator/schema';
import { CATEGORY_LABELS } from '@/features/document-generator/categories';
import { OfficialDocumentPreview } from '@/features/document-generator/templates/preview-templates';
import { generateDocumentAction } from '@/features/document-generator/actions';

const DEFAULT_VALUES = {
  message_number: '',
  category: '',
  location_description: '',
  latitude: '',
  longitude: '',
  incident_at: '',
  valid_until: '',
  navigation_area: '',
  content: '',
  sender_name: '',
  operator_name: '',
  verifier_name: '',
};

/**
 * Berita bahaya document generator: a form (left) driving a live,
 * always-in-sync HTML preview styled as an official document (right).
 * "Buat" actually generates the PDF server-side (pdf-generator.jsx,
 * server-only), uploads it, and saves its metadata — the client never
 * touches PDF rendering. "Cetak" prints the live HTML preview directly
 * via the browser (see the print media query below), independent of
 * whether a PDF has been generated yet.
 */
export function DocumentGeneratorForm() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState(null);
  const [generated, setGenerated] = useState(null); // { document, signedUrl }

  const form = useForm({
    resolver: zodResolver(documentFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  });

  const values = form.watch();

  function onSubmit(values) {
    setServerError(null);
    setGenerated(null);
    startTransition(async () => {
      const result = await generateDocumentAction(values);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      setGenerated(result.data);
    });
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="print:hidden">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="message_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor Berita</FormLabel>
                    <FormControl>
                      <Input placeholder="BB-2026-0001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori Berita</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full" aria-label="Kategori berita">
                          <SelectValue placeholder="Pilih kategori" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location_description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Lokasi Kejadian</FormLabel>
                    <FormControl>
                      <Input placeholder="Deskripsi lokasi kejadian" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input placeholder="-8.4999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input placeholder="140.4010" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="incident_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Waktu Kejadian</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Waktu Berlaku</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="navigation_area"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Area Navigasi</FormLabel>
                    <FormControl>
                      <Input placeholder="Alur pelayaran / perairan terdampak" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Isi Berita</FormLabel>
                    <FormControl>
                      <Textarea rows={5} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sender_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Pengirim</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="operator_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Operator</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="verifier_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Verifikator (opsional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {serverError ? (
              <p role="alert" className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
                {serverError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isPending}>
                <FileText className="size-4" aria-hidden="true" />
                {isPending ? 'Membuat dokumen…' : 'Buat & Simpan Dokumen (PDF)'}
              </Button>
              <Button type="button" variant="outline" onClick={handlePrint}>
                <Printer className="size-4" aria-hidden="true" />
                Cetak Preview
              </Button>
              {generated?.signedUrl ? (
                <Button type="button" variant="outline" asChild>
                  <a href={generated.signedUrl} target="_blank" rel="noreferrer" download={generated.document?.file_name}>
                    <Download className="size-4" aria-hidden="true" />
                    Unduh PDF
                  </a>
                </Button>
              ) : null}
            </div>

            {generated ? (
              <p className="text-sm text-success">
                Dokumen tersimpan: {generated.document?.file_name}. Tautan unduh berlaku sementara (kedaluwarsa singkat demi keamanan).
              </p>
            ) : null}
          </form>
        </Form>
      </div>

      <div>
        <OfficialDocumentPreview category={values.category || 'NTM'} data={values} />
      </div>
    </div>
  );
}
