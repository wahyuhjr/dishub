/**
 * Central role/permission matrix for the application. Kept isomorphic
 * (no `server-only`, no Next.js/Supabase imports) so it can be reused by
 * both server-side guards (src/lib/auth/guards.js) and, if ever needed,
 * purely presentational client-side checks — though the ROLE ITSELF must
 * always come from server-verified data (never trust a client-supplied
 * role).
 *
 * Role matrix:
 *   ADMIN    : full access to everything, incl. user & station management.
 *   MASTER   : verifies messages, publishes NTM, views reports/monitoring.
 *   OPERATOR : creates messages/drafts, performs relay, views own history.
 *   VIEWER   : read-only across dashboard, monitoring, messages, reports.
 */

export const ROLES = ['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER'];

const PERMISSIONS = {
  'messages.view': ['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER'],
  'messages.create': ['ADMIN', 'OPERATOR'],
  'messages.update_own_draft': ['ADMIN', 'OPERATOR'],
  'messages.submit_for_verification': ['ADMIN', 'OPERATOR'],
  'messages.verify': ['ADMIN', 'MASTER'],
  'messages.mark_failed': ['ADMIN', 'MASTER'],
  'messages.relay': ['ADMIN', 'OPERATOR'],
  'messages.archive_draft': ['ADMIN', 'OPERATOR'],
  'messages.archive_relayed': ['ADMIN', 'MASTER'],
  'messages.delete': ['ADMIN'],

  'ntm.view': ['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER'],
  'ntm.create': ['ADMIN', 'OPERATOR'],
  'ntm.update_own_draft': ['ADMIN', 'OPERATOR'],
  'ntm.submit_for_verification': ['ADMIN', 'OPERATOR'],
  'ntm.verify': ['ADMIN', 'MASTER'],
  'ntm.publish': ['ADMIN', 'MASTER'],
  'ntm.archive_draft': ['ADMIN', 'OPERATOR'],
  'ntm.archive_published': ['ADMIN', 'MASTER'],
  'ntm.revise': ['ADMIN', 'MASTER'],
  'ntm.delete': ['ADMIN'],

  'documents.generate': ['ADMIN', 'OPERATOR'],
  'documents.view': ['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER'],
  'documents.archive': ['ADMIN', 'MASTER'],

  'relay.view': ['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER'],
  'relay.create': ['ADMIN', 'OPERATOR'],
  'relay.delete': ['ADMIN'],

  'stations.view': ['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER'],
  'stations.manage': ['ADMIN'],
  'stations.delete': ['ADMIN'],

  'users.manage': ['ADMIN'],
  'users.delete': ['ADMIN'],

  'reports.view': ['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER'],
  'monitoring.view': ['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER'],
  'monitoring.log': ['ADMIN'],
};

/**
 * Returns the list of roles allowed to perform `action`. Throws for an
 * unknown action so typos fail loudly instead of silently denying (or
 * worse, allowing) access.
 */
export function rolesFor(action) {
  const roles = PERMISSIONS[action];
  if (!roles) {
    throw new Error(`Unknown permission action: "${action}"`);
  }
  return roles;
}

/** True if `role` is allowed to perform `action`. */
export function can(role, action) {
  return rolesFor(action).includes(role);
}
