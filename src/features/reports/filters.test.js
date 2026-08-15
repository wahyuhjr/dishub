import { describe, it, expect } from 'vitest';
import {
  jakartaDayStartUtc,
  jakartaDayEndUtc,
  parseReportFilters,
  PAGE_SIZE,
} from './filters';

describe('jakarta timezone date helpers', () => {
  it('converts a Jakarta calendar day start to the correct UTC instant', () => {
    // 2026-08-15 00:00 WIB (+07:00) === 2026-08-14 17:00 UTC.
    expect(jakartaDayStartUtc('2026-08-15')).toBe('2026-08-14T17:00:00.000Z');
  });

  it('converts a Jakarta calendar day end (inclusive) to the correct UTC instant', () => {
    // 2026-08-15 23:59:59.999 WIB === 2026-08-15 16:59:59.999 UTC.
    expect(jakartaDayEndUtc('2026-08-15')).toBe('2026-08-15T16:59:59.999Z');
  });

  it('returns null for empty or malformed dates', () => {
    expect(jakartaDayStartUtc('')).toBeNull();
    expect(jakartaDayStartUtc(undefined)).toBeNull();
    expect(jakartaDayStartUtc('15-08-2026')).toBeNull();
    expect(jakartaDayEndUtc('not-a-date')).toBeNull();
  });

  it('produces a range where start is strictly before end for the same day', () => {
    const start = jakartaDayStartUtc('2026-01-01');
    const end = jakartaDayEndUtc('2026-01-01');
    expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime());
  });
});

describe('parseReportFilters — date filter', () => {
  it('keeps valid dates and pre-computes UTC bounds', () => {
    const f = parseReportFilters({ from: '2026-08-01', to: '2026-08-15' });
    expect(f.dateFrom).toBe('2026-08-01');
    expect(f.dateTo).toBe('2026-08-15');
    expect(f.dateFromUtc).toBe('2026-07-31T17:00:00.000Z');
    expect(f.dateToUtc).toBe('2026-08-15T16:59:59.999Z');
  });

  it('drops invalid dates and yields null UTC bounds', () => {
    const f = parseReportFilters({ from: '2026/08/01', to: 'yesterday' });
    expect(f.dateFrom).toBe('');
    expect(f.dateTo).toBe('');
    expect(f.dateFromUtc).toBeNull();
    expect(f.dateToUtc).toBeNull();
  });
});

describe('parseReportFilters — status & other filters', () => {
  it('accepts a known status and rejects an unknown one', () => {
    expect(parseReportFilters({ status: 'RELAYED' }).status).toBe('RELAYED');
    expect(parseReportFilters({ status: 'BOGUS' }).status).toBe('');
  });

  it('accepts a known message type and rejects an unknown one', () => {
    expect(parseReportFilters({ type: 'DISTRESS' }).type).toBe('DISTRESS');
    expect(parseReportFilters({ type: 'HELLO' }).type).toBe('');
  });

  it('only accepts UUID-shaped operator/station ids', () => {
    const uuid = '11111111-2222-3333-4444-555555555555';
    expect(parseReportFilters({ operator: uuid }).operatorId).toBe(uuid);
    expect(parseReportFilters({ operator: 'abc' }).operatorId).toBe('');
    expect(parseReportFilters({ station: uuid }).stationId).toBe(uuid);
    expect(parseReportFilters({ station: '123' }).stationId).toBe('');
  });

  it('whitelists sort column and direction, defaulting safely', () => {
    expect(parseReportFilters({ sort: 'status', dir: 'asc' })).toMatchObject({ sortBy: 'status', sortDir: 'asc' });
    expect(parseReportFilters({ sort: 'DROP TABLE', dir: 'sideways' })).toMatchObject({ sortBy: 'received_at', sortDir: 'desc' });
  });

  it('clamps page to a minimum of 1', () => {
    expect(parseReportFilters({ page: '0' }).page).toBe(1);
    expect(parseReportFilters({ page: '-5' }).page).toBe(1);
    expect(parseReportFilters({ page: '3' }).page).toBe(3);
    expect(parseReportFilters({ page: 'abc' }).page).toBe(1);
  });
});

describe('constants', () => {
  it('exposes a positive page size', () => {
    expect(PAGE_SIZE).toBeGreaterThan(0);
  });
});
