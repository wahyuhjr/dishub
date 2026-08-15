import 'server-only';

/**
 * Checks outbound internet/upstream connectivity from the app server's
 * perspective — reaches the Supabase project's own REST endpoint (the
 * one upstream service this app genuinely depends on) rather than some
 * unrelated third-party URL. Any HTTP response (even 401/404) proves
 * the network path is up; only a network-level failure (DNS, timeout,
 * connection refused) counts as unreachable.
 */
export class InternetHealthAdapter {
  constructor({ fetchImpl = fetch } = {}) {
    this.fetchImpl = fetchImpl;
  }

  async checkHealth() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL belum diset.');
    }

    const startedAt = Date.now();
    try {
      await this.fetchImpl(`${url}/auth/v1/health`, { method: 'GET' });
    } catch (error) {
      throw new Error(`Tidak dapat menjangkau upstream service: ${error.message}`);
    }
    return { latencyMs: Date.now() - startedAt };
  }
}
