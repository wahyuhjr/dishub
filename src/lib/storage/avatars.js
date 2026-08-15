import 'server-only';
import { randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sanitizeFileName } from './validate-file';

const BUCKET = 'avatars';
const ALLOWED_AVATAR_MIME = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB — matches the bucket's file_size_limit.

/**
 * Uploads a profile photo to the PUBLIC "avatars" Storage bucket via the
 * service-role client (avatars have no client-facing write path — the
 * app always mediates uploads through the ADMIN user-management server
 * action so validation + activity logging stay consistent).
 *
 * Unlike private documents, the avatars bucket is public, so this returns
 * a stable public URL suitable for storing in profiles.avatar_url.
 */
export async function uploadAvatar({ userId, fileName, mimeType, bytes }) {
  const supabase = createSupabaseAdminClient();
  const safeName = sanitizeFileName(fileName);
  const path = `${userId}/${randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export { ALLOWED_AVATAR_MIME, MAX_AVATAR_BYTES };
