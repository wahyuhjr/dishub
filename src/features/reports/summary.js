/**
 * Pure aggregation for the reports module. Given the filtered report
 * rows (already fetched server-side, RLS-scoped), computes the summary
 * counters shown at the top of /dashboard/laporan.
 *
 * Kept side-effect free and dependency-free so it can be unit tested
 * directly (see summary.test.js, requirement "test hasil agregasi") and
 * reused by the export Route Handler.
 *
 * Expected row shape (see reports/dal.js LIST_SELECT):
 *   {
 *     status, received_at, relayed_at,
 *     operator: { id, username, full_name } | null,
 *     origin_station: { id, station_code, station_name } | null,
 *   }
 */

function relaySeconds(row) {
  if (!row.relayed_at || !row.received_at) return null;
  const start = new Date(row.received_at).getTime();
  const end = new Date(row.relayed_at).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / 1000;
}

function operatorLabel(op) {
  if (!op) return '—';
  return op.full_name || op.username || '—';
}

function stationLabel(st) {
  if (!st) return '—';
  return st.station_name || st.station_code || '—';
}

export function computeReportSummary(rows = []) {
  let relayedCount = 0;
  let failedCount = 0;
  let delayedCount = 0;

  let relaySecondsSum = 0;
  let relaySecondsN = 0;

  const perOperatorMap = new Map();
  const perStationMap = new Map();

  for (const row of rows) {
    if (row.status === 'RELAYED') relayedCount += 1;
    else if (row.status === 'FAILED') failedCount += 1;
    else if (row.status === 'DELAYED') delayedCount += 1;

    const secs = relaySeconds(row);
    if (secs !== null) {
      relaySecondsSum += secs;
      relaySecondsN += 1;
    }

    const opKey = row.operator?.id ?? '__none__';
    const opEntry = perOperatorMap.get(opKey) ?? { id: row.operator?.id ?? null, name: operatorLabel(row.operator), total: 0, relayed: 0 };
    opEntry.total += 1;
    if (row.status === 'RELAYED') opEntry.relayed += 1;
    perOperatorMap.set(opKey, opEntry);

    const stKey = row.origin_station?.id ?? '__none__';
    const stEntry = perStationMap.get(stKey) ?? { id: row.origin_station?.id ?? null, name: stationLabel(row.origin_station), total: 0, relayed: 0 };
    stEntry.total += 1;
    if (row.status === 'RELAYED') stEntry.relayed += 1;
    perStationMap.set(stKey, stEntry);
  }

  const perOperator = [...perOperatorMap.values()].sort((a, b) => b.total - a.total);
  const perStation = [...perStationMap.values()].sort((a, b) => b.total - a.total);

  return {
    total: rows.length,
    relayedCount,
    failedCount,
    delayedCount,
    avgRelaySeconds: relaySecondsN > 0 ? relaySecondsSum / relaySecondsN : null,
    perOperator,
    perStation,
  };
}

/** Formats an average relay duration (seconds) into a human string, e.g. "2j 5m 30d". */
export function formatRelayDuration(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined) return '—';
  const s = Math.round(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const parts = [];
  if (hours) parts.push(`${hours}j`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}d`);
  return parts.join(' ');
}
