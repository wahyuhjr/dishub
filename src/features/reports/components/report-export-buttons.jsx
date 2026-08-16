'use client';

import { useSearchParams } from 'next/navigation';
import { FileText, Sheet, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Export buttons for /dashboard/laporan. Each is a plain anchor to the
 * server-side streaming export Route Handler, carrying the current
 * filter/sort params so the export exactly matches the on-screen report.
 * The heavy lifting (querying, RLS, formatting, streaming, logging) all
 * happens server-side — the browser only follows a download link.
 */
export function ReportExportButtons() {
  const searchParams = useSearchParams();

  function href(format) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('format', format);
    params.delete('page');
    return `/api/reports/export?${params.toString()}`;
  }

  const FORMAT_LABELS = { csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' };
  function handleExportClick(format) {
    toast.success(`Mengunduh laporan (${FORMAT_LABELS[format]})…`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={href('csv')} download onClick={() => handleExportClick('csv')}>
          <Sheet className="size-4" aria-hidden="true" />
          Export CSV
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={href('xlsx')} download onClick={() => handleExportClick('xlsx')}>
          <FileSpreadsheet className="size-4" aria-hidden="true" />
          Export Excel
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={href('pdf')} download onClick={() => handleExportClick('pdf')}>
          <FileText className="size-4" aria-hidden="true" />
          Export PDF
        </a>
      </Button>
    </div>
  );
}
