'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Anchor } from 'lucide-react';
import { NAV_ITEMS, NAV_GROUP_LABELS } from '@/config/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

/**
 * Sidebar navigation. Filters NAV_ITEMS by `role` (a plain string from
 * the server-verified session, see app-shell.jsx) right here in the
 * Client Component — NAV_ITEMS (which includes lucide-react icon
 * component references) must NOT be pre-filtered and passed down as a
 * prop from a Server Component, since component references aren't
 * serializable across that boundary. The menu still can never show
 * something the user's role isn't already allowed to do, since
 * NAV_ITEMS' `roles` arrays come straight from permissions.js.
 *
 * Items are grouped ("Menu Utama" / "Akun", see NAV_GROUP_LABELS) and
 * the active item gets a left accent border + primary-colored icon/text
 * on top of the shared sidebar-accent background, per the dark
 * minimalist design system.
 */
export function AppSidebar({ role }) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const groups = Object.keys(NAV_GROUP_LABELS)
    .map((key) => ({
      key,
      label: NAV_GROUP_LABELS[key],
      items: visibleItems.filter((item) => item.group === key),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <Anchor className="size-4" />
          </span>
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            Relay &amp; NTM
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.key}>
            <SidebarGroupLabel className="text-xs tracking-wide text-muted-foreground uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu aria-label={group.label}>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className="border-l-2 border-l-transparent data-[active=true]:border-l-primary data-[active=true]:text-primary [&[data-active=true]_svg]:text-primary"
                      >
                        <Link href={item.href} aria-current={isActive ? 'page' : undefined}>
                          <Icon aria-hidden="true" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
