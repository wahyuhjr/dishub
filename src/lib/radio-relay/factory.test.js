import { describe, expect, it } from 'vitest';
import { createRadioRelayAdapter } from './factory';
import { RadioRelayFatalError } from './errors';

describe('createRadioRelayAdapter (factory)', () => {
  it('defaults to the mock adapter when RADIO_ADAPTER is unset', async () => {
    const adapter = createRadioRelayAdapter({});
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it('builds the mock adapter explicitly for RADIO_ADAPTER=mock', async () => {
    const adapter = createRadioRelayAdapter({ RADIO_ADAPTER: 'mock' });
    const result = await adapter.relayMessage({
      messageId: 'm1',
      stationId: 's1',
      idempotencyKey: 'k1',
      correlationId: 'c1',
    });
    expect(result.success).toBe(true);
  });

  it('throws a fatal, non-retryable error building the http adapter without a base URL configured', () => {
    expect(() => createRadioRelayAdapter({ RADIO_ADAPTER: 'http' })).toThrow(RadioRelayFatalError);
  });

  it('builds the tcp placeholder adapter, which fails clearly (not implemented) rather than pretending to work', async () => {
    const adapter = createRadioRelayAdapter({ RADIO_ADAPTER: 'tcp', RADIO_ADAPTER_RETRIES: '0' });
    await expect(
      adapter.relayMessage({ messageId: 'm1', stationId: 's1', idempotencyKey: 'k1', correlationId: 'c1' })
    ).rejects.toBeInstanceOf(RadioRelayFatalError);
  });

  it('rejects an unknown RADIO_ADAPTER value', () => {
    expect(() => createRadioRelayAdapter({ RADIO_ADAPTER: 'carrier-pigeon' })).toThrow(/tidak dikenal/);
  });
});
