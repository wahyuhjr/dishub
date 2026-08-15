import { describe, expect, it, vi } from 'vitest';
import { retryWithBackoff } from './retry';
import { RadioRelayError, RadioRelayFatalError } from './errors';

const instantSleep = async () => {};

describe('retryWithBackoff', () => {
  it('returns the result immediately on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { retries: 3, sleepFn: instantSleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a retryable error and succeeds within the retry budget', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RadioRelayError('temporary'))
      .mockRejectedValueOnce(new RadioRelayError('temporary again'))
      .mockResolvedValueOnce('ok');

    const onRetry = vi.fn();
    const result = await retryWithBackoff(fn, { retries: 3, sleepFn: instantSleep, onRetry });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('throws the last error once the retry budget is exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new RadioRelayError('always fails'));

    await expect(retryWithBackoff(fn, { retries: 2, sleepFn: instantSleep })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
  });

  it('never retries a RadioRelayFatalError', async () => {
    const fn = vi.fn().mockRejectedValue(new RadioRelayFatalError('bad request'));

    await expect(retryWithBackoff(fn, { retries: 5, sleepFn: instantSleep })).rejects.toBeInstanceOf(
      RadioRelayFatalError
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses exponential backoff delays', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RadioRelayError('e1'))
      .mockRejectedValueOnce(new RadioRelayError('e2'))
      .mockResolvedValueOnce('ok');
    const delays = [];

    await retryWithBackoff(fn, {
      retries: 3,
      baseDelayMs: 100,
      sleepFn: async (ms) => {
        delays.push(ms);
      },
    });

    expect(delays).toEqual([100, 200]);
  });
});
