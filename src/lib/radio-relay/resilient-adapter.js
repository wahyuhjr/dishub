import { withTimeout } from './with-timeout';
import { retryWithBackoff } from './retry';

/**
 * Wraps any RadioRelayAdapter with a timeout + exponential-backoff retry
 * policy, applied uniformly regardless of which concrete adapter
 * (Mock/Http/Tcp) is underneath — items 5 and 6 of the radio relay
 * requirements. `adapter.relayMessage`/`healthCheck`/`cancelRelay`
 * receive an extra `signal` property on their input so fetch-based
 * adapters can actually cancel the in-flight request on timeout.
 *
 * Only `relayMessage` is retried: retrying a health check or a cancel
 * request that already timed out isn't meaningful in the same way, and
 * keeps this decorator simple.
 */
export function withResilience(
  adapter,
  { timeoutMs = 10_000, retries = 2, baseDelayMs = 300, maxDelayMs = 4000, sleepFn, onRetry } = {}
) {
  return {
    async healthCheck() {
      return withTimeout((signal) => adapter.healthCheck(signal), timeoutMs);
    },

    async relayMessage(input) {
      return retryWithBackoff(
        () => withTimeout((signal) => adapter.relayMessage({ ...input, signal }), timeoutMs),
        { retries, baseDelayMs, maxDelayMs, sleepFn, onRetry }
      );
    },

    async cancelRelay(input) {
      return withTimeout((signal) => adapter.cancelRelay({ ...input, signal }), timeoutMs);
    },
  };
}
