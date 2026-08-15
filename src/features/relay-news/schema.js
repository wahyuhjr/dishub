import { z } from 'zod';

/**
 * Shared Zod schema for the /dashboard/relay-news/new form — used both
 * client-side (react-hook-form resolver, for instant feedback) and
 * server-side (inside the Server Action, which NEVER trusts client
 * validation alone — see requirement "Validasi semua input dengan Zod
 * di client dan server").
 */
export const messageFormSchema = z.object({
  message_number: z
    .string()
    .trim()
    .min(1, 'Nomor berita wajib diisi.')
    .max(64, 'Nomor berita maksimal 64 karakter.'),
  message_type: z.enum(['DISTRESS', 'URGENCY', 'SAFETY', 'NTM'], {
    error: 'Pilih jenis berita.',
  }),
  title: z
    .string()
    .trim()
    .min(1, 'Judul wajib diisi.')
    .max(200, 'Judul maksimal 200 karakter.'),
  received_at: z.string().trim().min(1, 'Tanggal & jam diterima wajib diisi.'),
  scheduled_at: z.string().trim().optional().or(z.literal('')),
  origin_station_id: z.string().trim().min(1, 'Stasiun asal wajib dipilih.'),
  destination_station_id: z.string().trim().optional().or(z.literal('')),
  content: z
    .string()
    .trim()
    .min(1, 'Isi berita wajib diisi.')
    .max(4000, 'Isi berita maksimal 4000 karakter.'),
  location_description: z.string().trim().max(300).optional().or(z.literal('')),
  latitude: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= -90 && Number(v) <= 90), {
      message: 'Latitude harus di antara -90 dan 90.',
    }),
  longitude: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180), {
      message: 'Longitude harus di antara -180 dan 180.',
    }),
  sender_name: z.string().trim().max(150).optional().or(z.literal('')),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'], { error: 'Pilih prioritas.' }),
});

/** message_id must be a valid UUID for every workflow-action Server Action. */
export const messageIdSchema = z.string().uuid('ID berita tidak valid.');

export const markFailedSchema = z.object({
  message_id: messageIdSchema,
  reason: z.string().trim().max(500).optional().or(z.literal('')),
});

export const relaySchema = z.object({
  message_id: messageIdSchema,
  station_id: z.string().uuid('Stasiun tujuan tidak valid.'),
  response_message: z.string().trim().max(500).optional().or(z.literal('')),
});
