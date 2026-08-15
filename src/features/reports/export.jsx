import 'server-only';
import { Readable, PassThrough } from 'node:stream';
import ExcelJS from 'exceljs';
import { Document, Page, View, Text, StyleSheet, renderToStream } from '@react-pdf/renderer';
import { getRequestContext } from '@/lib/audit/request-context';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { MESSAGE_TYPE_LABELS, STATUS_LABELS } from './filters';
import { iterateReportRows } from './dal';
import { computeReportSummary, formatRelayDuration } from './summary';

/**
 * Server-only export generation for /dashboard/laporan.
 *
 * REQUIREMENTS honoured here:
 *   - 9/10/11: rows are pulled through the RLS-scoped server client and
 *     streamed straight from the database to the HTTP response; the
 *     browser is never asked to assemble an export from a full dataset.
 *   - 12: all timestamps are formatted in Asia/Jakarta (WIB).
 *   - 13: every export is written to activity_logs (see logExport()).
 *   - 14: CSV and XLSX stream row-by-row (constant memory) for large
 *     result sets; PDF is capped (a paginated PDF of unbounded rows is
 *     not a sensible artifact) and notes the cap in-document.
 */

// Belt-and-suspenders cap so a PDF export can't try to render an
// unbounded table into memory. CSV/XLSX are unbounded (true streaming).
export const PDF_ROW_CAP = 2000;

const jakartaFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatJakarta(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${jakartaFmt.format(d)} WIB`;
}

function operatorName(row) {
  return row.operator?.full_name || row.operator?.username || '';
}

function stationName(row) {
  return row.origin_station?.station_name || row.origin_station?.station_code || '';
}

/** Ordered columns shared by CSV and XLSX. */
export const EXPORT_COLUMNS = [
  { key: 'message_number', header: 'No. Berita', width: 16, value: (r) => r.message_number ?? '' },
  { key: 'message_type', header: 'Jenis', width: 18, value: (r) => MESSAGE_TYPE_LABELS[r.message_type] ?? r.message_type ?? '' },
  { key: 'title', header: 'Judul', width: 40, value: (r) => r.title ?? '' },
  { key: 'received_at', header: 'Diterima (WIB)', width: 22, value: (r) => formatJakarta(r.received_at) },
  { key: 'relayed_at', header: 'Direlay (WIB)', width: 22, value: (r) => formatJakarta(r.relayed_at) },
  { key: 'status', header: 'Status', width: 18, value: (r) => STATUS_LABELS[r.status] ?? r.status ?? '' },
  { key: 'priority', header: 'Prioritas', width: 12, value: (r) => r.priority ?? '' },
  { key: 'operator', header: 'Operator', width: 24, value: operatorName },
  { key: 'origin_station', header: 'Stasiun Asal', width: 24, value: stationName },
  { key: 'delay_reason', header: 'Alasan Terlambat', width: 30, value: (r) => r.delay_reason ?? '' },
];

// ---------------------------------------------------------------------
// CSV — true streaming, RFC-4180 quoting, UTF-8 BOM so Excel opens it
// with the correct encoding.
// ---------------------------------------------------------------------
function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function* csvChunks(filters) {
  yield '\uFEFF' + EXPORT_COLUMNS.map((c) => csvEscape(c.header)).join(',') + '\r\n';
  for await (const row of iterateReportRows(filters)) {
    yield EXPORT_COLUMNS.map((c) => csvEscape(c.value(row))).join(',') + '\r\n';
  }
}

function asyncStringsToWebStream(gen) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await gen.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value));
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export function buildCsvStream(filters) {
  return asyncStringsToWebStream(csvChunks(filters));
}

// ---------------------------------------------------------------------
// XLSX — exceljs streaming workbook writer, committing each row as it's
// fetched so memory stays flat regardless of result size.
// ---------------------------------------------------------------------
export function buildXlsxStream(filters) {
  const pass = new PassThrough();
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: pass, useStyles: true });
  const sheet = workbook.addWorksheet('Laporan');
  sheet.columns = EXPORT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).commit();

  (async () => {
    try {
      for await (const row of iterateReportRows(filters)) {
        const record = {};
        for (const c of EXPORT_COLUMNS) record[c.key] = c.value(row);
        sheet.addRow(record).commit();
      }
      await sheet.commit();
      await workbook.commit();
    } catch (error) {
      pass.destroy(error);
    }
  })();

  return Readable.toWeb(pass);
}

// ---------------------------------------------------------------------
// PDF — summary + a capped table of rows, rendered server-side with
// @react-pdf/renderer (same engine as the document generator).
// ---------------------------------------------------------------------
const pdfStyles = StyleSheet.create({
  page: { padding: 32, fontSize: 8, fontFamily: 'Helvetica', color: '#111827' },
  headerBar: { borderBottom: 2, borderBottomColor: '#1D4ED8', paddingBottom: 8, marginBottom: 12 },
  agency: { fontSize: 8, color: '#4B5563', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 15, fontWeight: 700, marginTop: 4, color: '#1D4ED8' },
  subtitle: { fontSize: 8, color: '#4B5563', marginTop: 2 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  summaryCard: { width: '23%', border: 1, borderColor: '#D1D5DB', borderRadius: 4, padding: 6 },
  summaryLabel: { fontSize: 7, color: '#6B7280', textTransform: 'uppercase' },
  summaryValue: { fontSize: 13, fontWeight: 700, marginTop: 2 },
  sectionLabel: { fontSize: 9, fontWeight: 700, marginTop: 8, marginBottom: 4, textTransform: 'uppercase', color: '#374151' },
  table: { borderTop: 1, borderColor: '#E5E7EB' },
  tr: { flexDirection: 'row', borderBottom: 1, borderColor: '#E5E7EB' },
  th: { fontSize: 7, fontWeight: 700, backgroundColor: '#F3F4F6', padding: 3, textTransform: 'uppercase' },
  td: { fontSize: 7, padding: 3 },
  cNo: { width: '12%' }, cType: { width: '12%' }, cTitle: { width: '28%' },
  cRecv: { width: '16%' }, cStatus: { width: '14%' }, cOp: { width: '18%' },
  note: { marginTop: 8, fontSize: 7, color: '#B45309' },
  footer: { position: 'absolute', bottom: 18, left: 32, right: 32, fontSize: 7, color: '#6B7280', textAlign: 'center' },
});

function SummaryCard({ label, value }) {
  return (
    <View style={pdfStyles.summaryCard}>
      <Text style={pdfStyles.summaryLabel}>{label}</Text>
      <Text style={pdfStyles.summaryValue}>{value}</Text>
    </View>
  );
}

function ReportPdfDocument({ rows, summary, capped, generatedAt }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.headerBar}>
          <Text style={pdfStyles.agency}>Distrik Navigasi — Digital Relay Berita Bahaya &amp; NTM</Text>
          <Text style={pdfStyles.title}>Laporan Relay Berita</Text>
          <Text style={pdfStyles.subtitle}>Dibuat: {formatJakarta(generatedAt)} — Zona waktu: Asia/Jakarta (WIB)</Text>
        </View>

        <View style={pdfStyles.summaryRow}>
          <SummaryCard label="Total Berita" value={String(summary.total)} />
          <SummaryCard label="Berhasil Relay" value={String(summary.relayedCount)} />
          <SummaryCard label="Gagal" value={String(summary.failedCount)} />
          <SummaryCard label="Terlambat" value={String(summary.delayedCount)} />
          <SummaryCard label="Rata-rata Waktu Relay" value={formatRelayDuration(summary.avgRelaySeconds)} />
        </View>

        <Text style={pdfStyles.sectionLabel}>Rincian Berita</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.tr}>
            <Text style={[pdfStyles.th, pdfStyles.cNo]}>No. Berita</Text>
            <Text style={[pdfStyles.th, pdfStyles.cType]}>Jenis</Text>
            <Text style={[pdfStyles.th, pdfStyles.cTitle]}>Judul</Text>
            <Text style={[pdfStyles.th, pdfStyles.cRecv]}>Diterima (WIB)</Text>
            <Text style={[pdfStyles.th, pdfStyles.cStatus]}>Status</Text>
            <Text style={[pdfStyles.th, pdfStyles.cOp]}>Operator</Text>
          </View>
          {rows.map((r) => (
            <View style={pdfStyles.tr} key={r.id} wrap={false}>
              <Text style={[pdfStyles.td, pdfStyles.cNo]}>{r.message_number ?? ''}</Text>
              <Text style={[pdfStyles.td, pdfStyles.cType]}>{MESSAGE_TYPE_LABELS[r.message_type] ?? r.message_type}</Text>
              <Text style={[pdfStyles.td, pdfStyles.cTitle]}>{r.title ?? ''}</Text>
              <Text style={[pdfStyles.td, pdfStyles.cRecv]}>{formatJakarta(r.received_at)}</Text>
              <Text style={[pdfStyles.td, pdfStyles.cStatus]}>{STATUS_LABELS[r.status] ?? r.status}</Text>
              <Text style={[pdfStyles.td, pdfStyles.cOp]}>{operatorName(r)}</Text>
            </View>
          ))}
        </View>

        {capped && (
          <Text style={pdfStyles.note}>
            Catatan: laporan PDF dibatasi hingga {PDF_ROW_CAP} baris pertama. Gunakan ekspor CSV/XLSX untuk data lengkap.
          </Text>
        )}

        <Text style={pdfStyles.footer} fixed render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} / ${totalPages}`} />
      </Page>
    </Document>
  );
}

