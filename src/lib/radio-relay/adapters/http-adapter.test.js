import { describe, expect, it, vi } from 'vitest';
import { HttpRadioRelayAdapter } from './http-adapter';
import { RadioRelayFatalError, RadioRelayError } from '../errors';

function fakeFetch(responses) {
  let call = 0;
  return vi.fn(async () => {
    const response = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return response;
  });
}

const baseInput = {
  messageId: 'm1',
  stationId: 's1',
  messageNumber: 'BB-2026-0001',
  messageType: 'DISTRESS',
  content: 'test',
  idempotencyKey: 'idem-1',
  correlationId: 'corr-1',
};

describe('HttpRadioRelayAdapter', () => {
  it('throws a fatal error when constructed without a base URL', () => {
    expect(() => new HttpRadioRelayAdapter({})).toThrow(RadioRelayFatalError);
  });

  it('relays successfully and maps the JSON response', async () => {
    const fetchImpl = fakeFetch([
      { ok: true, status: 200, json: async () => ({ externalReference: 'REF-1', message: 'diterima' }) },
    ]);
    const adapter = new HttpRadioRelayAdapter({ baseUrl: 'http://device.local', fetchImpl });

    const result = await adapter.relayMessage(baseInput);

    expect(result.success).toBe(true);
    expect(result.externalReference).toBe('REF-1');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://device.local/relay',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'idem-1', 'X-Correlation-Id': 'corr-1' }),
      })
    );
  });

  it('throws a fatal (non-retryable) error on a 4xx response', async () => {
    const fetchImpl = fakeFetch([{ ok: false, status: 400, text: async () => 'invalid payload' }]);
    const adapter = new HttpRadioRelayAdapter({ baseUrl: 'http://device.local', fetchImpl });

    await expect(adapter.relayMessage(baseInput)).rejects.toBeInstanceOf(RadioRelayFatalError);
  });

  it('throws a retryable error on a 5xx response', async () => {
    const fetchImpl = fakeFetch([{ ok: false, status: 503, text: async () => 'unavailable' }]);
    const adapter = new HttpRadioRelayAdapter({ baseUrl: 'http://device.local', fetchImpl });

    await expect(adapter.relayMessage(baseInput)).rejects.toBeInstanceOf(RadioRelayError);
    await expect(adapter.relayMessage(baseInput)).rejects.not.toBeInstanceOf(RadioRelayFatalError);
  });
});
