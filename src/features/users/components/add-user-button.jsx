'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserFormDialog } from './user-form-dialog';

/** Header button that opens the "Tambah User" dialog. */
export function AddUserButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" aria-hidden="true" />
        Tambah User
      </Button>
      <UserFormDialog mode="create" open={open} onOpenChange={setOpen} />
    </>
  );
}
