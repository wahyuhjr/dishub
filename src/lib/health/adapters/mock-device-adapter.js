import 'server-only';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock device adapter for radio/AIS/VTS/station checks — used whenever
 * no real device integration is configured yet (item 15: "Tambahkan
 * mock adapters jika perangkat radio/AIS/VTS belum tersedia"). This is
 * the current default for every device category since none of these
 * physical devices are wired up in this deployment.
 *
 * Configurable for tests:
 *   - `forceOutcome`: 'online' (default) | 'degraded' | 'offline' | 'timeout'
 *   - `latencyMs`: simulated response time for 'online'/'degraded'.
 */
export class MockDeviceAdapter {
  constructor({ latencyMs = 80, forceOutcome = 'online' } = {}) {
    this.latencyMs = latencyMs;
    this.forceOutcome = forceOutcome;
  }

  async checkHealth() {
    if (this.forceOutcome === 'timeout') {
      // Never resolves on its own — relies on the caller's withTimeout() wrapper.
      await new Promise(() => {});
    }

    if (this.forceOutcome === 'offline') {
      await sleep(this.latencyMs);
      throw new Error('Perangkat (mock) tidak merespons.');
    }

    await sleep(this.latencyMs);
    return { latencyMs: this.latencyMs };
  }
}
