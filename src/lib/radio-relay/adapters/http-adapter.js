import 'server-only';
import { RadioRelayError, RadioRelayFatalError, RadioRelayTimeoutError } from '../errors';

async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Radio relay adapter for devices/gateways that expose an HTTP API.
 *
 * TODO CONFIGURATION REQUIRED: the exact endpoint paths, request body
 * shape, and response schema below (`POST {baseUrl}/relay`,
 * `GET {baseUrl}/health`, `POST {baseUrl}/relay/cancel`) are a
 * placeholder — no real device's HTTP protocol has been specified yet.
 * Update this adapter once the actual device/vendor API is known; the
 * RadioRelayAdapter shape (healthCheck/relayMessage/cancelRelay) and
 * everything else in this module (factory, retry, timeout, idempotency,
 * sanitized logging) should not need to change.
 */
export class HttpRadioRelayAdapter {
  constructor({ baseUrl, apiKey, fetchImpl = fetch } = {}) {
    if (!baseUrl) {
      // Fails fast at construction rather than on first use — a missing
      // RADIO_HTTP_BASE_URL is a deployment misconfiguration, not a
      // transient/retryable error.
      throw new RadioRelayFatalError(
        'RADIO_HTTP_BASE_URL belum diset. TODO CONFIGURATION REQUIRED: konfigurasikan endpoint perangkat radio (HTTP).',
        { code: 'MISSING_CONFIGURATION' }
      );
    }
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  _headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...extra,
    };
  }

  async healthCheck(signal) {
    const startedAt = Date.now();
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/health`, { method: 'GET', headers: this._headers(), signal });
    } catch (error) {
      throw new RadioRelayError(`Tidak dapat menghubungi perangkat radio (HTTP): ${error.message}`, {
        code: 'NETWORK_ERROR',
        cause: error,
      });
    }
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      throw new RadioRelayError(`Health check gagal (HTTP ${response.status}).`, { code: 'HTTP_ERROR' });
    }
    return { healthy: true, latencyMs, message: 'Perangkat radio (HTTP) merespons normal.' };
  }

  async relayMessage(input) {
    const { signal, stationConnectionConfig, ...body } = input;
    const startedAt = Date.now();

    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/relay`, {
        method: 'POST',
        headers: this._headers({
          'Idempotency-Key': input.idempotencyKey,
          'X-Correlation-Id': input.correlationId,
        }),
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new RadioRelayTimeoutError('Permintaan relay (HTTP) melebihi batas waktu.', { cause: error });
      }
      throw new RadioRelayError(`Gagal menghubungi perangkat radio (HTTP): ${error.message}`, {
        code: 'NETWORK_ERROR',
        cause: error,
      });
    }

    const latencyMs = Date.now() - startedAt;

    // 4xx (other than 408/429, which are typically transient) means the
    // device rejected the request itself — retrying the same payload
    // won't help, so this is fatal/non-retryable.
    if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
      const details = await safeText(response);
      throw new RadioRelayFatalError(`Perangkat radio menolak permintaan relay (HTTP ${response.status}).`, {
        code: 'HTTP_CLIENT_ERROR',
        details,
      });
    }
    if (!response.ok) {
      const details = await safeText(response);
      throw new RadioRelayError(`Perangkat radio (HTTP) mengembalikan error (HTTP ${response.status}).`, {
        code: 'HTTP_SERVER_ERROR',
        details,
      });
    }

    const data = await response.json().catch(() => ({}));
    return {
      success: true,
      externalReference: data.externalReference ?? data.reference ?? null,
      responseMessage: data.message ?? null,
      correlationId: input.correlationId,
      attemptCount: 1,
      latencyMs,
    };
  }

  async cancelRelay(input) {
    const { signal, ...body } = input;
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/relay/cancel`, {
        method: 'POST',
        headers: this._headers({ 'X-Correlation-Id': input.correlationId }),
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      return { cancelled: false, errorMessage: error.message, correlationId: input.correlationId };
    }
    if (!response.ok) {
      return { cancelled: false, errorMessage: `HTTP ${response.status}`, correlationId: input.correlationId };
    }
    return { cancelled: true, correlationId: input.correlationId };
  }
}
