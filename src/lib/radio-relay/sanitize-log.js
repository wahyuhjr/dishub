const SENSITIVE_KEY_PATTERN = /pass(word)?|token|secret|credential|api[-_]?key|authorization|auth\b/i;

const REDACTED = '[REDACTED]';

/**
 * Deep-clones a value with any object key that looks like a credential
 * (password/token/secret/credential/api key/authorization) replaced with
 * "[REDACTED]" — used before anything from the radio relay layer is
 * passed to console.log/logger calls, so device credentials never end
 * up in application logs (item 9 of the radio relay requirements).
 *
 * Safe against circular references and non-plain values (Error, Date,
 * etc. are returned as-is / stringified rather than walked).
 */
export function sanitizeForLog(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message, code: value.code };
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, seen));
  }

  const result = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeForLog(val, seen);
  }
  return result;
}
