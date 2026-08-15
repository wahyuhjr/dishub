/**
 * Base error for anything that goes wrong talking to a radio relay
 * device. Retryable by default (see retry.js) — use RadioRelayFatalError
 * for errors that retrying will never fix (e.g. the device rejected the
 * request as malformed).
 */
export class RadioRelayError extends Error {
  constructor(message, { code, cause, details } = {}) {
    super(message);
    this.name = 'RadioRelayError';
    this.code = code ?? 'RADIO_RELAY_ERROR';
    this.details = details;
    if (cause) this.cause = cause;
  }
}

/** A relay/health-check call exceeded its timeout budget. Retryable. */
export class RadioRelayTimeoutError extends RadioRelayError {
  constructor(message = 'Permintaan ke perangkat radio melebihi batas waktu.', opts = {}) {
    super(message, { ...opts, code: 'TIMEOUT' });
    this.name = 'RadioRelayTimeoutError';
  }
}

/**
 * A non-retryable failure (e.g. the device/API rejected the request as
 * invalid — retrying the exact same request will just fail again).
 */
export class RadioRelayFatalError extends RadioRelayError {
  constructor(message, opts = {}) {
    super(message, { ...opts, code: opts.code ?? 'FATAL' });
    this.name = 'RadioRelayFatalError';
  }
}
