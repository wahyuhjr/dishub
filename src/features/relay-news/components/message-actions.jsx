'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  submitForVerificationAction,
  verifyMessageAction,
  markMessageFailedAction,
  relayMessageAction,
  archiveMessageAction,
  deleteMessageAction,
} from '@/features/relay-news/actions';
import { availableActions } from '@/features/relay-news/status-machine';

/**
 * Action buttons for the message detail page. Every button calls a
 * Server Action from actions.js — never Supabase directly (see
 * relay-service.js, the adapter layer those actions go through).
 * Relay and Archive require confirmation (AlertDialog) before firing.
 */
export function MessageActions({ message, stations, role, currentUserId }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [stationId, setStationId] = useState('');
  const [failReason, setFailReason] = useState('');

  const actions = availableActions({ status: message.status, role, isOwner: message.operator?.id === currentUserId });

  function run(promiseFactory, successMessage) {
    setError(null);
    startTransition(async () => {
      const result = await promiseFactory();
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      if (successMessage) toast.success(successMessage);
      router.refresh();
    });
  }

  function runDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteMessageAction(message.id);
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success('Berita berhasil dihapus.');
      router.push('/dashboard/relay-news');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {actions.includes('submit_for_verification') && (
          <Button disabled={isPending} onClick={() => run(() => submitForVerificationAction(message.id), 'Berita diajukan untuk verifikasi.')}>
            Submit for Verification
          </Button>
        )}

        {actions.includes('verify') && (
          <Button disabled={isPending} onClick={() => run(() => verifyMessageAction(message.id), 'Berita berhasil diverifikasi.')}>
            Verify
          </Button>
        )}

        {actions.includes('mark_failed') && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isPending}>
                Tandai Gagal
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tandai berita ini gagal di-relay?</AlertDialogTitle>
                <AlertDialogDescription>
                  Status akan berubah menjadi FAILED. Anda bisa mencoba relay ulang setelahnya.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-1.5 px-1">
                <Label htmlFor="fail-reason">Alasan (opsional)</Label>
                <Textarea id="fail-reason" value={failReason} onChange={(e) => setFailReason(e.target.value)} rows={3} />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => run(() => markMessageFailedAction({ message_id: message.id, reason: failReason }), 'Berita ditandai gagal.')}
                >
                  Ya, Tandai Gagal
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {actions.includes('relay') && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isPending}>Relay</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi relay berita ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tindakan ini akan mencatat relay_attempts dan mengubah status menjadi RELAYED. Pastikan berita sudah
                  benar-benar diteruskan ke stasiun tujuan sebelum konfirmasi.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-1.5 px-1">
                <Label htmlFor="relay-station">Stasiun Tujuan</Label>
                <Select value={stationId} onValueChange={setStationId}>
                  <SelectTrigger id="relay-station" aria-label="Stasiun tujuan relay">
                    <SelectValue placeholder="Pilih stasiun" />
                  </SelectTrigger>
                  <SelectContent>
                    {stations.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.station_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!stationId}
                  onClick={() => run(() => relayMessageAction({ message_id: message.id, station_id: stationId }), 'Berita berhasil di-relay.')}
                >
                  Ya, Relay Sekarang
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {actions.includes('archive') && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isPending}>
                Archive
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arsipkan berita ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  Berita yang diarsipkan tidak akan muncul di alur kerja aktif lagi. Tindakan ini tercatat di audit trail.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => run(() => archiveMessageAction(message.id), 'Berita berhasil diarsipkan.')}>
                  Ya, Arsipkan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {actions.includes('delete') && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isPending}>
                Hapus
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus berita ini secara permanen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tindakan ini tidak dapat dibatalkan. Berita beserta riwayat relay-nya akan dihapus permanen dari
                  database. Gunakan Archive jika Anda hanya ingin menyembunyikannya dari alur kerja aktif.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={runDelete}>Ya, Hapus Permanen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
