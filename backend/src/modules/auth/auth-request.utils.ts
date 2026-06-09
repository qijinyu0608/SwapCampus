import { UserRole } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser, RequestWithAuthenticatedUser } from './auth.types';
import { DEV_AUTH_HEADER } from './dev-auth.constants';
import { resolveDevFallbackUser } from './dev-auth.utils';
import type { SessionRequest } from './supertokens.types';

export async function resolveOptionalAuthUser(
  prisma: PrismaService,
  request: SessionRequest & RequestWithAuthenticatedUser
): Promise<AuthenticatedUser | undefined> {
  if (request.user) {
    return request.user;
  }

  const session = request.session;
  const accessTokenPayload = session?.getAccessTokenPayload();
  if (session && accessTokenPayload) {
    return {
      id: Number(accessTokenPayload.userId),
      supertokensUserId: String(session.getUserId()),
      studentId: String(accessTokenPayload.studentId ?? ''),
      displayName: typeof accessTokenPayload.displayName === 'string' ? accessTokenPayload.displayName : undefined,
      email: String(accessTokenPayload.email ?? ''),
      role: (accessTokenPayload.role as UserRole) ?? UserRole.USER,
      authSource: 'supertokens'
    };
  }

  const fallbackUser = await resolveDevFallbackUser(prisma, request.headers[DEV_AUTH_HEADER]);
  return fallbackUser ?? undefined;
}
