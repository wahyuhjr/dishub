import { RadioRelayFatalError } from './errors';

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries `fn(attemptIndex)` with exponential backoff (attempt 0, 1, 2,
 * ... up to `retries` extra attempts after the first). Never retries a
 * RadioRelayFatalError (the request is invalid — retrying changes
 * nothing). `sleepFn` is injectable so tests can run this instantly
 * instead of waiting on real timers.
 */
export async function retryWithBackoff(
  fn,
  { retries = 2, baseDelayMs = 300, maxDelayMs = 4000, onRetry, sleepFn = defaultSleep } = {}
) {
  let attempt = 0;

  for (;;) {
    try {
      return await fn(attempt);
    } catch (error) {
      const isLastAttempt = attempt >= retries;
      const isFatal = error instanceof RadioRelayFatalError;

      if (isLastAttempt || isFatal) {
        throw error;
      }

      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      onRetry?.(error, attempt, delay);
      await sleepFn(delay);
      attempt += 1;
    }
  }
}
