import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import Session from 'supertokens-node/recipe/session';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser, RequestWithAuthenticatedUser } from '../auth.types';
import { DEV_AUTH_HEADER } from '../dev-auth.constants';
import { resolveDevFallbackUser } from '../dev-auth.utils';
import type { SessionRequest } from '../supertokens.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SessionRequest & RequestWithAuthenticatedUser>();
    const response = context.switchToHttp().getResponse();

    let session;
    try {
      session = await Session.getSession(request, response, {
        sessionRequired: false,
        checkDatabase: true
      });
    } catch {
      session = undefined;
    }

    if (!session) {
      const fallbackUser = await resolveDevFallbackUser(this.prisma, request.headers[DEV_AUTH_HEADER]);
      if (!fallbackUser) {
        throw new UnauthorizedException('请先登录');
      }

      request.user = fallbackUser;
      return true;
    }

    request.session = session;
    const accessTokenPayload = session.getAccessTokenPayload();
    const authUser: AuthenticatedUser = {
      id: Number(accessTokenPayload.userId),
      supertokensUserId: String(session.getUserId()),
      studentId: typeof accessTokenPayload.studentId === 'string' ? accessTokenPayload.studentId : null,
      displayName: typeof accessTokenPayload.displayName === 'string' ? accessTokenPayload.displayName : undefined,
      email: String(accessTokenPayload.email ?? ''),
      role: (accessTokenPayload.role as UserRole) ?? UserRole.USER,
      authSource: 'supertokens'
    };
    request.user = authUser;
    return true;
  }
}
