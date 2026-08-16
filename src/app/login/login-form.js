'use client';

import { useActionState, useEffect } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { loginAction } from './actions';

const initialState = { error: null };

const fieldClassName =
  'w-full rounded-lg border border-border/60 bg-surface-hover px-3 py-2.5 text-sm text-foreground ' +
  'placeholder:text-faint outline-none transition focus:border-primary focus:ring-1 focus:ring-primary';

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-muted-foreground">
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required
          autoComplete="username"
          placeholder="nama@distriknav.go.id"
          className={fieldClassName}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-muted-foreground">
          Password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className={fieldClassName}
        />
      </div>

      {state?.error ? (
        <p role="alert" className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-blue-600 to-blue-400 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-linear-to-r hover:from-blue-700 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <KeyRound className="size-4" aria-hidden="true" />
        {pending ? 'Memproses…' : 'Masuk'}
      </button>
    </form>
  );
}
