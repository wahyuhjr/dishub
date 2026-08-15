import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted above imports by Vitest, so any outer
// variables they reference must be created via vi.hoisted().
const { redirectMock, getCurrentUserMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url) => {
    const err = new Error(`NEXT_REDIRECT:${url}`);
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('./session', () => ({
  getCurrentUser: getCurrentUserMock,
}));

const { requireUser, requireRole, requireAnyRole } = await import('./guards');

function makeUser(role) {
  return { id: 'user-1', username: 'tester', role };
}

beforeEach(() => {
  redirectMock.mockClear();
  getCurrentUserMock.mockReset();
});

describe('requireUser', () => {
  it('redirects to /login when there is no session', async () => {
    getCurrentUserMock.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow();
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('returns the current user when a session exists', async () => {
    const user = makeUser('VIEWER');
    getCurrentUserMock.mockResolvedValue(user);

    await expect(requireUser()).resolves.toEqual(user);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('redirects unauthenticated users to /login (not /forbidden)', async () => {
    getCurrentUserMock.mockResolvedValue(null);

    await expect(requireRole('ADMIN')).rejects.toThrow();
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  for (const role of ['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER']) {
    it(`allows a ${role} user to pass a ${role}-only check`, async () => {
      getCurrentUserMock.mockResolvedValue(makeUser(role));

      await expect(requireRole(role)).resolves.toEqual(makeUser(role));
      expect(redirectMock).not.toHaveBeenCalled();
    });
  }

  const otherRoles = { ADMIN: 'MASTER', MASTER: 'OPERATOR', OPERATOR: 'VIEWER', VIEWER: 'ADMIN' };
  for (const [required, actual] of Object.entries(otherRoles)) {
    it(`redirects a ${actual} user to /forbidden for a ${required}-only check`, async () => {
      getCurrentUserMock.mockResolvedValue(makeUser(actual));

      await expect(requireRole(required)).rejects.toThrow();
      expect(redirectMock).toHaveBeenCalledWith('/forbidden');
    });
  }
});

describe('requireAnyRole', () => {
  it('redirects unauthenticated users to /login (not /forbidden)', async () => {
    getCurrentUserMock.mockResolvedValue(null);

    await expect(requireAnyRole(['ADMIN', 'MASTER'])).rejects.toThrow();
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  // Mirrors permissions.js "messages.create": ['ADMIN', 'OPERATOR']
  const allowedForCreate = ['ADMIN', 'OPERATOR'];

  for (const role of ['ADMIN', 'MASTER', 'OPERATOR', 'VIEWER']) {
    const shouldAllow = allowedForCreate.includes(role);

    it(`${shouldAllow ? 'allows' : 'denies'} ${role} for a messages.create-style check`, async () => {
      getCurrentUserMock.mockResolvedValue(makeUser(role));

      if (shouldAllow) {
        await expect(requireAnyRole(allowedForCreate)).resolves.toEqual(makeUser(role));
        expect(redirectMock).not.toHaveBeenCalled();
      } else {
        await expect(requireAnyRole(allowedForCreate)).rejects.toThrow();
        expect(redirectMock).toHaveBeenCalledWith('/forbidden');
      }
    });
  }
});
