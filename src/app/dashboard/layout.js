import { requireUser } from '@/lib/auth/guards';
import { AppShell } from '@/components/app-shell/app-shell';

/**
 * Baseline check only. Per Next.js's own guidance, Layouts do not
 * re-run on every navigation and do not stop nested segments/Server
 * Actions from executing — so this requireUser() call is a convenience,
 * NOT the authoritative protection. Every page and Server Action below
 * independently calls requireUser()/requireRole()/requireAnyRole().
 */
export default async function DashboardLayout({ children }) {
  const user = await requireUser();

  return <AppShell user={user}>{children}</AppShell>;
}
