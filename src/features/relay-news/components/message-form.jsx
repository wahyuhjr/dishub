'use client';

import { useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { messageFormSchema } from '@/features/relay-news/schema';
import { MESSAGE_TYPE_LABELS, PRIORITY_LABELS } from '@/features/relay-news/status-machine';
import { saveDraftAction, createAndSubmitForVerificationAction, updateDraftMessageAction } from '@/features/relay-news/actions';

const DEFAULT_VALUES = {
  message_number: '',
  message_type: '',
  title: '',
  received_at: '',
  scheduled_at: '',
  origin_station_id: '',
  destination_station_id: '',
  content: '',
  location_description: '',
  latitude: '',
  longitude: '',
  sender_name: '',
  priority: 'NORMAL',
};

function toFormData(values) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value ?? '');
  }
  return formData;
}

/**
 * Create (/dashboard/relay-news/new) or edit (existing DRAFT) form.
 * Client-side validation via zodResolver (messageFormSchema) gives
 * instant feedback; the Server Actions re-validate the exact same
 * schema server-side (see actions.js) — neither side is trusted alone.
 */
export function MessageForm({ stations, mode = 'create', messageId, initialValues }) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState(null);
  // `isPending` only flips the disabled attribute after React re-renders,
  // which is too slow to stop a rapid double-click/double-tap from firing
  // the Server Action twice (e.g. creating the message row twice). This
  // ref is set synchronously inside the click handler, before any render,
  // so the second click is rejected immediately regardless of render timing.
  const submittingRef = useRef(false);

  const form = useForm({
    resolver: zodResolver(messageFormSchema),
    defaultValues: initialValues ?? DEFAULT_VALUES,
  });

  function submit(action) {
    return form.handleSubmit((values) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setServerError(null);
      startTransition(async () => {
        try {
          const formData = toFormData(values);
          const result = mode === 'edit' ? await action(messageId, formData) : await action(undefined, formData);
          if (result?.error) {
            setServerError(result.error);
          }
          // On success these actions redirect() server-side, which throws
          // and navigates away — nothing else to do here.
        } finally {
          submittingRef.current = false;
        }
      });
    });
  }

  return (
    <Form {...form}>
      <form className="flex flex-col gap-6" noValidate>
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
            name="message_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jenis Berita</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger aria-label="Jenis berita" className="w-full">
                      <SelectValue placeholder="Pilih jenis berita" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(MESSAGE_TYPE_LABELS).map(([value, label]) => (
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
                  <Input placeholder="Judul singkat berita" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="received_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tanggal &amp; Jam Diterima</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="scheduled_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jadwal Relay (opsional)</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="origin_station_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stasiun Asal</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger aria-label="Stasiun asal" className="w-full">
                      <SelectValue placeholder="Pilih stasiun asal" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {stations.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.station_name}
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
            name="destination_station_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stasiun Tujuan (opsional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger aria-label="Stasiun tujuan" className="w-full">
                      <SelectValue placeholder="Pilih stasiun tujuan" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {stations.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.station_name}
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
            name="location_description"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Lokasi</FormLabel>
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
                  <Input inputMode="decimal" placeholder="-8.4999" {...field} />
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
                  <Input inputMode="decimal" placeholder="140.4010" {...field} />
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
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prioritas</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger aria-label="Prioritas" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
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

          <FormItem>
            <FormLabel>Operator</FormLabel>
            <FormControl>
              <Input value="Anda (operator sesi ini)" disabled readOnly />
            </FormControl>
          </FormItem>
        </div>

        {serverError ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {serverError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={isPending} onClick={submit(mode === 'edit' ? updateDraftMessageAction : saveDraftAction)}>
            {isPending ? 'Menyimpan…' : 'Save Draft'}
          </Button>
          {mode === 'create' && (
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={submit(createAndSubmitForVerificationAction)}
            >
              {isPending ? 'Memproses…' : 'Submit for Verification'}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              form.reset(initialValues ?? DEFAULT_VALUES);
              setServerError(null);
            }}
          >
            Reset Form
          </Button>
        </div>
      </form>
    </Form>
  );
}
