import { sanitizeForLog } from './sanitize-log';

/**
 * Structured console log for radio relay events, always run through
 * sanitizeForLog() first so credentials/tokens/passwords never end up
 * in application logs (item 9 of the radio relay requirements). Use
 * this instead of calling console.log directly with adapter input/output.
 */
export function logRelayEvent(event, payload) {
  console.log(`[radio-relay] ${event}`, sanitizeForLog(payload));
}
