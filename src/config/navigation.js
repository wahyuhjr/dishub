import {
  LayoutDashboard,
  Radio,
  ShipWheel,
  Activity,
  FileBarChart,
  FileText,
  Users,
} from 'lucide-react';
import { rolesFor, ROLES } from '@/lib/auth/permissions';

/**
 * Single source of truth for the sidebar. Each item's `roles` comes
 * straight from the permission matrix (src/lib/auth/permissions.js) so
 * sidebar visibility can never drift out of sync with what a role can
 * actually do.
 *
 * IMPORTANT: this only controls what's *shown*. Every corresponding
 * route independently re-checks authorization server-side via
 * requireUser()/requireRole()/requireAnyRole() — see each page.js under
 * src/app/dashboard/**. Hiding a menu item is not a security boundary.
 */
export const NAV_ITEMS = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ROLES, // every authenticated role
    group: 'main',
  },
  {
    title: 'Relay Berita',
    href: '/dashboard/relay-news',
    icon: Radio,
    roles: rolesFor('relay.view'),
    group: 'main',
  },
  {
    title: 'Notice To Marine',
    href: '/dashboard/ntm',
    icon: ShipWheel,
    roles: rolesFor('ntm.view'),
    group: 'main',
  },
  {
    title: 'Generator Dokumen',
    href: '/dashboard/generator-dokumen',
    icon: FileText,
    roles: rolesFor('documents.generate'),
    group: 'main',
  },
  {
    title: 'Monitoring',
    href: '/dashboard/monitoring',
    icon: Activity,
    roles: rolesFor('monitoring.view'),
    group: 'main',
  },
  {
    title: 'Laporan',
    href: '/dashboard/laporan',
    icon: FileBarChart,
    roles: rolesFor('reports.view'),
    group: 'main',
  },
  {
    title: 'User',
    href: '/dashboard/user',
    icon: Users,
    // ADMIN-only (mirrors permissions.js "users.manage"). This also
    // satisfies "never show User to OPERATOR/VIEWER" — MASTER is
    // likewise excluded since MASTER has no user-management permission
    // in the matrix either; only show a menu that a role can actually use.
    roles: rolesFor('users.manage'),
    group: 'account',
  },
];

/** Group labels for the sidebar, in display order. */
export const NAV_GROUP_LABELS = {
  main: 'Menu Utama',
  account: 'Akun',
};

/** Human-readable labels for routes that aren't in the sidebar (used by breadcrumbs). */
export const EXTRA_ROUTE_LABELS = {
  '/dashboard/profile': 'Profil Saya',
  '/dashboard/pengaturan/stations': 'Konfigurasi Station',
};
