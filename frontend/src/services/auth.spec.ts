import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  superTokensInit: vi.fn(),
  emailPasswordInit: vi.fn(() => ({ recipe: 'email-password' })),
  sessionInit: vi.fn(() => ({ recipe: 'session' }))
}));

async function importAuthModule() {
  vi.doMock('supertokens-auth-react', () => ({
    default: {
      init: mocks.superTokensInit
    }
  }));

  vi.doMock('supertokens-auth-react/recipe/emailpassword', () => ({
    default: {
      init: mocks.emailPasswordInit
    }
  }));

  vi.doMock('supertokens-auth-react/recipe/session', () => ({
    default: {
      init: mocks.sessionInit
    }
  }));

  return import('./auth');
}

describe('auth service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('prefers explicit auth domains from env vars', async () => {
    vi.stubEnv('VITE_API_DOMAIN', 'https://api.swapcampus.test');
    vi.stubEnv('VITE_WEBSITE_DOMAIN', 'https://swapcampus.test');

    const { authConfig } = await importAuthModule();

    expect(authConfig).toEqual({
      apiDomain: 'https://api.swapcampus.test',
      apiBasePath: '/api/auth',
      websiteDomain: 'https://swapcampus.test',
      websiteBasePath: '/login'
    });
  });

  it('falls back to browser domains and initializes SuperTokens only once', async () => {
    vi.stubEnv('VITE_API_DOMAIN', '');
    vi.stubEnv('VITE_WEBSITE_DOMAIN', '');

    const { authConfig, initAuth } = await importAuthModule();

    expect(authConfig.apiDomain).toBe(`${window.location.protocol}//${window.location.hostname}:3001`);
    expect(authConfig.websiteDomain).toBe(window.location.origin);

    initAuth();
    initAuth();

    expect(mocks.emailPasswordInit).toHaveBeenCalledTimes(1);
    expect(mocks.sessionInit).toHaveBeenCalledTimes(1);
    expect(mocks.sessionInit).toHaveBeenCalledWith({
      tokenTransferMethod: 'header'
    });
    expect(mocks.superTokensInit).toHaveBeenCalledTimes(1);
    expect(mocks.superTokensInit).toHaveBeenCalledWith({
      appInfo: {
        appName: 'SwapCampus',
        apiDomain: authConfig.apiDomain,
        apiBasePath: '/api/auth',
        websiteDomain: authConfig.websiteDomain,
        websiteBasePath: '/login'
      },
      recipeList: [
        { recipe: 'email-password' },
        { recipe: 'session' }
      ]
    });
  });
});
