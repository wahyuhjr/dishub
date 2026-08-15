import { z } from 'zod';

/**
 * Shared Zod schemas for the ADMIN user-management module. Used both by
 * the client dialogs (react-hook-form) for instant feedback AND by the
 * Server Actions, which re-validate every input server-side and never
 * trust the client (requirement 22).
 */

export const ROLE_VALUES = ['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER'];

const username = z
  .string()
  .trim()
  .min(3, 'Username minimal 3 karakter.')
  .max(32, 'Username maksimal 32 karakter.')
  .regex(/^[a-z0-9_]+$/, 'Username hanya boleh huruf kecil, angka, dan garis bawah.');

const fullName = z.string().trim().min(1, 'Nama lengkap wajib diisi.').max(120, 'Nama lengkap maksimal 120 karakter.');
const email = z.string().trim().toLowerCase().email('Email tidak valid.');
const role = z.enum(ROLE_VALUES, { error: 'Pilih role yang valid.' });
const password = z
  .string()
  .min(8, 'Password minimal 8 karakter.')
  .max(72, 'Password maksimal 72 karakter.');

export const userIdSchema = z.string().uuid('ID user tidak valid.');

export const createUserSchema = z.object({
  username,
  full_name: fullName,
  email,
  password,
  role,
  is_active: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  id: userIdSchema,
  username,
  full_name: fullName,
  role,
});

export const changeRoleSchema = z.object({
  id: userIdSchema,
  role,
});

export const setActiveSchema = z.object({
  id: userIdSchema,
  is_active: z.boolean(),
});

export const resetPasswordSchema = z.object({
  id: userIdSchema,
  password,
});
