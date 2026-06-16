describe('SuperTokensService', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('initializes SuperTokens only once across helper and service calls', () => {
    const init = jest.fn();
    const getSuperTokensConfig = jest.fn(() => ({ framework: 'express' }));

    jest.doMock('supertokens-node', () => ({
      __esModule: true,
      default: {
        init
      }
    }));
    jest.doMock('./supertokens.config', () => ({
      getSuperTokensConfig
    }));

    let ensureSuperTokensInitialized: any;
    let SuperTokensService: any;

    jest.isolateModules(() => {
      ({ ensureSuperTokensInitialized, SuperTokensService } = require('./supertokens.service'));
    });

    ensureSuperTokensInitialized();
    ensureSuperTokensInitialized();
    new SuperTokensService().onModuleInit();

    expect(getSuperTokensConfig).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith({ framework: 'express' });
  });
});
