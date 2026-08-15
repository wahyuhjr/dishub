import { z } from 'zod';

/**
 * Shared Zod schema for /dashboard/ntm/new and /dashboard/ntm/[id]/edit —
 * used client-side (react-hook-form resolver) AND server-side (inside
 * the Server Action, which never trusts client validation alone).
 */
export const ntmFormSchema = z.object({
  ntm_number: z
    .string()
    .trim()
    .min(1, 'Nomor NTM wajib diisi.')
    .max(64, 'Nomor NTM maksimal 64 karakter.'),
  edition: z.string().trim().max(64).optional().or(z.literal('')),
  document_type: z.enum(['PERMANENT', 'TEMPORARY', 'PRELIMINARY', 'AMENDMENT', 'CANCELLATION'], {
    error: 'Pilih jenis dokumen.',
  }),
  title: z
    .string()
    .trim()
    .min(1, 'Judul wajib diisi.')
    .max(200, 'Judul maksimal 200 karakter.'),
  content: z.string().trim().max(4000).optional().or(z.literal('')),
  area_navigasi: z.string().trim().max(300).optional().or(z.literal('')),
  effective_from: z.string().trim().optional().or(z.literal('')),
  effective_until: z.string().trim().optional().or(z.literal('')),
});

export const ntmIdSchema = z.string().uuid('ID NTM tidak valid.');
