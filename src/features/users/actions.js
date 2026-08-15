'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getRequestContext } from '@/lib/audit/request-context';
import { uploadAvatar, ALLOWED_AVATAR_MIME, MAX_AVATAR_BYTES } from '@/lib/storage/avatars';
import { validateFile } from '@/lib/storage/validate-file';
import {
  createUserSchema,
  updateUserSchema,
  changeRoleSchema,
  setActiveSchema,
  resetPasswordSchema,
  userIdSchema,
} from './schema';
import { listActivityForUser } from './dal';

/**
 * ADMIN-only user management (requirement: "hanya dapat diakses ADMIN").
 *
 * SECURITY:
 *   - Every action re-verifies ADMIN via requireRole('ADMIN') (role is
 *     re-derived from the server session, never trusted from the client).
 *   - Auth-user provisioning/off-boarding/password changes go exclusively
 *     through the server-side Supabase Admin API (createSupabaseAdminClient,
 *     `server-only`) — the service-role key is never available to any
 *     Client Component (requirements 18 & 19).
 *   - Passwords are never read back or logged (requirement 17): reset only
 *     WRITES a new password via the Admin API.
 *   - Every create/update/deactivate/reset/delete is written to
 *     activity_logs (requirement 20).
 *   - The "last active ADMIN" can never be demoted, deactivated, or
 *     deleted — enforced authoritatively by DB triggers (migration
 *     20260815120000) AND pre-checked here for a friendly message
 *     (requirement 16).
 */

function firstIssue(error) {
  return error.issues?.[0]?.message ?? 'Input tidak valid.';
}

async function logUserAction(supabase, actorId, action, targetId, metadata, ctx) {
  await supabase.from('activity_logs').insert({
    actor_id: actorId,
    action,
    entity_type: 'profiles',
    entity_id: targetId,
    metadata: metadata ?? {},
    ip_address: ctx?.ipAddress ?? null,
    user_agent: ctx?.userAgent ?? null,
  });
}

/** True when `targetId` is currently the ONLY active ADMIN. */
async function isLastActiveAdmin(supabase, targetId) {
  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', targetId)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target || target.role !== 'ADMIN' || !target.is_active) return false;

  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'ADMIN')
    .eq('is_active', true)
    .neq('id', targetId);
  if (error) throw error;
  return (count ?? 0) === 0;
}

/** Create a new user via the Auth Admin API. */
export async function createUserAction(prevState, formData) {
  const admin = await requireRole('ADMIN');

  const parsed = createUserSchema.safeParse({
    username: formData.get('username'),
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
    is_active: formData.get('is_active') !== 'false',
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      username: parsed.data.username,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    },
  });
  if (error) return { error: error.message };

  const newUserId = data.user.id;
  const supabase = await createSupabaseServerClient();

  // The handle_new_user trigger provisions the profile from metadata; if
  // the admin requested an inactive account, apply that now.
  if (!parsed.data.is_active) {
    await supabase.from('profiles').update({ is_active: false }).eq('id', newUserId);
  }

  const ctx = await getRequestContext();
  await logUserAction(
    supabase,
    admin.id,
    'CREATE_USER',
    newUserId,
    { username: parsed.data.username, role: parsed.data.role, is_active: parsed.data.is_active },
    ctx
  );

  revalidatePath('/dashboard/user');
  return { success: true, userId: newUserId };
}

