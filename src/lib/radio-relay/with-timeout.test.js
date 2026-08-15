import { describe, expect, it } from 'vitest';
import { withTimeout } from './with-timeout';
import { RadioRelayTimeoutError } from './errors';

describe('withTimeout', () => {
  it('resolves normally when fn finishes before the timeout', async () => {
    const result = await withTimeout(async () => 'ok', 50);
    expect(result).toBe('ok');
  });

  it('rejects with RadioRelayTimeoutError when fn never settles in time', async () => {
    await expect(
      withTimeout(() => new Promise(() => {}), 20)
    ).rejects.toBeInstanceOf(RadioRelayTimeoutError);
  });

  it('aborts the signal passed to fn on timeout', async () => {
    let observedSignal;
    await expect(
      withTimeout((signal) => {
        observedSignal = signal;
        return new Promise(() => {});
      }, 20)
    ).rejects.toThrow();
    expect(observedSignal.aborted).toBe(true);
  });

  it('propagates a non-timeout error from fn as-is', async () => {
    const boom = new Error('boom');
    await expect(withTimeout(() => Promise.reject(boom), 50)).rejects.toBe(boom);
  });
});
