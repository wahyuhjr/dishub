'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';
import {
  submitNtmForVerificationAction,
  verifyNtmAction,
  publishNtmAction,
  archiveNtmAction,
  createNtmRevisionAction,
  uploadNtmDocumentAction,
} from '@/features/ntm/actions';
import { availableNtmActions } from '@/features/ntm/status-machine';

/**
 * Action buttons for the NTM detail page. Every button calls a Server
 * Action from actions.js — never Supabase directly. Publish/Archive/
 * Revise require confirmation (AlertDialog) before firing.
 */
export function NtmActions({ ntm, role, currentUserId }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const actions = availableNtmActions({
    status: ntm.status,
    role,
    isOwner: ntm.creator?.id === currentUserId,
    hasDocument: Boolean(ntm.file_path),
  });

  function run(promiseFactory) {
    setError(null);
    startTransition(async () => {
      const result = await promiseFactory();
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('file', file);
      const result = await uploadNtmDocumentAction(ntm.id, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {actions.includes('submit_for_verification') && (
          <Button disabled={isPending} onClick={() => run(() => submitNtmForVerificationAction(ntm.id))}>
            Submit untuk Verifikasi
          </Button>
        )}

        {actions.includes('verify') && (
          <Button disabled={isPending} onClick={() => run(() => verifyNtmAction(ntm.id))}>
            Verifikasi
          </Button>
        )}

        {actions.includes('upload_document') && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={handleFileChange}
              aria-label="Unggah dokumen NTM"
            />
            <Button type="button" variant="outline" disabled={isPending} onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" aria-hidden="true" />
              {ntm.file_path ? 'Ganti Dokumen' : 'Unggah Dokumen'}
            </Button>
          </div>
        )}

        {actions.includes('publish') && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isPending}>Publish</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publikasikan NTM ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  NTM akan berstatus PUBLISHED dan metadatanya menjadi dapat diakses publik. Setelah dipublikasikan,
                  perubahan hanya dapat dilakukan melalui revisi baru.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => run(() => publishNtmAction(ntm.id))}>Ya, Publikasikan</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {actions.includes('revise') && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isPending}>
                Buat Revisi
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Buat revisi baru dari NTM ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  Sebuah draft baru (revisi berikutnya) akan dibuat berdasarkan NTM ini. NTM yang sudah dipublikasikan
                  tidak dapat diedit langsung — perubahan harus melalui revisi.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => run(() => createNtmRevisionAction(ntm.id))}>
                  Ya, Buat Revisi
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {actions.includes('archive') && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isPending}>
                Arsipkan
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arsipkan NTM ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  NTM yang diarsipkan tidak akan muncul di alur kerja aktif lagi. Tindakan ini tercatat di audit trail.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => run(() => archiveNtmAction(ntm.id))}>Ya, Arsipkan</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
