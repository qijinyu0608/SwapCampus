import type { Request, Response } from 'express';
import type { SessionContainer } from 'supertokens-node/recipe/session';

export type SessionRequest = Request & {
  session?: SessionContainer;
};

export type SessionResponse = Response;
