import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';
import { Navbar } from './navbar';

/**
 * AppShell: the authenticated dashboard layout — responsive sidebar
 * (desktop collapsible, mobile drawer via shadcn's Sidebar/Sheet
 * primitives) + navbar + content area.
 *
 * `user` must come from a server-verified source (requireUser(), see
 * src/app/dashboard/layout.js) — never pass client-supplied data here.
 * Only plain/serializable fields of `user` (id, role, username, ...) are
 * passed down — NAV_ITEMS (which include lucide-react icon component
 * references) are NOT computed here: passing component references as
 * props from a Server Component to a Client Component violates the RSC
 * serialization boundary. AppSidebar (a Client Component) imports
 * NAV_ITEMS itself and filters using the plain `role` string instead.
 */
export function AppShell({ user, children }) {
  return (
    <SidebarProvider>
      <AppSidebar role={user.role} />
      <SidebarInset>
        <Navbar user={user} />
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
