import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { errorHandler } from 'supertokens-node/framework/express';
import type { SessionRequest, SessionResponse } from './supertokens.types';

@Catch()
export class SuperTokensExceptionFilter implements ExceptionFilter {
  async catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const req = context.getRequest<SessionRequest>();
    const res = context.getResponse<SessionResponse>();

    if (res.headersSent) {
      throw exception;
    }

    try {
      await errorHandler()(exception, req, res, () => null);
    } catch {
      throw exception;
    }
  }
}
