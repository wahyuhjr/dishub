/** Raised when a health check adapter doesn't respond within its timeout budget. */
export class HealthCheckTimeoutError extends Error {
  constructor(message = 'Pemeriksaan kesehatan melebihi batas waktu.') {
    super(message);
    this.name = 'HealthCheckTimeoutError';
  }
}
