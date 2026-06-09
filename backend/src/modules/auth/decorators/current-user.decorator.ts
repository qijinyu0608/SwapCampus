import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { RequestWithAuthenticatedUser } from '../auth.types';
import type { SessionRequest } from '../supertokens.types';
import type { AuthenticatedUser } from '../auth.types';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthenticatedUser => {
  const request = context.switchToHttp().getRequest<SessionRequest & RequestWithAuthenticatedUser>();
  if (request.user) {
    return request.user;
  }

  const session = request.session;

  if (!session) {
    throw new UnauthorizedException('请先登录');
  }

  const accessTokenPayload = session.getAccessTokenPayload();

  return {
    id: Number(accessTokenPayload.userId),
    supertokensUserId: String(session.getUserId()),
    studentId: String(accessTokenPayload.studentId ?? ''),
    displayName: typeof accessTokenPayload.displayName === 'string' ? accessTokenPayload.displayName : undefined,
    email: String(accessTokenPayload.email ?? ''),
    role: (accessTokenPayload.role as UserRole) ?? UserRole.USER,
    authSource: 'supertokens'
  };
});
