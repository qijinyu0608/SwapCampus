import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import UserRoles from 'supertokens-node/recipe/userroles';
import type { TypeInput } from 'supertokens-node/types';
import { APP_PERMISSIONS, APP_ROLES } from './auth.constants';

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim() || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAppInfo() {
  const apiDomain = requireEnv('API_DOMAIN', 'http://localhost:3001');
  const websiteDomain = requireEnv('WEBSITE_DOMAIN', 'http://localhost:5178');

  return {
    appName: 'SwapCampus',
    apiDomain,
    websiteDomain,
    apiBasePath: '/api/auth',
    websiteBasePath: '/login'
  };
}

export function getSuperTokensConnectionURI() {
  return requireEnv('SUPERTOKENS_CONNECTION_URI', 'http://supertokens:3567');
}

export function getSuperTokensApiKey() {
  return process.env.SUPERTOKENS_API_KEY?.trim() || undefined;
}

export function getSuperTokensConfig(): TypeInput {
  return {
    framework: 'express',
    supertokens: {
      connectionURI: getSuperTokensConnectionURI(),
      apiKey: getSuperTokensApiKey()
    },
    appInfo: getAppInfo(),
    recipeList: [
      EmailPassword.init({
        signUpFeature: {
          formFields: [
            {
              id: 'displayName'
            },
            {
              id: 'studentId',
              optional: true
            },
            {
              id: 'college',
              optional: true
            }
          ]
        }
      }),
      Session.init({
        exposeAccessTokenToFrontendInCookieBasedAuth: false,
        getTokenTransferMethod: () => 'header',
        antiCsrf: 'NONE'
      }),
      UserRoles.init()
    ]
  };
}

export const rolePermissionMap = {
  [APP_ROLES.USER]: [],
  [APP_ROLES.ADMIN]: [
    APP_PERMISSIONS.ADMIN_ACCESS,
    APP_PERMISSIONS.PRODUCTS_MODERATE,
    APP_PERMISSIONS.ORDERS_MODERATE,
    APP_PERMISSIONS.REPORTS_MODERATE,
    APP_PERMISSIONS.USERS_MODERATE
  ]
} as const;
