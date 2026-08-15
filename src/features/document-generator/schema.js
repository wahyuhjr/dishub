import { z } from 'zod';

/**
 * Shared Zod schema for the berita bahaya document generator form —
 * used client-side (react-hook-form resolver) AND server-side (inside
 * the Server Action, which never trusts client validation alone).
 *
 * Coordinates are required here (unlike relay-news's optional
 * lat/long) since the generated official document always states a
 * position — "Validasi koordinat" is an explicit requirement of this
 * module.
 */
export const documentFormSchema = z.object({
  message_number: z
    .string()
    .trim()
    .min(1, 'Nomor berita wajib diisi.')
    .max(64, 'Nomor berita maksimal 64 karakter.'),
  category: z.enum(['DISTRESS', 'URGENCY', 'SAFETY', 'NTM'], {
    error: 'Pilih kategori berita.',
  }),
  location_description: z
    .string()
    .trim()
    .min(1, 'Lokasi kejadian wajib diisi.')
    .max(300, 'Lokasi kejadian maksimal 300 karakter.'),
  latitude: z
    .string()
    .trim()
    .min(1, 'Latitude wajib diisi.')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= -90 && Number(v) <= 90, {
      message: 'Latitude harus berupa angka di antara -90 dan 90.',
    }),
  longitude: z
    .string()
    .trim()
    .min(1, 'Longitude wajib diisi.')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180, {
      message: 'Longitude harus berupa angka di antara -180 dan 180.',
    }),
  incident_at: z.string().trim().min(1, 'Waktu kejadian wajib diisi.'),
  valid_until: z.string().trim().min(1, 'Waktu berlaku wajib diisi.'),
  navigation_area: z
    .string()
    .trim()
    .min(1, 'Area navigasi wajib diisi.')
    .max(300, 'Area navigasi maksimal 300 karakter.'),
  content: z
    .string()
    .trim()
    .min(1, 'Isi berita wajib diisi.')
    .max(4000, 'Isi berita maksimal 4000 karakter.'),
  sender_name: z.string().trim().min(1, 'Nama pengirim wajib diisi.').max(150),
  operator_name: z.string().trim().min(1, 'Nama operator wajib diisi.').max(150),
  verifier_name: z.string().trim().max(150).optional().or(z.literal('')),
});

export const documentIdSchema = z.string().uuid('ID dokumen tidak valid.');
