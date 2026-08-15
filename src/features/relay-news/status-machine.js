/**
 * Client/UI-facing mirror of the state machine enforced in
 * supabase/migrations/20260814120000_relay_news_module.sql and
 * supabase/migrations/20260815090000_radio_relay_adapter_support.sql
 * (`assert_message_transition` + the individual RPC functions).
 *
 * IMPORTANT: this module is for UX only (enabling/disabling buttons,
 * showing the right actions). It is NOT the enforcement boundary — the
 * database functions re-validate every transition regardless of what
 * the client sends, and RLS provides a further layer under that.
 *
 *   DRAFT -> PENDING_VERIFICATION -> VERIFIED -> RELAYING -> RELAYED
 *   DRAFT -> ARCHIVED
 *   VERIFIED -> FAILED
 *   RELAYING -> FAILED   (a real radio-relay adapter attempt failed)
 *   FAILED -> RELAYING
 *   RELAYED -> ARCHIVED
 */

import { can } from '@/lib/auth/permissions';

export const STATUSES = [
  'DRAFT',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'RELAYING',
  'RELAYED',
  'FAILED',
  'ARCHIVED',
];

const TRANSITIONS = {
  DRAFT: ['PENDING_VERIFICATION', 'ARCHIVED'],
  PENDING_VERIFICATION: ['VERIFIED'],
  VERIFIED: ['RELAYING', 'FAILED'],
  RELAYING: ['RELAYED', 'FAILED'],
  FAILED: ['RELAYING'],
  RELAYED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export const STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_VERIFICATION: 'Menunggu Verifikasi',
  VERIFIED: 'Terverifikasi',
  RELAYING: 'Sedang Di-relay',
  RELAYED: 'Sudah Di-relay',
  FAILED: 'Gagal',
  ARCHIVED: 'Diarsipkan',
};

/** Tailwind classes for the status Badge — kept separate from labels for reuse.
 *  Uses the design system's translucent-background convention (bg-color with
 *  low opacity + matching text color) instead of solid light-mode colors, so
 *  status badges read correctly on the dark surface background (see globals.css). */
export const STATUS_BADGE_CLASSNAMES = {
  DRAFT:                'border-border       bg-muted/60          text-muted-foreground',
  PENDING_VERIFICATION: 'border-warning/40   bg-warning/10        text-warning',
  VERIFIED:             'border-primary/40   bg-primary/10        text-primary',
  RELAYING:             'border-primary/60   bg-primary/15        text-primary      animate-pulse',
  RELAYED:              'border-success/40   bg-success/10        text-success',
  FAILED:               'border-danger/40    bg-danger/10         text-danger',
  DELAYED:              'border-warning/60   bg-warning/15        text-warning',
  ARCHIVED:             'border-border       bg-surface-hover     text-faint',
};

export const MESSAGE_TYPE_LABELS = {
  DISTRESS: 'Distress',
  URGENCY: 'Urgency',
  SAFETY: 'Safety',
  NTM: 'NTM',
};

/**
 * Jenis berita tag colors — the one deliberate exception to the design
 * system's palette (see globals.css): Distress/Urgency/Safety/NTM need
 * their own differentiation regardless of message status, so these use
 * the danger/warning/success/primary tokens directly rather than being
 * restricted like status badges are.
 */
export const MESSAGE_TYPE_BADGE_CLASSNAMES = {
  DISTRESS: 'bg-danger/15 text-danger',
  URGENCY: 'bg-warning/15 text-warning',
  SAFETY: 'bg-success/15 text-success',
  NTM: 'bg-primary/15 text-primary',
};

export const PRIORITY_LABELS = {
  LOW: 'Rendah',
  NORMAL: 'Normal',
  HIGH: 'Tinggi',
  CRITICAL: 'Kritis',
};

export const PRIORITY_BADGE_CLASSNAMES = {
  LOW:      'border-slate-300  bg-slate-100   text-slate-500',
  NORMAL:   'border-blue-300   bg-blue-50     text-blue-700',
  HIGH:     'border-amber-300  bg-amber-50    text-amber-700',
  CRITICAL: 'border-red-400    bg-red-50      text-red-700 font-semibold',
};

/**
 * Which action buttons should be available for a message, given its
 * current status and the viewer's role + ownership. Each action key maps
 * 1:1 to a Server Action (see actions.js) and a DB RPC of the same name.
 */
export function availableActions({ status, role, isOwner }) {
  const actions = [];

  if (canTransition(status, 'PENDING_VERIFICATION') && can(role, 'messages.submit_for_verification') && (role === 'ADMIN' || isOwner)) {
    actions.push('submit_for_verification');
  }
  if (canTransition(status, 'VERIFIED') && can(role, 'messages.verify')) {
    actions.push('verify');
  }
  if (canTransition(status, 'FAILED') && can(role, 'messages.mark_failed')) {
    actions.push('mark_failed');
  }
  if ((canTransition(status, 'RELAYING') || status === 'FAILED') && can(role, 'messages.relay')) {
    // VERIFIED and FAILED both lead to RELAYING via the same relay action.
    if (status === 'VERIFIED' || status === 'FAILED') actions.push('relay');
  }
  if (status === 'DRAFT' && can(role, 'messages.archive_draft') && (role === 'ADMIN' || isOwner)) {
    actions.push('archive');
  }
  if (status === 'RELAYED' && can(role, 'messages.archive_relayed')) {
    actions.push('archive');
  }

  return actions;
}
