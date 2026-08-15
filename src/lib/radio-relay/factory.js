import 'server-only';
import { MockRadioRelayAdapter } from './adapters/mock-adapter';
import { HttpRadioRelayAdapter } from './adapters/http-adapter';
import { TcpRadioRelayAdapter } from './adapters/tcp-adapter';
import { withResilience } from './resilient-adapter';

/**
 * Builds the RadioRelayAdapter to use, chosen by the RADIO_ADAPTER
 * environment variable ('mock' | 'http' | 'tcp', default 'mock' — safe
 * for local development). Always returns the adapter wrapped with
 * timeout + exponential-backoff retry (see resilient-adapter.js).
 *
 * This is the ONLY place that should ever construct a concrete adapter
 * — relay-service.js (and anything else that needs to talk to a radio
 * device) must go through this factory, never `new HttpRadioRelayAdapter()`
 * etc. directly, so the environment variable stays the single source of
 * truth for which transport is active.
 *
 * Server-only by construction (`import 'server-only'` above, and every
 * concrete adapter file does the same) — this can never be bundled into
 * client code, satisfying "jangan mengeksekusi komunikasi perangkat
 * radio dari browser" (item 12/13 of the radio relay requirements).
 */
export function createRadioRelayAdapter(env = process.env) {
  const kind = (env.RADIO_ADAPTER || 'mock').toLowerCase();

  let adapter;
  switch (kind) {
    case 'http':
      adapter = new HttpRadioRelayAdapter({
        baseUrl: env.RADIO_HTTP_BASE_URL,
        apiKey: env.RADIO_HTTP_API_KEY,
      });
      break;
    case 'tcp':
      adapter = new TcpRadioRelayAdapter({
        host: env.RADIO_TCP_HOST,
        port: env.RADIO_TCP_PORT ? Number(env.RADIO_TCP_PORT) : undefined,
      });
      break;
    case 'mock':
      adapter = new MockRadioRelayAdapter();
      break;
    default:
      throw new Error(`RADIO_ADAPTER tidak dikenal: "${env.RADIO_ADAPTER}". Gunakan "mock", "http", atau "tcp".`);
  }

  return withResilience(adapter, {
    timeoutMs: env.RADIO_ADAPTER_TIMEOUT_MS ? Number(env.RADIO_ADAPTER_TIMEOUT_MS) : 10_000,
    retries: env.RADIO_ADAPTER_RETRIES ? Number(env.RADIO_ADAPTER_RETRIES) : 2,
  });
}
