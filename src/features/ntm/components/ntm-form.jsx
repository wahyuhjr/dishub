'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ntmFormSchema } from '@/features/ntm/schema';
import { NTM_DOCUMENT_TYPE_LABELS } from '@/features/ntm/status-machine';
import { createNtmAction, updateNtmAction } from '@/features/ntm/actions';

const DEFAULT_VALUES = {
  ntm_number: '',
  edition: '',
  document_type: 'PERMANENT',
  title: '',
  content: '',
  area_navigasi: '',
  effective_from: '',
  effective_until: '',
};

function toFormData(values) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value ?? '');
  }
  return formData;
}

/** Create (/dashboard/ntm/new) or edit (existing DRAFT) form. */
export function NtmForm({ mode = 'create', ntmDocumentId, initialValues }) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState(null);

  const form = useForm({
    resolver: zodResolver(ntmFormSchema),
    defaultValues: initialValues ?? DEFAULT_VALUES,
  });

  function onSubmit(values) {
    setServerError(null);
    startTransition(async () => {
      const formData = toFormData(values);
      const action = mode === 'edit' ? updateNtmAction(ntmDocumentId, formData) : createNtmAction(formData);
      const result = await action;
      if (result?.error) {
        setServerError(result.error);
      }
      // On success these actions redirect() server-side.
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="ntm_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nomor NTM</FormLabel>
                <FormControl>
                  <Input placeholder="NTM-2026-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="edition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Edisi (opsional)</FormLabel>
                <FormControl>
                  <Input placeholder="33/2026" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="document_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jenis Dokumen</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full" aria-label="Jenis dokumen NTM">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(NTM_DOCUMENT_TYPE_LABELS).map(([value, label]) => (
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
            name="title"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Judul</FormLabel>
                <FormControl>
                  <Input placeholder="Judul singkat NTM" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="area_navigasi"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Area Navigasi (opsional)</FormLabel>
                <FormControl>
                  <Input placeholder="Alur pelayaran / perairan terdampak" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="effective_from"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Waktu Berlaku Dari (opsional)</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="effective_until"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Waktu Berlaku Sampai (opsional)</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
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
                <FormLabel>Isi/Keterangan (opsional)</FormLabel>
                <FormControl>
                  <Textarea rows={5} {...field} />
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

        <Button type="submit" disabled={isPending} className="w-fit">
          {isPending ? 'Menyimpan…' : mode === 'edit' ? 'Simpan Perubahan' : 'Buat NTM (Draft)'}
        </Button>
      </form>
    </Form>
  );
}
