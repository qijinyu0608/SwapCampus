import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from './auth.types';

export function isDevAuthFallbackEnabled() {
  return process.env.ENABLE_DEV_AUTH_FALLBACK === 'true';
}

export function buildDevFallbackHeaderValue(userId: number) {
  return String(userId);
}

export async function resolveDevFallbackUser(
  prisma: {
    user: {
      findUnique: (args: {
        where: { id: number };
        select: {
          id: true;
          studentId: true;
          displayName: true;
          email: true;
          role: true;
          accountStatus: true;
        };
      }) => Promise<{
        id: number;
        studentId: string;
        displayName: string;
        email: string;
        role: UserRole;
        accountStatus: 'ACTIVE' | 'BANNED';
      } | null>;
    };
  },
  rawUserId?: string | string[] | null
): Promise<AuthenticatedUser | null> {
  if (!isDevAuthFallbackEnabled()) {
    return null;
  }

  const value = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
  const userId = Number(value);
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      studentId: true,
      displayName: true,
      email: true,
      role: true,
      accountStatus: true
    }
  });

  if (!user || user.accountStatus !== 'ACTIVE') {
    return null;
  }

  return {
    id: user.id,
    studentId: user.studentId,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    authSource: 'dev-fallback'
  };
}
