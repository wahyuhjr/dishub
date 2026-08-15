import { HealthCheckTimeoutError } from './errors';

/**
 * Runs `fn()` and rejects with a HealthCheckTimeoutError if it hasn't
 * settled within `timeoutMs` (item 6 — "Gunakan timeout agar health
 * check tidak menggantung"). Uses Promise.race so this always rejects
 * on schedule even if `fn` itself never settles (e.g. a mock/device
 * adapter simulating a hung device).
 */
export async function withTimeout(fn, timeoutMs) {
  let timer;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new HealthCheckTimeoutError(`Pemeriksaan melebihi batas waktu ${timeoutMs}ms.`)), timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}
