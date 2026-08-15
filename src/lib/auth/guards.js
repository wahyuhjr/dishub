import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentUser } from './session';

/**
 * Authorization guards used across Server Components, Layouts, Server
 * Actions, and Route Handlers.
 *
 * SECURITY:
 *   - These never accept a role/user from the caller — the identity and
 *     role always come from getCurrentUser(), which re-derives them from
 *     the server-side session + public.profiles on every call.
 *   - Unauthenticated users are redirected to /login.
 *   - Authenticated-but-unauthorized users are redirected to /forbidden.
 *   - `redirect()` throws internally (NEXT_REDIRECT); callers should
 *     simply `await` these functions and let the redirect propagate —
 *     there is no need (and no way) to catch it.
 */

/** Ensures a session exists. Returns the current user, or redirects to /login. */
export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return user;
}

/** Ensures the current user has exactly `role`. Redirects to /forbidden otherwise. */
export async function requireRole(role) {
  const user = await requireUser();

  if (user.role !== role) {
    redirect('/forbidden');
  }

  return user;
}

/** Ensures the current user has one of `roles`. Redirects to /forbidden otherwise. */
export async function requireAnyRole(roles) {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    redirect('/forbidden');
  }

  return user;
}
