import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import Session from 'supertokens-node/recipe/session';
import { resolveDevFallbackUser } from '../dev-auth.utils';
import { JwtAuthGuard } from './jwt-auth.guard';

jest.mock('supertokens-node/recipe/session', () => ({
  __esModule: true,
  default: {
    getSession: jest.fn()
  }
}));

jest.mock('../dev-auth.utils', () => ({
  resolveDevFallbackUser: jest.fn()
}));

describe('JwtAuthGuard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function createContext(request: any, response: any = {}) {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response
      })
    } as any;
  }

  it('maps the authenticated session payload onto request.user', async () => {
    const request: any = { headers: {} };
    const session = {
      getAccessTokenPayload: () => ({
        userId: 8,
        studentId: '202600008',
        displayName: 'Alice',
        email: 'alice@example.com',
        role: UserRole.ADMIN
      }),
      getUserId: () => 'supertokens-user'
    };
    (Session.getSession as jest.Mock).mockResolvedValue(session);

    await expect(new JwtAuthGuard({} as any).canActivate(createContext(request))).resolves.toBe(true);
    expect(request.session).toBe(session);
    expect(request.user).toEqual({
      id: 8,
      supertokensUserId: 'supertokens-user',
      studentId: '202600008',
      displayName: 'Alice',
      email: 'alice@example.com',
      role: UserRole.ADMIN,
      authSource: 'supertokens'
    });
  });

  it('falls back to the dev auth user when no session exists', async () => {
    const request: any = { headers: { 'x-dev-auth-user-id': '11' } };
    (Session.getSession as jest.Mock).mockResolvedValue(undefined);
    (resolveDevFallbackUser as jest.Mock).mockResolvedValue({
      id: 11,
      displayName: 'dev-user',
      role: UserRole.USER,
      authSource: 'dev-fallback'
    });

    await expect(new JwtAuthGuard({} as any).canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual(expect.objectContaining({
      id: 11,
      authSource: 'dev-fallback'
    }));
  });

  it('prefers the dev auth user over an existing session when the header is present', async () => {
    const request: any = { headers: { 'x-dev-auth-user-id': '94' } };
    const session = {
      getAccessTokenPayload: () => ({
        userId: 95,
        studentId: '202600001',
        displayName: 'user01',
        email: 'user01@swapcampus.local',
        role: UserRole.USER
      }),
      getUserId: () => 'supertokens-user-95'
    };
    (resolveDevFallbackUser as jest.Mock).mockResolvedValue({
      id: 94,
      displayName: 'ADMIN',
      email: 'admin@swapcampus.local',
      role: UserRole.ADMIN,
      authSource: 'dev-fallback'
    });
    (Session.getSession as jest.Mock).mockResolvedValue(session);

    await expect(new JwtAuthGuard({} as any).canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual(expect.objectContaining({
      id: 94,
      role: UserRole.ADMIN,
      authSource: 'dev-fallback'
    }));
    expect(request.session).toBeUndefined();
  });

  it('throws when neither a session nor a dev fallback user is available', async () => {
    const request: any = { headers: {} };
    (Session.getSession as jest.Mock).mockRejectedValue(new Error('no session'));
    (resolveDevFallbackUser as jest.Mock).mockResolvedValue(null);

    await expect(new JwtAuthGuard({} as any).canActivate(createContext(request))).rejects.toThrow(UnauthorizedException);
  });
});
