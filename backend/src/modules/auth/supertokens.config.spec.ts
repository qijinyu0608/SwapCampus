import { APP_PERMISSIONS, APP_ROLES } from './auth.constants';

describe('supertokens config helpers', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    delete process.env.API_DOMAIN;
    delete process.env.WEBSITE_DOMAIN;
    delete process.env.SUPERTOKENS_CONNECTION_URI;
    delete process.env.SUPERTOKENS_API_KEY;
  });

  it('builds the default app info and recipe list', () => {
    const emailInit = jest.fn(() => ({ recipe: 'email' }));
    const sessionInit = jest.fn(() => ({ recipe: 'session' }));
    const userRolesInit = jest.fn(() => ({ recipe: 'roles' }));

    jest.doMock('supertokens-node/recipe/emailpassword', () => ({
      __esModule: true,
      default: {
        init: emailInit
      }
    }));
    jest.doMock('supertokens-node/recipe/session', () => ({
      __esModule: true,
      default: {
        init: sessionInit
      }
    }));
    jest.doMock('supertokens-node/recipe/userroles', () => ({
      __esModule: true,
      default: {
        init: userRolesInit
      }
    }));

    let configModule: any;
    jest.isolateModules(() => {
      configModule = require('./supertokens.config');
    });

    expect(configModule.getAppInfo()).toEqual({
      appName: 'SwapCampus',
      apiDomain: 'http://localhost:3001',
      websiteDomain: 'http://localhost:5178',
      apiBasePath: '/api/auth',
      websiteBasePath: '/login'
    });
    expect(configModule.getSuperTokensConnectionURI()).toBe('http://supertokens:3567');
    expect(configModule.getSuperTokensApiKey()).toBeUndefined();

    const config = configModule.getSuperTokensConfig();

    expect(emailInit).toHaveBeenCalledWith(expect.objectContaining({
      signUpFeature: {
        formFields: [
          { id: 'displayName' },
          { id: 'studentId', optional: true },
          { id: 'college', optional: true }
        ]
      }
    }));
    expect(sessionInit).toHaveBeenCalledWith({
      exposeAccessTokenToFrontendInCookieBasedAuth: false,
      getTokenTransferMethod: expect.any(Function),
      antiCsrf: 'NONE'
    });
    expect(userRolesInit).toHaveBeenCalledTimes(1);
    expect(config).toEqual({
      framework: 'express',
      supertokens: {
        connectionURI: 'http://supertokens:3567',
        apiKey: undefined
      },
      appInfo: configModule.getAppInfo(),
      recipeList: [{ recipe: 'email' }, { recipe: 'session' }, { recipe: 'roles' }]
    });
    expect(configModule.rolePermissionMap[APP_ROLES.USER]).toEqual([]);
    expect(configModule.rolePermissionMap[APP_ROLES.ADMIN]).toEqual([
      APP_PERMISSIONS.ADMIN_ACCESS,
      APP_PERMISSIONS.PRODUCTS_MODERATE,
      APP_PERMISSIONS.ORDERS_MODERATE,
      APP_PERMISSIONS.REPORTS_MODERATE,
      APP_PERMISSIONS.USERS_MODERATE
    ]);
  });

  it('prefers configured domains and trims the api key', () => {
    process.env.API_DOMAIN = ' https://api.example.com ';
    process.env.WEBSITE_DOMAIN = ' https://swap.example.com ';
    process.env.SUPERTOKENS_CONNECTION_URI = ' https://supertokens.example.com ';
    process.env.SUPERTOKENS_API_KEY = ' secret-key ';

    let configModule: any;
    jest.isolateModules(() => {
      configModule = require('./supertokens.config');
    });

    expect(configModule.getAppInfo()).toEqual(expect.objectContaining({
      apiDomain: 'https://api.example.com',
      websiteDomain: 'https://swap.example.com'
    }));
    expect(configModule.getSuperTokensConnectionURI()).toBe('https://supertokens.example.com');
    expect(configModule.getSuperTokensApiKey()).toBe('secret-key');
  });
});
