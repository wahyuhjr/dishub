import 'server-only';
import { RadioRelayFatalError } from '../errors';

/**
 * Placeholder adapter for maritime radio devices/gateways that speak a
 * raw TCP/socket protocol (e.g. a serial-over-TCP modem, a proprietary
 * DSC controller, etc.) instead of HTTP.
 *
 * TODO CONFIGURATION REQUIRED: no such device's wire protocol (framing,
 * handshake, encoding, ack/nack format) has been specified yet, so this
 * adapter deliberately does not open a real socket — it fails fast with
 * a clear, non-retryable error instead of silently pretending to work.
 * Implement `_send()` (and healthCheck/cancelRelay similarly) once the
 * real protocol is known; the RadioRelayAdapter shape and the rest of
 * this module (factory, retry, timeout, idempotency key, sanitized
 * logging) should not need to change.
 */
export class TcpRadioRelayAdapter {
  constructor({ host, port } = {}) {
    this.host = host;
    this.port = port;
  }

  _notConfigured(action) {
    throw new RadioRelayFatalError(
      `TcpRadioRelayAdapter.${action}() belum diimplementasikan. ` +
        'TODO CONFIGURATION REQUIRED: definisikan protokol TCP/socket perangkat radio (framing, handshake, ack/nack) sebelum mengaktifkan RADIO_ADAPTER=tcp di production.',
      { code: 'NOT_IMPLEMENTED' }
    );
  }

  async healthCheck() {
    this._notConfigured('healthCheck');
  }

  async relayMessage() {
    this._notConfigured('relayMessage');
  }

  async cancelRelay() {
    this._notConfigured('cancelRelay');
  }
}
