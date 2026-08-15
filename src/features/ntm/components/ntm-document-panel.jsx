'use client';

import { useState, useTransition } from 'react';
import { Eye, Download, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { downloadNtmDocumentAction } from '@/features/ntm/actions';

/**
 * Preview + download panel for an NTM's attached document. Both actions
 * go through downloadNtmDocumentAction, which mints a short-lived signed
 * URL server-side (never a permanent public URL — see
 * src/lib/storage/documents.js) and logs a DOWNLOAD_NTM_DOCUMENT
 * activity entry each time.
 */
export function NtmDocumentPanel({ ntm }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  if (!ntm.file_path) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <FileWarning className="size-4" aria-hidden="true" />
        Belum ada dokumen terlampir.
      </div>
    );
  }

  function fetchSignedUrl(onReady) {
    setError(null);
    startTransition(async () => {
      const result = await downloadNtmDocumentAction(ntm.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onReady(result.data.signedUrl);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">{ntm.file_name}</p>
          <p className="text-xs text-muted-foreground">{ntm.mime_type}</p>
        </div>
        <div className="flex gap-2">
          <Dialog onOpenChange={(open) => open && fetchSignedUrl(setPreviewUrl)}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={isPending}>
                <Eye className="size-4" aria-hidden="true" />
                Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-4xl">
              <DialogHeader>
                <DialogTitle>{ntm.file_name}</DialogTitle>
              </DialogHeader>
              {previewUrl ? (
                <iframe src={previewUrl} title={`Preview ${ntm.file_name}`} className="h-[70vh] w-full rounded border" />
              ) : (
                <p className="text-sm text-muted-foreground">Memuat preview…</p>
              )}
            </DialogContent>
          </Dialog>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              fetchSignedUrl((url) => {
                const link = document.createElement('a');
                link.href = url;
                link.download = ntm.file_name;
                link.click();
              })
            }
          >
            <Download className="size-4" aria-hidden="true" />
            Unduh
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
