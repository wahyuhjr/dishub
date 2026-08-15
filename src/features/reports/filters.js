/**
 * Pure (no I/O) helpers for the /dashboard/laporan reports module.
 *
 * Kept free of `server-only`, Supabase, and Next.js imports so the
 * filter-normalization and Asia/Jakarta timezone logic can be unit
 * tested in isolation (see filters.test.js) and reused by both the page
 * and the export Route Handler.
 */

export const PAGE_SIZE = 25;

/** Columns a report may be sorted by (whitelist — never trust raw input). */
export const SORTABLE_COLUMNS = ['received_at', 'relayed_at', 'message_number', 'status', 'message_type'];

export const MESSAGE_TYPE_LABELS = {
  DISTRESS: 'Distress',
  URGENCY: 'Urgency',
  SAFETY: 'Safety',
  NTM: 'Notice To Marine',
};

/** All maritime_messages statuses, used for the "Status relay" filter. */
export const STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_VERIFICATION: 'Menunggu Verifikasi',
  VERIFIED: 'Terverifikasi',
  RELAYING: 'Sedang Relay',
  RELAYED: 'Berhasil Relay',
  FAILED: 'Gagal',
  DELAYED: 'Terlambat',
  ARCHIVED: 'Diarsipkan',
};

/**
 * Fixed offset for Asia/Jakarta (WIB). Indonesia does not observe DST,
 * so a constant +07:00 offset is correct year-round — no need to pull in
 * a timezone database.
 */
export const JAKARTA_UTC_OFFSET = '+07:00';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts a `YYYY-MM-DD` calendar date (interpreted in Asia/Jakarta) to
 * the UTC ISO instant of that day's START (00:00:00.000 WIB). Returns
 * null for empty/invalid input so callers can simply skip the filter.
 */
export function jakartaDayStartUtc(dateStr) {
  if (!dateStr || !DATE_RE.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000${JAKARTA_UTC_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Converts a `YYYY-MM-DD` calendar date (Asia/Jakarta) to the UTC ISO
 * instant of that day's END (23:59:59.999 WIB), inclusive of the whole
 * "to" day. Returns null for empty/invalid input.
 */
export function jakartaDayEndUtc(dateStr) {
  if (!dateStr || !DATE_RE.test(dateStr)) return null;
  const d = new Date(`${dateStr}T23:59:59.999${JAKARTA_UTC_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Normalizes raw URL search params into a validated, safe filter object
 * for the DAL. Unknown/invalid values are dropped rather than trusted.
 * `dateFromUtc` / `dateToUtc` are pre-converted from Jakarta calendar
 * days to UTC instants here so every consumer (page + export) applies an
 * identical, timezone-correct range.
 */
export function parseReportFilters(sp = {}) {
  const type = sp.type && MESSAGE_TYPE_LABELS[sp.type] ? sp.type : '';
  const status = sp.status && STATUS_LABELS[sp.status] ? sp.status : '';
  const operatorId = isUuid(sp.operator) ? sp.operator : '';
  const stationId = isUuid(sp.station) ? sp.station : '';

  const dateFrom = DATE_RE.test(sp.from ?? '') ? sp.from : '';
  const dateTo = DATE_RE.test(sp.to ?? '') ? sp.to : '';

  const sortBy = SORTABLE_COLUMNS.includes(sp.sort) ? sp.sort : 'received_at';
  const sortDir = sp.dir === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number.parseInt(sp.page, 10) || 1);

  return {
    type,
    status,
    operatorId,
    stationId,
    dateFrom,
    dateTo,
    dateFromUtc: jakartaDayStartUtc(dateFrom),
    dateToUtc: jakartaDayEndUtc(dateTo),
    sortBy,
    sortDir,
    page,
  };
}
