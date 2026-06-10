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
  const headers = (request as { headers?: Record<string, string | string[] | undefined> }).headers ?? {};

  if (request.user) {
    return request.user;
  }

  const session = request.session;
  const accessTokenPayload = session?.getAccessTokenPayload();
  if (session && accessTokenPayload) {
    return {
      id: Number(accessTokenPayload.userId),
      supertokensUserId: String(session.getUserId()),
      studentId: typeof accessTokenPayload.studentId === 'string' ? accessTokenPayload.studentId : null,
      displayName: typeof accessTokenPayload.displayName === 'string' ? accessTokenPayload.displayName : undefined,
      email: String(accessTokenPayload.email ?? ''),
      role: (accessTokenPayload.role as UserRole) ?? UserRole.USER,
      authSource: 'supertokens'
    };
  }

  const fallbackUser = await resolveDevFallbackUser(prisma, headers[DEV_AUTH_HEADER]);
  return fallbackUser ?? undefined;
}
