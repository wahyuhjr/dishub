import { getCurrentUser } from '@/lib/auth/session';
import { can } from '@/lib/auth/permissions';
import { parseReportFilters } from '@/features/reports/filters';
import { buildCsvStream, buildXlsxStream, buildPdfStream, logExport, EXPORT_META } from '@/features/reports/export';

/**
 * Streaming report export (CSV / XLSX / PDF).
 *
 * SECURITY / REQUIREMENTS:
 *   - Authorization is re-derived from the server session (never the
 *     client). Only roles allowed to view reports may export.
 *   - Data is read through the RLS-scoped server client inside the
 *     export builders, so the export can never include rows the user
 *     isn't allowed to see (requirement 10).
 *   - The response is streamed straight from the database (requirement
 *     11 & 14); nothing is assembled from a full dataset in the browser.
 *   - Every successful export is recorded to activity_logs (requirement
 *     13) before streaming begins.
 *
 * Node.js runtime is required (exceljs / @react-pdf/renderer rely on Node
 * stream primitives — they don't run on the Edge runtime).
 */
export const runtime = 'nodejs';

const BUILDERS = {
  csv: buildCsvStream,
  xlsx: buildXlsxStream,
  pdf: buildPdfStream,
};

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!can(user.role, 'reports.view')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') ?? 'csv').toLowerCase();
  const builder = BUILDERS[format];
  if (!builder) {
    return Response.json({ error: 'Format tidak didukung. Gunakan csv, xlsx, atau pdf.' }, { status: 400 });
  }

  const filters = parseReportFilters(Object.fromEntries(searchParams.entries()));

  // Record the export attempt BEFORE streaming (requirement 13). If
  // logging fails we still fail closed so an unlogged export can't slip
  // through.
  try {
    await logExport({ userId: user.id, format, filters });
  } catch (error) {
    console.error('logExport failed', error);
    return Response.json({ error: 'Gagal mencatat log ekspor.' }, { status: 500 });
  }

  let stream;
  try {
    stream = await builder(filters);
  } catch (error) {
    console.error('report export failed', error);
    return Response.json({ error: 'Gagal membuat ekspor.' }, { status: 500 });
  }

  const meta = EXPORT_META[format];
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': meta.contentType,
      'Content-Disposition': `attachment; filename="laporan-relay-${stamp}.${meta.ext}"`,
      'Cache-Control': 'no-store',
    },
  });
}
