import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { requireAdminUser, requireAuthenticatedUser } from './auth.utils';
import { buildDevFallbackHeaderValue, isDevAuthFallbackEnabled, resolveDevFallbackUser } from './dev-auth.utils';

describe('auth utility helpers', () => {
  afterEach(() => {
    delete process.env.ENABLE_DEV_AUTH_FALLBACK;
  });

  it('requires authenticated and admin users', () => {
    expect(() => requireAuthenticatedUser()).toThrow(ForbiddenException);
    expect(requireAuthenticatedUser({ id: 1 } as any)).toEqual({ id: 1 });
    expect(() => requireAdminUser({ id: 1, role: UserRole.USER } as any)).toThrow(ForbiddenException);
    expect(requireAdminUser({ id: 2, role: UserRole.ADMIN } as any)).toEqual({ id: 2, role: UserRole.ADMIN });
  });

  it('resolves dev fallback users when enabled', async () => {
    process.env.ENABLE_DEV_AUTH_FALLBACK = 'true';
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 8,
          studentId: '202600008',
          displayName: 'dev',
          email: 'dev@example.com',
          avatarUrl: '/a.png',
          role: UserRole.USER,
          accountStatus: 'ACTIVE'
        })
      }
    } as any;

    expect(isDevAuthFallbackEnabled()).toBe(true);
    expect(buildDevFallbackHeaderValue(8)).toBe('8');
    await expect(resolveDevFallbackUser(prisma, '8')).resolves.toEqual(expect.objectContaining({
      id: 8,
      authSource: 'dev-fallback'
    }));
    await expect(resolveDevFallbackUser(prisma, '0')).resolves.toBeNull();
    prisma.user.findUnique.mockResolvedValueOnce({ accountStatus: 'BANNED' });
    await expect(resolveDevFallbackUser(prisma, '8')).resolves.toBeNull();
  });

  it('disables dev fallback when env is absent', async () => {
    const prisma = {
      user: { findUnique: jest.fn() }
    } as any;
    expect(isDevAuthFallbackEnabled()).toBe(false);
    await expect(resolveDevFallbackUser(prisma, '1')).resolves.toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
