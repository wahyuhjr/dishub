import 'server-only';

/**
 * Checks the app server itself — confirms the Node.js event loop is
 * responsive (a wedged/overloaded event loop is the classic "app is up
 * but not really working" failure mode). No external calls: this is
 * the one check that never depends on network/database availability.
 */
export class ServerHealthAdapter {
  async checkHealth() {
    const startedAt = Date.now();
    await new Promise((resolve) => setImmediate(resolve));
    return { latencyMs: Date.now() - startedAt };
  }
}
