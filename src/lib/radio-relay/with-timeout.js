import { RadioRelayTimeoutError } from './errors';

/**
 * Runs `fn(signal)` and rejects with a RadioRelayTimeoutError if it
 * hasn't settled within `timeoutMs`. `fn` receives an AbortSignal so
 * adapters that use `fetch` (HttpRadioRelayAdapter) can actually cancel
 * the in-flight request rather than just ignoring its eventual result.
 *
 * Uses Promise.race rather than relying solely on the AbortSignal: a
 * `fn` that doesn't itself check/honor the signal (e.g. a raw socket
 * call, or a test double) would otherwise hang forever instead of
 * timing out — the race guarantees this always rejects on schedule
 * regardless of whether `fn` cooperates with cancellation.
 */
export async function withTimeout(fn, timeoutMs) {
  const controller = new AbortController();
  let timer;

  const timeoutPromise = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new RadioRelayTimeoutError(`Operasi melebihi batas waktu ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}
