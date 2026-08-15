import 'server-only';
import { RadioRelayError } from '../errors';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * In-memory radio relay adapter for local development, tests, and demos
 * — never talks to a real device. Implements the same RadioRelayAdapter
 * shape as HttpRadioRelayAdapter/TcpRadioRelayAdapter (see types.js) so
 * it's a drop-in replacement via the factory.
 *
 * Configurable for tests (see relay-news e2e adapter tests):
 *   - `forceOutcome`: 'success' (default) | 'fail' | 'timeout'
 *   - `failCount`: fail the first N calls to relayMessage(), then
 *     succeed — simulates a device that recovers after a retry.
 *   - `latencyMs`: simulated device response time.
 */
export class MockRadioRelayAdapter {
  constructor({ latencyMs = 20, forceOutcome = 'success', failCount = 0 } = {}) {
    this.latencyMs = latencyMs;
    this.forceOutcome = forceOutcome;
    this.failCount = failCount;
    this._relayCallCount = 0;
  }

  async healthCheck() {
    await sleep(this.latencyMs);
    return {
      healthy: this.forceOutcome !== 'timeout',
      latencyMs: this.latencyMs,
      message: 'Mock adapter — selalu sehat, untuk development/testing saja.',
    };
  }

  async relayMessage(input) {
    this._relayCallCount += 1;
    const attemptCount = this._relayCallCount;

    if (this.forceOutcome === 'timeout') {
      // Never resolves on its own — relies on the caller's withTimeout()
      // wrapper (see resilient-adapter.js) to abort and reject.
      await new Promise(() => {});
    }

    await sleep(this.latencyMs);

    const shouldFailThisCall = this.forceOutcome === 'fail' || attemptCount <= this.failCount;
    if (shouldFailThisCall) {
      throw new RadioRelayError(`Simulasi kegagalan relay (mock, percobaan ke-${attemptCount}).`, {
        code: 'MOCK_FAILURE',
      });
    }

    return {
      success: true,
      externalReference: `MOCK-${input.idempotencyKey?.slice(-12) ?? attemptCount}`,
      responseMessage: 'Pesan diterima oleh simulator (mock adapter).',
      correlationId: input.correlationId,
      attemptCount,
      latencyMs: this.latencyMs,
    };
  }

  async cancelRelay(input) {
    await sleep(this.latencyMs);
    return { cancelled: true, correlationId: input.correlationId };
  }
}
