'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UserFormDialog } from './user-form-dialog';
import {
  setActiveAction,
  resetPasswordAction,
  deleteUserAction,
  uploadAvatarAction,
  getUserActivityAction,
} from '@/features/users/actions';
import { toast } from 'sonner';

function formatWib(value) {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm', { locale: idLocale });
  } catch {
    return '—';
  }
}

export function UserRowActions({ user, currentUserId }) {
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);

  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const isSelf = user.id === currentUserId;

  function runToggleActive() {
    setError('');
    startTransition(async () => {
      const res = await setActiveAction({ id: user.id, is_active: !user.is_active });
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(user.is_active ? `User "${user.username}" dinonaktifkan.` : `User "${user.username}" diaktifkan.`);
        setToggleOpen(false);
      }
    });
  }

  function runDelete() {
    setError('');
    startTransition(async () => {
      const res = await deleteUserAction(user.id);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(`User "${user.username}" berhasil dihapus.`);
        setDeleteOpen(false);
      }
    });
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Aksi untuk ${user.username}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPwOpen(true)}>Reset Password</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAvatarOpen(true)}>Upload Foto</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActivityOpen(true)}>Lihat Aktivitas</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setToggleOpen(true)} disabled={isSelf && user.is_active}>
            {user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)} disabled={isSelf}>
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UserFormDialog mode="edit" user={user} open={editOpen} onOpenChange={setEditOpen} />
      <ResetPasswordDialog user={user} open={pwOpen} onOpenChange={setPwOpen} />
      <AvatarDialog user={user} open={avatarOpen} onOpenChange={setAvatarOpen} />
      <ActivityDialog user={user} open={activityOpen} onOpenChange={setActivityOpen} formatWib={formatWib} />

      {/* Activate/Deactivate confirmation */}
      <AlertDialog open={toggleOpen} onOpenChange={setToggleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{user.is_active ? 'Nonaktifkan user?' : 'Aktifkan user?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {user.is_active
                ? `User "${user.username}" tidak akan bisa masuk hingga diaktifkan kembali.`
                : `User "${user.username}" akan bisa masuk kembali.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); runToggleActive(); }} disabled={isPending}>
              {isPending ? 'Memproses...' : 'Konfirmasi'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation (destructive) */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus user secara permanen?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini menghapus akun autentikasi dan profil &quot;{user.username}&quot; secara permanen dan tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runDelete(); }}
              disabled={isPending}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >
              {isPending ? 'Menghapus...' : 'Hapus Permanen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ResetPasswordDialog({ user, open, onOpenChange }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(e) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      const res = await resetPasswordAction({ id: user.id, password });
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        setDone(true);
        setPassword('');
        toast.success('Password berhasil diperbarui.');
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) { setDone(false); setError(''); setPassword(''); }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Tetapkan password baru untuk &quot;{user.username}&quot;. Password tidak pernah ditampilkan kembali.</DialogDescription>
        </DialogHeader>
        {done ? (
          <p className="text-sm text-success">Password berhasil diperbarui.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rp-password">Password Baru</Label>
              <Input id="rp-password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Batal</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Menyimpan...' : 'Reset Password'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AvatarDialog({ user, open, onOpenChange }) {
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(e) {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.currentTarget);
    formData.set('id', user.id);
    startTransition(async () => {
      const res = await uploadAvatarAction(null, formData);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        setDone(true);
        toast.success('Foto profil berhasil diperbarui.');
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) { setDone(false); setError(''); }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Foto Profil</DialogTitle>
          <DialogDescription>PNG, JPEG, atau WebP hingga 5MB.</DialogDescription>
        </DialogHeader>
        {done ? (
          <p className="text-sm text-success">Foto profil berhasil diperbarui.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="av-file">Berkas Foto</Label>
              <Input id="av-file" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" required />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Batal</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Mengunggah...' : 'Unggah'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActivityDialog({ user, open, onOpenChange, formatWib }) {
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(v) {
    onOpenChange(v);
    if (v && activity === null) {
      startTransition(async () => {
        const res = await getUserActivityAction(user.id);
        if (res?.error) setError(res.error);
        else setActivity(res.activity);
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Aktivitas — {user.username}</DialogTitle>
          <DialogDescription>20 aktivitas terbaru yang tercatat untuk pengguna ini.</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {isPending && activity === null ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : activity && activity.length > 0 ? (
          <ul className="flex max-h-80 flex-col gap-2 overflow-auto">
            {activity.map((entry) => (
              <li key={entry.id} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{entry.action}</span>
                  <span className="text-xs text-muted-foreground">{formatWib(entry.created_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{entry.entity_type}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
