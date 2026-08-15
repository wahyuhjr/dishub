import { describe, it, expect } from 'vitest';
import { computeReportSummary, formatRelayDuration } from './summary';

const op1 = { id: 'op-1', username: 'andi', full_name: 'Andi Saputra' };
const op2 = { id: 'op-2', username: 'budi', full_name: 'Budi Hartono' };
const stA = { id: 'st-a', station_code: 'JKT', station_name: 'Jakarta Radio' };
const stB = { id: 'st-b', station_code: 'SBY', station_name: 'Surabaya Radio' };

function row({ status, received_at, relayed_at = null, operator = op1, origin_station = stA }) {
  return { status, received_at, relayed_at, operator, origin_station };
}

describe('computeReportSummary — counters', () => {
  const rows = [
    row({ status: 'RELAYED', received_at: '2026-08-15T00:00:00Z', relayed_at: '2026-08-15T00:10:00Z' }),
    row({ status: 'RELAYED', received_at: '2026-08-15T01:00:00Z', relayed_at: '2026-08-15T01:20:00Z', operator: op2, origin_station: stB }),
    row({ status: 'FAILED', received_at: '2026-08-15T02:00:00Z' }),
    row({ status: 'DELAYED', received_at: '2026-08-15T03:00:00Z' }),
    row({ status: 'VERIFIED', received_at: '2026-08-15T04:00:00Z' }),
  ];

  const summary = computeReportSummary(rows);

  it('counts totals per relay outcome', () => {
    expect(summary.total).toBe(5);
    expect(summary.relayedCount).toBe(2);
    expect(summary.failedCount).toBe(1);
    expect(summary.delayedCount).toBe(1);
  });

  it('averages relay duration only over rows that were actually relayed', () => {
    // 10 min (600s) and 20 min (1200s) -> avg 900s.
    expect(summary.avgRelaySeconds).toBe(900);
  });
});

describe('computeReportSummary — grouping', () => {
  const rows = [
    row({ status: 'RELAYED', received_at: '2026-08-15T00:00:00Z', relayed_at: '2026-08-15T00:10:00Z', operator: op1, origin_station: stA }),
    row({ status: 'FAILED', received_at: '2026-08-15T01:00:00Z', operator: op1, origin_station: stA }),
    row({ status: 'RELAYED', received_at: '2026-08-15T02:00:00Z', relayed_at: '2026-08-15T02:05:00Z', operator: op2, origin_station: stB }),
  ];

  const summary = computeReportSummary(rows);

  it('aggregates relay per operator (sorted by total desc)', () => {
    expect(summary.perOperator[0]).toMatchObject({ id: 'op-1', name: 'Andi Saputra', total: 2, relayed: 1 });
    expect(summary.perOperator[1]).toMatchObject({ id: 'op-2', name: 'Budi Hartono', total: 1, relayed: 1 });
  });

  it('aggregates relay per station (origin)', () => {
    const jkt = summary.perStation.find((s) => s.id === 'st-a');
    const sby = summary.perStation.find((s) => s.id === 'st-b');
    expect(jkt).toMatchObject({ name: 'Jakarta Radio', total: 2, relayed: 1 });
    expect(sby).toMatchObject({ name: 'Surabaya Radio', total: 1, relayed: 1 });
  });
});

describe('computeReportSummary — edge cases', () => {
  it('returns zeroed summary for no rows', () => {
    const s = computeReportSummary([]);
    expect(s).toMatchObject({ total: 0, relayedCount: 0, failedCount: 0, delayedCount: 0, avgRelaySeconds: null });
    expect(s.perOperator).toEqual([]);
    expect(s.perStation).toEqual([]);
  });

  it('ignores relayed_at that predates received_at', () => {
    const s = computeReportSummary([row({ status: 'RELAYED', received_at: '2026-08-15T02:00:00Z', relayed_at: '2026-08-15T01:00:00Z' })]);
    expect(s.avgRelaySeconds).toBeNull();
  });

  it('groups rows with a missing operator/station under a single bucket', () => {
    const s = computeReportSummary([
      row({ status: 'RELAYED', received_at: '2026-08-15T00:00:00Z', relayed_at: '2026-08-15T00:10:00Z', operator: null, origin_station: null }),
      row({ status: 'FAILED', received_at: '2026-08-15T01:00:00Z', operator: null, origin_station: null }),
    ]);
    expect(s.perOperator).toHaveLength(1);
    expect(s.perOperator[0]).toMatchObject({ id: null, name: '—', total: 2 });
    expect(s.perStation).toHaveLength(1);
  });
});

describe('formatRelayDuration', () => {
  it('formats durations across units', () => {
    expect(formatRelayDuration(null)).toBe('—');
    expect(formatRelayDuration(45)).toBe('45d');
    expect(formatRelayDuration(90)).toBe('1m 30d');
    expect(formatRelayDuration(3661)).toBe('1j 1m 1d');
  });
});
