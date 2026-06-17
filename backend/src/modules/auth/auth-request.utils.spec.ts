import Session from 'supertokens-node/recipe/session';
import { resolveOptionalAuthUser } from './auth-request.utils';
import { UserRole } from '@prisma/client';

jest.mock('supertokens-node/recipe/session', () => ({
  __esModule: true,
  default: {
    getSession: jest.fn()
  }
}));

describe('resolveOptionalAuthUser', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns request user first', async () => {
    const prisma = { user: { findUnique: jest.fn() } } as any;
    await expect(resolveOptionalAuthUser(prisma, { user: { id: 7 } } as any)).resolves.toEqual({ id: 7 });
  });

  it('prefers the dev auth fallback user over the session payload when the header is present', async () => {
    process.env.ENABLE_DEV_AUTH_FALLBACK = 'true';
    (Session.getSession as jest.Mock).mockResolvedValue({
      getAccessTokenPayload: () => ({
        userId: 2,
        studentId: '202600002',
        displayName: 'Alice',
        email: 'alice@example.com',
        role: UserRole.USER
      }),
      getUserId: () => 'supertokens-user'
    });
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 94,
          studentId: 'admin',
          displayName: 'ADMIN',
          email: 'admin@swapcampus.local',
          avatarUrl: null,
          role: UserRole.ADMIN,
          accountStatus: 'ACTIVE'
        })
      }
    } as any;

    await expect(resolveOptionalAuthUser(prisma, { headers: { 'x-dev-auth-user-id': '94' } } as any, {} as any)).resolves.toEqual(expect.objectContaining({
      id: 94,
      role: UserRole.ADMIN,
      authSource: 'dev-fallback'
    }));
  });

  it('resolves session payload when available', async () => {
    (Session.getSession as jest.Mock).mockResolvedValue({
      getAccessTokenPayload: () => ({
        userId: 2,
        studentId: '202600002',
        displayName: 'Alice',
        email: 'alice@example.com',
        role: UserRole.ADMIN
      }),
      getUserId: () => 'supertokens-user'
    });
    const prisma = { user: { findUnique: jest.fn() } } as any;
    await expect(resolveOptionalAuthUser(prisma, { headers: {} } as any, {} as any)).resolves.toEqual({
      id: 2,
      supertokensUserId: 'supertokens-user',
      studentId: '202600002',
      displayName: 'Alice',
      email: 'alice@example.com',
      role: UserRole.ADMIN,
      authSource: 'supertokens'
    });
  });

  it('falls back to dev user lookup when session is missing', async () => {
    (Session.getSession as jest.Mock).mockRejectedValue(new Error('no session'));
    process.env.ENABLE_DEV_AUTH_FALLBACK = 'true';
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          studentId: '202600011',
          displayName: 'dev',
          email: 'dev@example.com',
          avatarUrl: null,
          role: UserRole.USER,
          accountStatus: 'ACTIVE'
        })
      }
    } as any;
    await expect(resolveOptionalAuthUser(prisma, { headers: { 'x-dev-auth-user-id': '11' } } as any, {} as any)).resolves.toEqual(expect.objectContaining({
      id: 11,
      authSource: 'dev-fallback'
    }));
  });
});
