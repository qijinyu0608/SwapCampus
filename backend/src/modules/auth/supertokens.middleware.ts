import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction } from 'express';
import { middleware } from 'supertokens-node/framework/express';
import type { SessionRequest, SessionResponse } from './supertokens.types';

@Injectable()
export class SuperTokensMiddleware implements NestMiddleware {
  async use(req: SessionRequest, res: SessionResponse, next: NextFunction) {
    await middleware()(req, res, next);
  }
}
