import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from './auth.types';

export function requireAuthenticatedUser(user?: AuthenticatedUser): AuthenticatedUser {
  if (!user) {
    throw new ForbiddenException('请先登录');
  }

  return user;
}

export function requireAdminUser(user?: AuthenticatedUser): AuthenticatedUser {
  const authUser = requireAuthenticatedUser(user);
  if (authUser.role !== UserRole.ADMIN) {
    throw new ForbiddenException('仅管理员可执行该操作');
  }

  return authUser;
}
