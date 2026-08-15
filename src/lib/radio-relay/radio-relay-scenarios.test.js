import { describe, expect, it, vi } from 'vitest';
import { withResilience } from './resilient-adapter';
import { MockRadioRelayAdapter } from './adapters/mock-adapter';
import { RadioRelayTimeoutError } from './errors';

const instantSleep = async () => {};

function buildInput(overrides = {}) {
  return {
    messageId: 'msg-1',
    stationId: 'station-1',
    messageNumber: 'BB-2026-0001',
    messageType: 'DISTRESS',
    content: 'Kapal tenggelam di perairan Merauke.',
    idempotencyKey: 'idem-test-1',
    correlationId: 'corr-test-1',
    ...overrides,
  };
}

describe('radio relay adapter — success/timeout/retry/failure scenarios', () => {
  it('relays successfully on the first attempt (success scenario)', async () => {
    const mock = new MockRadioRelayAdapter({ latencyMs: 1, forceOutcome: 'success' });
    const adapter = withResilience(mock, { timeoutMs: 200, retries: 2, sleepFn: instantSleep });

    const result = await adapter.relayMessage(buildInput());

    expect(result.success).toBe(true);
    expect(result.correlationId).toBe('corr-test-1');
    expect(result.attemptCount).toBe(1);
  });

  it('times out and rejects with RadioRelayTimeoutError when the device never responds (timeout scenario)', async () => {
    const mock = new MockRadioRelayAdapter({ forceOutcome: 'timeout' });
    // retries: 0 so we see the raw timeout behavior in isolation.
    const adapter = withResilience(mock, { timeoutMs: 30, retries: 0, sleepFn: instantSleep });

    await expect(adapter.relayMessage(buildInput())).rejects.toBeInstanceOf(RadioRelayTimeoutError);
  });

  it('retries a transient failure and succeeds (retry scenario)', async () => {
    // Fails the first 2 calls, then succeeds on the 3rd.
    const mock = new MockRadioRelayAdapter({ latencyMs: 1, failCount: 2 });
    const onRetry = vi.fn();
    const adapter = withResilience(mock, { timeoutMs: 200, retries: 3, sleepFn: instantSleep, onRetry });

    const result = await adapter.relayMessage(buildInput());

    expect(result.success).toBe(true);
    expect(result.attemptCount).toBe(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('exhausts retries and surfaces the failure (relay failure scenario)', async () => {
    const mock = new MockRadioRelayAdapter({ latencyMs: 1, forceOutcome: 'fail' });
    const adapter = withResilience(mock, { timeoutMs: 200, retries: 2, sleepFn: instantSleep });

    await expect(adapter.relayMessage(buildInput())).rejects.toThrow(/Simulasi kegagalan relay/);
  });

  it('healthCheck reports healthy for a normal mock adapter', async () => {
    const mock = new MockRadioRelayAdapter({ latencyMs: 1 });
    const adapter = withResilience(mock, { timeoutMs: 200 });

    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
  });
});