export async function buildPdfStream(filters) {
  const rows = [];
  for await (const row of iterateReportRows(filters)) {
    rows.push(row);
    if (rows.length >= PDF_ROW_CAP) break;
  }
  const capped = rows.length >= PDF_ROW_CAP;
  const summary = computeReportSummary(rows);
  const nodeStream = await renderToStream(
    <ReportPdfDocument rows={rows} summary={summary} capped={capped} generatedAt={new Date().toISOString()} />
  );
  return Readable.toWeb(nodeStream);
}

// ---------------------------------------------------------------------
// Export audit log (requirement 13).
// ---------------------------------------------------------------------
export async function logExport({ userId, format, filters }) {
  const supabase = await createSupabaseServerClient();
  const ctx = await getRequestContext();
  await supabase.from('activity_logs').insert({
    actor_id: userId,
    action: 'EXPORT_REPORT',
    entity_type: 'reports',
    entity_id: null,
    metadata: {
      report: 'relay_messages',
      format,
      timezone: 'Asia/Jakarta',
      exported_at: new Date().toISOString(),
      filters: {
        type: filters.type || null,
        status: filters.status || null,
        operator_id: filters.operatorId || null,
        station_id: filters.stationId || null,
        date_from: filters.dateFrom || null,
        date_to: filters.dateTo || null,
        sort_by: filters.sortBy,
        sort_dir: filters.sortDir,
      },
    },
    ip_address: ctx?.ipAddress ?? null,
    user_agent: ctx?.userAgent ?? null,
  });
}

export const EXPORT_META = {
  csv: { contentType: 'text/csv; charset=utf-8', ext: 'csv' },
  xlsx: { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
  pdf: { contentType: 'application/pdf', ext: 'pdf' },
};
