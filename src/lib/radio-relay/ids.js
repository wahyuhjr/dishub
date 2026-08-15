import { randomUUID } from 'node:crypto';

/**
 * One correlation ID per logical relay request, threaded through the
 * adapter call, every retry attempt, and the eventual relay_attempts /
 * activity_logs rows — so a single relay action can be traced end to
 * end across logs and tables (item 8 of the radio relay requirements).
 */
export function generateCorrelationId() {
  return `corr_${randomUUID()}`;
}

/**
 * One idempotency key per logical relay request (generated once, then
 * reused across every internal retry of that same request) — lets the
 * receiving device/API recognize and de-duplicate a request it already
 * processed, even if a retry is triggered by a lost response rather
 * than a genuine failure (item 7: "berita tidak terkirim dua kali").
 */
export function generateIdempotencyKey() {
  return `idem_${randomUUID()}`;
}
