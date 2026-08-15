import 'server-only';
import { randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sanitizeFileName } from './validate-file';

const BUCKET = 'documents';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 5 * 60; // 5 minutes — short-lived by design (item 7).

/**
 * Uploads a document to the private "documents" Storage bucket using
 * the service-role client (this bucket has no client-facing insert path
 * — the app always mediates uploads through a Server Action so file
 * validation, activity logging, and metadata rows stay consistent with
 * what's actually in Storage).
 *
 * `prefix` namespaces the object key by feature ("berita" for the
 * document generator, "ntm" for the /ntm module) — never derived from
 * unsanitized user input beyond sanitizeFileName().
 *
 * Returns the object path (NOT a URL — see createSignedDownloadUrl()).
 */
export async function uploadDocument({ prefix, fileName, mimeType, bytes }) {
  const supabase = createSupabaseAdminClient();
  const safeName = sanitizeFileName(fileName);
  const path = `${prefix}/${randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw error;

  return path;
}

/**
 * Mints a short-lived signed URL for downloading a private document.
 * MUST only be called after the caller's own RLS-protected metadata
 * query has already confirmed they're allowed to see this particular
 * row (message_documents/ntm_documents) — this function itself uses the
 * service-role client and does not re-check authorization, by design
 * (mirrors the Vault-secret-resolution pattern documented in
 * src/lib/supabase/admin.js).
 */
export async function createSignedDownloadUrl(path, expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
