'use server';

import { requireRole } from '@/lib/auth/guards';
import { ROLES } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Changes another user's role. ADMIN-only (see permissions.js
 * "users.manage") — this is the single most security-sensitive action
 * in the app (privilege escalation risk), hence the extra allow-list
 * check on top of requireRole('ADMIN').
 */
export async function updateUserRoleAction(formData) {
  await requireRole('ADMIN');

  const targetUserId = String(formData.get('user_id') ?? '').trim();
  const nextRole = String(formData.get('role') ?? '').trim();

  if (!targetUserId || !ROLES.includes(nextRole)) {
    return { error: 'user_id valid dan role yang dikenal wajib diisi.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('profiles').update({ role: nextRole }).eq('id', targetUserId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
