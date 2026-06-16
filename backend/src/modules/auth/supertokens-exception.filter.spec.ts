const handler = jest.fn();
const errorHandler = jest.fn(() => handler);

jest.mock('supertokens-node/framework/express', () => ({
  errorHandler
}));

import { SuperTokensExceptionFilter } from './supertokens-exception.filter';

describe('SuperTokensExceptionFilter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function createHost(response: any) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ path: '/api' }),
        getResponse: () => response
      })
    } as any;
  }

  it('rethrows when headers were already sent', async () => {
    const exception = new Error('already committed');

    await expect(new SuperTokensExceptionFilter().catch(exception, createHost({ headersSent: true }))).rejects.toBe(exception);
    expect(errorHandler).not.toHaveBeenCalled();
  });

  it('passes the exception to the SuperTokens error handler while the response is open', async () => {
    const response = { headersSent: false };

    await new SuperTokensExceptionFilter().catch(new Error('bad request'), createHost(response));

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.any(Error), expect.any(Object), response, expect.any(Function));
  });

  it('rethrows when the SuperTokens error handler fails', async () => {
    const exception = new Error('boom');
    handler.mockRejectedValueOnce(new Error('secondary'));

    await expect(new SuperTokensExceptionFilter().catch(exception, createHost({ headersSent: false }))).rejects.toBe(exception);
  });
});
