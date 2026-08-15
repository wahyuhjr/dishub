const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB — matches the bucket's file_size_limit (see migration).
const SAFE_NAME_PATTERN = /[^a-zA-Z0-9._-]+/g;

/**
 * Strips path separators, whitespace, and any character outside
 * [a-zA-Z0-9._-] from a user-supplied file name, and truncates it to a
 * sane length — used before ever using a file name as (part of) a
 * Storage object key, so a crafted name (e.g. "../../etc/passwd",
 * or one containing control characters) can't do anything unexpected.
 */
export function sanitizeFileName(originalName) {
  const base = (originalName || 'dokumen').split(/[/\\]/).pop();
  const sanitized = base.replace(SAFE_NAME_PATTERN, '_').slice(0, 120);
  return sanitized || 'dokumen';
}

/**
 * Validates a file's declared MIME type and size before it's ever
 * uploaded to Storage. `file` is anything with `.type` and `.size`
 * (a browser File, or a plain { type, size } object from server code).
 * Returns { valid: true } or { valid: false, error: string }.
 */
export function validateFile(file, { allowedMimeTypes = ALLOWED_MIME_TYPES, maxSizeBytes = MAX_FILE_SIZE_BYTES } = {}) {
  if (!file) {
    return { valid: false, error: 'Tidak ada file yang dipilih.' };
  }
  if (!allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Jenis file tidak didukung (${file.type || 'tidak diketahui'}). Gunakan: ${allowedMimeTypes.join(', ')}.`,
    };
  }
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `Ukuran file melebihi batas maksimum ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB.`,
    };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'File kosong.' };
  }
  return { valid: true };
}

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES };
