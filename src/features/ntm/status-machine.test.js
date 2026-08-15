import { describe, it, expect } from 'vitest';
import { canTransitionNtm, availableNtmActions, NTM_STATUSES } from './status-machine';

describe('canTransitionNtm', () => {
  it('allows every valid edge of the state machine', () => {
    expect(canTransitionNtm('DRAFT', 'PENDING_VERIFICATION')).toBe(true);
    expect(canTransitionNtm('PENDING_VERIFICATION', 'VERIFIED')).toBe(true);
    expect(canTransitionNtm('VERIFIED', 'PUBLISHED')).toBe(true);
    expect(canTransitionNtm('DRAFT', 'ARCHIVED')).toBe(true);
    expect(canTransitionNtm('PUBLISHED', 'ARCHIVED')).toBe(true);
  });

  it('rejects invalid edges, including skipping steps', () => {
    expect(canTransitionNtm('DRAFT', 'VERIFIED')).toBe(false);
    expect(canTransitionNtm('DRAFT', 'PUBLISHED')).toBe(false);
    expect(canTransitionNtm('PENDING_VERIFICATION', 'PUBLISHED')).toBe(false);
    expect(canTransitionNtm('PUBLISHED', 'DRAFT')).toBe(false);
    expect(canTransitionNtm('ARCHIVED', 'DRAFT')).toBe(false);
  });

  it('defines exactly the five expected statuses', () => {
    expect(NTM_STATUSES).toEqual(['DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'PUBLISHED', 'ARCHIVED']);
  });
});

describe('availableNtmActions', () => {
  it('lets the owning OPERATOR edit/submit/archive their own DRAFT, but never verify or publish', () => {
    const actions = availableNtmActions({ status: 'DRAFT', role: 'OPERATOR', isOwner: true, hasDocument: false });
    expect(actions).toContain('edit');
    expect(actions).toContain('submit_for_verification');
    expect(actions).toContain('archive');
    expect(actions).toContain('upload_document');
    expect(actions).not.toContain('verify');
    expect(actions).not.toContain('publish');
  });

  it('never lets a non-owning OPERATOR edit/submit/archive another operator\'s DRAFT', () => {
    const actions = availableNtmActions({ status: 'DRAFT', role: 'OPERATOR', isOwner: false, hasDocument: false });
    expect(actions).not.toContain('edit');
    expect(actions).not.toContain('submit_for_verification');
    expect(actions).not.toContain('archive');
  });

  it('lets MASTER verify a PENDING_VERIFICATION NTM but not an OPERATOR', () => {
    expect(availableNtmActions({ status: 'PENDING_VERIFICATION', role: 'MASTER', isOwner: false, hasDocument: false })).toContain(
      'verify'
    );
    expect(
      availableNtmActions({ status: 'PENDING_VERIFICATION', role: 'OPERATOR', isOwner: true, hasDocument: false })
    ).not.toContain('verify');
  });

  it('only allows publish when a document is attached', () => {
    expect(availableNtmActions({ status: 'VERIFIED', role: 'MASTER', isOwner: false, hasDocument: false })).not.toContain(
      'publish'
    );
    expect(availableNtmActions({ status: 'VERIFIED', role: 'MASTER', isOwner: false, hasDocument: true })).toContain(
      'publish'
    );
  });

  it('only ADMIN/MASTER can archive or revise a PUBLISHED NTM, never OPERATOR/VIEWER', () => {
    for (const role of ['ADMIN', 'MASTER']) {
      const actions = availableNtmActions({ status: 'PUBLISHED', role, isOwner: false, hasDocument: true });
      expect(actions).toContain('archive');
      expect(actions).toContain('revise');
    }
    for (const role of ['OPERATOR', 'VIEWER']) {
      const actions = availableNtmActions({ status: 'PUBLISHED', role, isOwner: false, hasDocument: true });
      expect(actions).not.toContain('archive');
      expect(actions).not.toContain('revise');
    }
  });

  it('offers no actions at all for an ARCHIVED NTM', () => {
    const actions = availableNtmActions({ status: 'ARCHIVED', role: 'ADMIN', isOwner: true, hasDocument: true });
    expect(actions).toEqual([]);
  });
});