/** Update a user's username, full name, and role. */
export async function updateUserAction(prevState, formData) {
  const admin = await requireRole('ADMIN');

  const parsed = updateUserSchema.safeParse({
    id: formData.get('id'),
    username: formData.get('username'),
    full_name: formData.get('full_name'),
    role: formData.get('role'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();

  if (parsed.data.role !== 'ADMIN' && (await isLastActiveAdmin(supabase, parsed.data.id))) {
    return { error: 'Tidak dapat menurunkan role ADMIN terakhir yang masih aktif.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ username: parsed.data.username, full_name: parsed.data.full_name, role: parsed.data.role })
    .eq('id', parsed.data.id);
  if (error) return { error: error.message };

  const ctx = await getRequestContext();
  await logUserAction(supabase, admin.id, 'UPDATE_USER', parsed.data.id, {
    username: parsed.data.username,
    role: parsed.data.role,
  }, ctx);

  revalidatePath('/dashboard/user');
  return { success: true };
}

/** Change only a user's role. */
export async function changeRoleAction(input) {
  const admin = await requireRole('ADMIN');
  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  if (parsed.data.role !== 'ADMIN' && (await isLastActiveAdmin(supabase, parsed.data.id))) {
    return { error: 'Tidak dapat menurunkan role ADMIN terakhir yang masih aktif.' };
  }

  const { error } = await supabase.from('profiles').update({ role: parsed.data.role }).eq('id', parsed.data.id);
  if (error) return { error: error.message };

  const ctx = await getRequestContext();
  await logUserAction(supabase, admin.id, 'CHANGE_USER_ROLE', parsed.data.id, { role: parsed.data.role }, ctx);

  revalidatePath('/dashboard/user');
  return { success: true };
}

/** Activate or deactivate a user (soft enable/disable; profiles are never hard-deleted here). */
export async function setActiveAction(input) {
  const admin = await requireRole('ADMIN');
  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  if (!parsed.data.is_active && parsed.data.id === admin.id) {
    return { error: 'Anda tidak dapat menonaktifkan akun Anda sendiri.' };
  }

  const supabase = await createSupabaseServerClient();
  if (!parsed.data.is_active && (await isLastActiveAdmin(supabase, parsed.data.id))) {
    return { error: 'Tidak dapat menonaktifkan ADMIN terakhir yang masih aktif.' };
  }

  const { error } = await supabase.from('profiles').update({ is_active: parsed.data.is_active }).eq('id', parsed.data.id);
  if (error) return { error: error.message };

  const ctx = await getRequestContext();
  await logUserAction(supabase, admin.id, parsed.data.is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', parsed.data.id, {}, ctx);

  revalidatePath('/dashboard/user');
  return { success: true };
}

/** Reset a user's password via the Auth Admin API. Never echoes the password. */
export async function resetPasswordAction(input) {
  const admin = await requireRole('ADMIN');
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(parsed.data.id, { password: parsed.data.password });
  if (error) return { error: error.message };

  const supabase = await createSupabaseServerClient();
  const ctx = await getRequestContext();
  // Metadata deliberately records only THAT a reset happened — never the value.
  await logUserAction(supabase, admin.id, 'RESET_USER_PASSWORD', parsed.data.id, { reset: true }, ctx);

  revalidatePath('/dashboard/user');
  return { success: true };
}

/** Upload/replace a user's profile photo. */
export async function uploadAvatarAction(prevState, formData) {
  const admin = await requireRole('ADMIN');

  const id = userIdSchema.safeParse(formData.get('id'));
  if (!id.success) return { error: 'ID user tidak valid.' };

  const file = formData.get('avatar');
  if (!file || typeof file === 'string' || file.size === 0) {
    return { error: 'Pilih berkas foto terlebih dahulu.' };
  }

  const check = validateFile(file, { allowedMimeTypes: ALLOWED_AVATAR_MIME, maxSizeBytes: MAX_AVATAR_BYTES });
  if (!check.valid) return { error: check.error };

  const bytes = Buffer.from(await file.arrayBuffer());
  let publicUrl;
  try {
    ({ publicUrl } = await uploadAvatar({ userId: id.data, fileName: file.name, mimeType: file.type, bytes }));
  } catch (error) {
    return { error: error.message ?? 'Gagal mengunggah foto.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', id.data);
  if (error) return { error: error.message };

  const ctx = await getRequestContext();
  await logUserAction(supabase, admin.id, 'UPDATE_USER_AVATAR', id.data, {}, ctx);

  revalidatePath('/dashboard/user');
  return { success: true, avatarUrl: publicUrl };
}

/** Permanently delete a user via the Auth Admin API (cascades to the profile). */
export async function deleteUserAction(input) {
  const admin = await requireRole('ADMIN');
  const parsed = userIdSchema.safeParse(typeof input === 'string' ? input : input?.id);
  if (!parsed.success) return { error: 'ID user tidak valid.' };
  const targetId = parsed.data;

  if (targetId === admin.id) {
    return { error: 'Anda tidak dapat menghapus akun Anda sendiri.' };
  }

  const supabase = await createSupabaseServerClient();
  if (await isLastActiveAdmin(supabase, targetId)) {
    return { error: 'Tidak dapat menghapus ADMIN terakhir yang masih aktif.' };
  }

  // Capture identity for the audit log BEFORE the row disappears.
  const { data: target } = await supabase.from('profiles').select('username, role').eq('id', targetId).maybeSingle();

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (error) return { error: error.message };

  const ctx = await getRequestContext();
  await logUserAction(supabase, admin.id, 'DELETE_USER', targetId, { username: target?.username ?? null, role: target?.role ?? null }, ctx);

  revalidatePath('/dashboard/user');
  return { success: true };
}

/** Read a user's recent activity log (ADMIN-only) for the activity dialog. */
export async function getUserActivityAction(userId) {
  await requireRole('ADMIN');
  const parsed = userIdSchema.safeParse(userId);
  if (!parsed.success) return { error: 'ID user tidak valid.' };

  try {
    const activity = await listActivityForUser(parsed.data);
    return { success: true, activity };
  } catch (error) {
    return { error: error.message ?? 'Gagal memuat aktivitas.' };
  }
}
