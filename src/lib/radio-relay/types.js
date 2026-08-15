/**
 * Shared JSDoc type definitions for the radio relay adapter abstraction
 * layer (src/lib/radio-relay/**). This project is plain JavaScript (no
 * TypeScript), so `RadioRelayAdapter` is documented here as a duck-typed
 * "interface": every adapter class (Mock/Http/Tcp) implements these
 * three async methods with these exact shapes. Consumers should treat
 * adapters polymorphically and never branch on `instanceof` a concrete
 * adapter class.
 *
 * @typedef {Object} HealthCheckResult
 * @property {boolean} healthy
 * @property {number} [latencyMs]
 * @property {string} [message]
 *
 * @typedef {Object} RelayMessageInput
 * @property {string} messageId
 * @property {string} stationId
 * @property {string} messageNumber
 * @property {string} messageType   'DISTRESS' | 'URGENCY' | 'SAFETY' | 'NTM'
 * @property {string} content
 * @property {string} idempotencyKey  Stable across internal retries of the SAME logical relay attempt.
 * @property {string} correlationId   For tracing this request across logs/systems.
 * @property {Object} [stationConnectionConfig]  Non-secret connection metadata from stations.connection_config.
 *
 * @typedef {Object} RelayResult
 * @property {boolean} success
 * @property {string} [externalReference]  Opaque reference from the receiving device/system, if any.
 * @property {string} [responseMessage]
 * @property {string} [errorMessage]  Set when success is false.
 * @property {string} correlationId
 * @property {number} [attemptCount]
 * @property {number} [latencyMs]
 *
 * @typedef {Object} CancelRelayInput
 * @property {string} messageId
 * @property {string} [externalReference]
 * @property {string} correlationId
 *
 * @typedef {Object} CancelRelayResult
 * @property {boolean} cancelled
 * @property {string} [errorMessage]
 * @property {string} correlationId
 *
 * @typedef {Object} RadioRelayAdapter
 * @property {function(): Promise<HealthCheckResult>} healthCheck
 * @property {function(RelayMessageInput): Promise<RelayResult>} relayMessage
 * @property {function(CancelRelayInput): Promise<CancelRelayResult>} cancelRelay
 */

export {};
