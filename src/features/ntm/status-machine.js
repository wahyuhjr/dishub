/**
 * Client/UI-facing mirror of the NTM state machine enforced in
 * supabase/migrations/20260815100000_ntm_workflow_and_documents.sql
 * (`assert_ntm_transition` + the individual RPC functions).
 *
 * IMPORTANT: this module is for UX only (enabling/disabling buttons,
 * showing the right actions). It is NOT the enforcement boundary — the
 * database functions re-validate every transition regardless of what
 * the client sends, and RLS provides a further layer under that.
 *
 *   DRAFT -> PENDING_VERIFICATION -> VERIFIED -> PUBLISHED
 *   DRAFT -> ARCHIVED
 *   PUBLISHED -> ARCHIVED
 *   (PUBLISHED can also be revised: create_ntm_revision() starts a new
 *   DRAFT linked via previous_version_id — see ntm-service.js)
 */

import { can } from '@/lib/auth/permissions';

export const NTM_STATUSES = ['DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'PUBLISHED', 'ARCHIVED'];

const TRANSITIONS = {
  DRAFT: ['PENDING_VERIFICATION', 'ARCHIVED'],
  PENDING_VERIFICATION: ['VERIFIED'],
  VERIFIED: ['PUBLISHED'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canTransitionNtm(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export const NTM_STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_VERIFICATION: 'Menunggu Verifikasi',
  VERIFIED: 'Terverifikasi',
  PUBLISHED: 'Diterbitkan',
  ARCHIVED: 'Diarsipkan',
};

/** Translucent-background pill classes — same convention as relay-news/status-machine.js. */
export const NTM_STATUS_BADGE_CLASSNAMES = {
  DRAFT: 'bg-surface-hover text-muted-foreground',
  PENDING_VERIFICATION: 'bg-warning/15 text-warning',
  VERIFIED: 'bg-primary/15 text-primary',
  PUBLISHED: 'bg-success/15 text-success',
  ARCHIVED: 'bg-surface-hover text-faint',
};

export const NTM_DOCUMENT_TYPE_LABELS = {
  PERMANENT: 'Permanent',
  TEMPORARY: 'Temporary',
  PRELIMINARY: 'Preliminary',
  AMENDMENT: 'Amendment',
  CANCELLATION: 'Cancellation',
};

/**
 * Which action buttons should be available for an NTM record, given its
 * current status and the viewer's role + ownership. Each action key
 * maps 1:1 to a Server Action (see actions.js) and a DB RPC of the same
 * intent.
 */
export function availableNtmActions({ status, role, isOwner, hasDocument }) {
  const actions = [];

  if (status === 'DRAFT' && can(role, 'ntm.update_own_draft') && (role === 'ADMIN' || isOwner)) {
    actions.push('edit');
  }
  if (
    canTransitionNtm(status, 'PENDING_VERIFICATION') &&
    can(role, 'ntm.submit_for_verification') &&
    (role === 'ADMIN' || isOwner)
  ) {
    actions.push('submit_for_verification');
  }
  if (canTransitionNtm(status, 'VERIFIED') && can(role, 'ntm.verify')) {
    actions.push('verify');
  }
  if (canTransitionNtm(status, 'PUBLISHED') && can(role, 'ntm.publish') && hasDocument) {
    actions.push('publish');
  }
  if (status === 'DRAFT' && can(role, 'ntm.archive_draft') && (role === 'ADMIN' || isOwner)) {
    actions.push('archive');
  }
  if (status === 'PUBLISHED' && can(role, 'ntm.archive_published')) {
    actions.push('archive');
  }
  if (status === 'PUBLISHED' && can(role, 'ntm.revise')) {
    actions.push('revise');
  }
  if (['DRAFT', 'PENDING_VERIFICATION', 'VERIFIED'].includes(status) && (role === 'ADMIN' || role === 'MASTER' || isOwner)) {
    actions.push('upload_document');
  }

  return actions;
}
