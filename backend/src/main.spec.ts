import { ValidationPipe } from '@nestjs/common';
import { DEV_AUTH_HEADER } from './modules/auth/dev-auth.constants';

const flushPromises = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
};

describe('main bootstrap', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    delete process.env.NODE_ENV;
    delete process.env.PORT;
  });

  async function importMain(options?: {
    nodeEnv?: string;
    port?: string;
    websiteDomain?: string;
    ensureRolesError?: Error;
    ensureDevAccountsError?: Error;
  }) {
    if (options?.nodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = options.nodeEnv;
    }

    if (options?.port === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = options.port;
    }

    const authSyncService = {
      ensureRoles: jest.fn().mockResolvedValue(undefined),
      ensureDevAccounts: jest.fn().mockResolvedValue(undefined)
    };
    if (options?.ensureRolesError) {
      authSyncService.ensureRoles.mockRejectedValue(options.ensureRolesError);
    }
    if (options?.ensureDevAccountsError) {
      authSyncService.ensureDevAccounts.mockRejectedValue(options.ensureDevAccountsError);
    }

    const app = {
      setGlobalPrefix: jest.fn(),
      useGlobalPipes: jest.fn(),
      enableShutdownHooks: jest.fn(),
      enableCors: jest.fn(),
      get: jest.fn(() => authSyncService),
      listen: jest.fn().mockResolvedValue(undefined)
    };

    const create = jest.fn().mockResolvedValue(app);
    const ensureSuperTokensInitialized = jest.fn();
    const getAllCORSHeaders = jest.fn(() => ['rid', 'fdi-version']);
    const getAppInfo = jest.fn(() => ({
      appName: 'SwapCampus',
      apiDomain: 'http://localhost:3001',
      websiteDomain: options?.websiteDomain ?? 'http://localhost:5178',
      apiBasePath: '/api/auth',
      websiteBasePath: '/login'
    }));

    jest.doMock('./load-env', () => ({}));
    jest.doMock('./app.module', () => ({ AppModule: class AppModule {} }));
    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        create
      }
    }));
    jest.doMock('supertokens-node', () => ({
      __esModule: true,
      default: {
        getAllCORSHeaders
      }
    }));
    jest.doMock('./modules/auth/supertokens.config', () => ({
      getAppInfo
    }));
    jest.doMock('./modules/auth/supertokens.service', () => ({
      ensureSuperTokensInitialized
    }));

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await jest.isolateModulesAsync(async () => {
      await import('./main');
    });
    await flushPromises();

    return {
      app,
      authSyncService,
      create,
      ensureSuperTokensInitialized,
      getAllCORSHeaders,
      getAppInfo,
      warnSpy
    };
  }

  it('configures the dev app with permissive cors and continues after bootstrap warnings', async () => {
    const rolesError = new Error('roles failed');
    const devAccountsError = new Error('dev accounts failed');
    const {
      app,
      authSyncService,
      create,
      ensureSuperTokensInitialized,
      warnSpy
    } = await importMain({
      nodeEnv: 'development',
      port: '4567',
      ensureRolesError: rolesError,
      ensureDevAccountsError: devAccountsError
    });

    expect(ensureSuperTokensInitialized).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.useGlobalPipes.mock.calls[0][0]).toBeInstanceOf(Object);
    expect(app.useGlobalPipes.mock.calls[0][0].constructor.name).toBe('ValidationPipe');
    expect(app.enableShutdownHooks).toHaveBeenCalledTimes(1);
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: true,
      credentials: true,
      allowedHeaders: ['content-type', DEV_AUTH_HEADER, 'rid', 'fdi-version'],
      exposedHeaders: ['rid', 'fdi-version']
    });
    expect(app.get).toHaveBeenCalledTimes(2);
    expect(authSyncService.ensureRoles).toHaveBeenCalledTimes(1);
    expect(authSyncService.ensureDevAccounts).toHaveBeenCalledTimes(1);
    expect(app.listen).toHaveBeenCalledWith('4567');
    expect(warnSpy).toHaveBeenCalledWith('SuperTokens bootstrap skipped:', rolesError);
    expect(warnSpy).toHaveBeenCalledWith('Dev account bootstrap skipped:', devAccountsError);
  });

  it('builds production cors origins from a valid website domain', async () => {
    const { app, authSyncService, getAppInfo } = await importMain({
      nodeEnv: 'production',
      websiteDomain: 'https://swap.example:8443'
    });

    expect(getAppInfo).toHaveBeenCalledTimes(1);
    expect(app.enableCors).toHaveBeenCalledWith(expect.objectContaining({
      origin: [
        'https://swap.example:8443',
        'https://localhost:8443',
        'https://127.0.0.1:8443'
      ]
    }));
    expect(authSyncService.ensureDevAccounts).not.toHaveBeenCalled();
    expect(app.listen).toHaveBeenCalledWith(3000);
  });

  it('falls back to localhost cors origins for invalid production website domains', async () => {
    const { app } = await importMain({
      nodeEnv: 'production',
      websiteDomain: 'not-a-valid-url'
    });

    expect(app.enableCors).toHaveBeenCalledWith(expect.objectContaining({
      origin: [
        'not-a-valid-url',
        'http://localhost:5178',
        'http://127.0.0.1:5178'
      ]
    }));
  });
});
