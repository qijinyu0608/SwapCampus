const middlewareHandler = jest.fn();
const middleware = jest.fn(() => middlewareHandler);

jest.mock('supertokens-node/framework/express', () => ({
  middleware
}));

import { SuperTokensMiddleware } from './supertokens.middleware';

describe('SuperTokensMiddleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates request handling to the SuperTokens express middleware', async () => {
    const req = { path: '/api' } as any;
    const res = { statusCode: 200 } as any;
    const next = jest.fn();

    await new SuperTokensMiddleware().use(req, res, next);

    expect(middleware).toHaveBeenCalledTimes(1);
    expect(middlewareHandler).toHaveBeenCalledWith(req, res, next);
  });
});
