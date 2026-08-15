import 'server-only';

/**
 * Checks Supabase database connectivity/latency with the cheapest
 * possible real query — a `head`-only count against a tiny, always-
 * present table, so no rows are actually transferred.
 */
export class DatabaseHealthAdapter {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async checkHealth() {
    const startedAt = Date.now();
    const { error } = await this.supabase.from('roles').select('code', { count: 'exact', head: true });
    const latencyMs = Date.now() - startedAt;

    if (error) {
      throw new Error(`Query database gagal: ${error.message}`);
    }
    return { latencyMs };
  }
}
