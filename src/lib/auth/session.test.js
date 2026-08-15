import { describe, it, expect } from 'vitest';
import { fetchCurrentUser } from './session';

function makeFakeSupabase({ authUser = null, authError = null, profile = null, profileError = null } = {}) {
  return {
    auth: {
      async getUser() {
        return { data: { user: authUser }, error: authError };
      },
    },
    from(table) {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table queried: ${table}`);
      }
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async single() {
          return { data: profile, error: profileError };
        },
      };
    },
  };
}

describe('fetchCurrentUser', () => {
  it('returns null when there is no authenticated user', async () => {
    const supabase = makeFakeSupabase({ authUser: null });
    await expect(fetchCurrentUser(supabase)).resolves.toBeNull();
  });

  it('returns null when Supabase Auth reports an error', async () => {
    const supabase = makeFakeSupabase({ authUser: null, authError: new Error('invalid session') });
    await expect(fetchCurrentUser(supabase)).resolves.toBeNull();
  });

  it('returns null when the profile row is missing', async () => {
    const supabase = makeFakeSupabase({
      authUser: { id: 'user-1', email: 'a@example.com' },
      profile: null,
    });
    await expect(fetchCurrentUser(supabase)).resolves.toBeNull();
  });

  it('returns null when the profile query errors', async () => {
    const supabase = makeFakeSupabase({
      authUser: { id: 'user-1', email: 'a@example.com' },
      profile: null,
      profileError: new Error('db error'),
    });
    await expect(fetchCurrentUser(supabase)).resolves.toBeNull();
  });

  it('returns null when the profile is deactivated (is_active = false)', async () => {
    const supabase = makeFakeSupabase({
      authUser: { id: 'user-1', email: 'a@example.com' },
      profile: { id: 'user-1', username: 'a', role: 'OPERATOR', is_active: false },
    });
    await expect(fetchCurrentUser(supabase)).resolves.toBeNull();
  });

  for (const role of ['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER']) {
    it(`returns the profile with role ${role} for an active, authenticated user`, async () => {
      const supabase = makeFakeSupabase({
        authUser: { id: 'user-1', email: 'a@example.com' },
        profile: { id: 'user-1', username: 'user1', role, is_active: true },
      });

      await expect(fetchCurrentUser(supabase)).resolves.toEqual({
        id: 'user-1',
        email: 'a@example.com',
        username: 'user1',
        role,
        is_active: true,
      });
    });
  }

  it('never derives the role from anything other than the profiles table row', async () => {
    // Even if the auth user object carried a role-like field (as it might
    // via user_metadata in a misconfigured client), fetchCurrentUser must
    // ignore it and only trust the profiles row looked up by id.
    const supabase = makeFakeSupabase({
      authUser: { id: 'user-1', email: 'a@example.com', role: 'ADMIN', user_metadata: { role: 'ADMIN' } },
      profile: { id: 'user-1', username: 'user1', role: 'VIEWER', is_active: true },
    });

    const result = await fetchCurrentUser(supabase);
    expect(result.role).toBe('VIEWER');
  });
});
