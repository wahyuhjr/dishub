'use client';

import { useActionState, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_VALUES } from '@/features/users/schema';
import { ROLE_LABELS } from './user-filters';
import { createUserAction, updateUserAction } from '@/features/users/actions';
import { toast } from 'sonner';

/**
 * Add/Edit user dialog. On create, the Server Action provisions the Auth
 * user via the Admin API; on edit it updates the profile. All validation
 * is re-run server-side — this form is UX only.
 *
 * The form body is mounted only while the dialog is open, so its local
 * state (role/is_active/action state) initializes fresh on every open
 * without needing a state-syncing effect.
 */
export function UserFormDialog({ mode, user, open, onOpenChange }) {
  const isEdit = mode === 'edit';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit User' : 'Tambah User'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Perbarui data pengguna. Email tidak dapat diubah di sini.' : 'Buat akun pengguna baru beserta kredensial awalnya.'}
          </DialogDescription>
        </DialogHeader>
        {open ? <UserFormBody isEdit={isEdit} user={user} onOpenChange={onOpenChange} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function UserFormBody({ isEdit, user, onOpenChange }) {
  const action = isEdit ? updateUserAction : createUserAction;
  const [state, formAction, isPending] = useActionState(action, null);
  const [role, setRole] = useState(user?.role ?? 'VIEWER');
  const [isActive, setIsActive] = useState(user?.is_active ?? true);

  useEffect(() => {
    if (state?.success) {
      toast.success(isEdit ? 'User berhasil diperbarui.' : 'User baru berhasil dibuat.');
      onOpenChange(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isEdit ? <input type="hidden" name="id" value={user.id} /> : null}
      <input type="hidden" name="role" value={role} />
      {!isEdit ? <input type="hidden" name="is_active" value={String(isActive)} /> : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="uf-username">Username</Label>
        <Input id="uf-username" name="username" defaultValue={user?.username ?? ''} autoComplete="off" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="uf-fullname">Nama Lengkap</Label>
        <Input id="uf-fullname" name="full_name" defaultValue={user?.full_name ?? ''} required />
      </div>

      {!isEdit ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="uf-email">Email</Label>
            <Input id="uf-email" name="email" type="email" autoComplete="off" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="uf-password">Password Awal</Label>
            <Input id="uf-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
        </>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="uf-role">Role</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger id="uf-role" aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_VALUES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isEdit ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4" />
          Aktifkan akun setelah dibuat
        </label>
      ) : null}

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
          Batal
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat User'}
        </Button>
      </DialogFooter>
    </form>
  );
}
