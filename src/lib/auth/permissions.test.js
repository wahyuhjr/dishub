import { describe, it, expect } from 'vitest';
import { can, rolesFor, ROLES } from './permissions';

/**
 * Independent expectation table mirroring the specified role matrix,
 * deliberately kept separate from permissions.js so this test actually
 * validates the business rules (every role x every kind of access)
 * rather than mirroring the implementation back at itself.
 *
 *   ADMIN    : full access to everything, incl. user & station management.
 *   MASTER   : verifies messages, publishes NTM, views reports/monitoring.
 *   OPERATOR : creates messages/drafts, performs relay, views own history.
 *   VIEWER   : read-only across dashboard, monitoring, messages, reports.
 */
const EXPECTATIONS = {
  ADMIN: {
    'messages.view': true,
    'messages.create': true,
    'messages.update_own_draft': true,
    'messages.submit_for_verification': true,
    'messages.verify': true,
    'messages.mark_failed': true,
    'messages.relay': true,
    'messages.archive_draft': true,
    'messages.archive_relayed': true,
    'messages.delete': true,
    'ntm.view': true,
    'ntm.create': true,
    'ntm.update_own_draft': true,
    'ntm.submit_for_verification': true,
    'ntm.verify': true,
    'ntm.publish': true,
    'ntm.archive_draft': true,
    'ntm.archive_published': true,
    'ntm.revise': true,
    'ntm.delete': true,
    'documents.generate': true,
    'documents.view': true,
    'documents.archive': true,
    'relay.view': true,
    'relay.create': true,
    'relay.delete': true,
    'stations.view': true,
    'stations.manage': true,
    'stations.delete': true,
    'users.manage': true,
    'users.delete': true,
    'reports.view': true,
    'monitoring.view': true,
    'monitoring.log': true,
  },
  MASTER: {
    'messages.view': true,
    'messages.create': false,
    'messages.update_own_draft': false,
    'messages.submit_for_verification': false,
    'messages.verify': true,
    'messages.mark_failed': true,
    'messages.relay': false,
    'messages.archive_draft': false,
    'messages.archive_relayed': true,
    'messages.delete': false,
    'ntm.view': true,
    'ntm.create': false,
    'ntm.update_own_draft': false,
    'ntm.submit_for_verification': false,
    'ntm.verify': true,
    'ntm.publish': true,
    'ntm.archive_draft': false,
    'ntm.archive_published': true,
    'ntm.revise': true,
    'ntm.delete': false,
    'documents.generate': false,
    'documents.view': true,
    'documents.archive': true,
    'relay.view': true,
    'relay.create': false,
    'relay.delete': false,
    'stations.view': true,
    'stations.manage': false,
    'stations.delete': false,
    'users.manage': false,
    'users.delete': false,
    'reports.view': true,
    'monitoring.view': true,
    'monitoring.log': false,
  },
  OPERATOR: {
    'messages.view': true,
    'messages.create': true,
    'messages.update_own_draft': true,
    'messages.submit_for_verification': true,
    'messages.verify': false,
    'messages.mark_failed': false,
    'messages.relay': true,
    'messages.archive_draft': true,
    'messages.archive_relayed': false,
    'messages.delete': false,
    'ntm.view': true,
    'ntm.create': true,
    'ntm.update_own_draft': true,
    'ntm.submit_for_verification': true,
    'ntm.verify': false,
    'ntm.publish': false,
    'ntm.archive_draft': true,
    'ntm.archive_published': false,
    'ntm.revise': false,
    'ntm.delete': false,
    'documents.generate': true,
    'documents.view': true,
    'documents.archive': false,
    'relay.view': true,
    'relay.create': true,
    'relay.delete': false,
    'stations.view': true,
    'stations.manage': false,
    'stations.delete': false,
    'users.manage': false,
    'users.delete': false,
    'reports.view': true,
    'monitoring.view': true,
    'monitoring.log': false,
  },
  VIEWER: {
    'messages.view': true,
    'messages.create': false,
    'messages.update_own_draft': false,
    'messages.submit_for_verification': false,
    'messages.verify': false,
    'messages.mark_failed': false,
    'messages.relay': false,
    'messages.archive_draft': false,
    'messages.archive_relayed': false,
    'messages.delete': false,
    'ntm.view': true,
    'ntm.create': false,
    'ntm.update_own_draft': false,
    'ntm.submit_for_verification': false,
    'ntm.verify': false,
    'ntm.publish': false,
    'ntm.archive_draft': false,
    'ntm.archive_published': false,
    'ntm.revise': false,
    'ntm.delete': false,
    'documents.generate': false,
    'documents.view': true,
    'documents.archive': false,
    'relay.view': true,
    'relay.create': false,
    'relay.delete': false,
    'stations.view': true,
    'stations.manage': false,
    'stations.delete': false,
    'users.manage': false,
    'users.delete': false,
    'reports.view': true,
    'monitoring.view': true,
    'monitoring.log': false,
  },
};

describe('permissions matrix', () => {
  it('defines exactly the four specified roles', () => {
    expect(ROLES).toEqual(['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER']);
  });

  for (const role of Object.keys(EXPECTATIONS)) {
    describe(`${role} role`, () => {
      for (const [action, expected] of Object.entries(EXPECTATIONS[role])) {
        it(`${expected ? 'allows' : 'denies'} "${action}"`, () => {
          expect(can(role, action)).toBe(expected);
        });
      }
    });
  }

  it('throws for an unknown action instead of silently allowing/denying', () => {
    expect(() => can('ADMIN', 'not.a.real.action')).toThrow();
    expect(() => rolesFor('not.a.real.action')).toThrow();
  });

  it('never grants VIEWER any mutation-style action', () => {
    const mutationActions = [
      'messages.create',
      'messages.update_own_draft',
      'messages.submit_for_verification',
      'messages.verify',
      'messages.mark_failed',
      'messages.relay',
      'messages.archive_draft',
      'messages.archive_relayed',
      'messages.delete',
      'ntm.verify',
      'ntm.publish',
      'ntm.archive_published',
      'ntm.revise',
      'ntm.delete',
      'documents.archive',
      'relay.create',
      'relay.delete',
      'stations.manage',
      'stations.delete',
      'users.manage',
      'users.delete',
      'monitoring.log',
    ];

    for (const action of mutationActions) {
      expect(can('VIEWER', action)).toBe(false);
    }
  });
});
