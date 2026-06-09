import SuperTokens from 'supertokens-auth-react';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword';
import Session from 'supertokens-auth-react/recipe/session';

function requireEnv(value: string | undefined, fallback: string) {
  return value && value.trim() ? value : fallback;
}

export const authConfig = {
  apiDomain: requireEnv(import.meta.env.VITE_API_DOMAIN, 'http://localhost:3001'),
  apiBasePath: '/api/auth',
  websiteDomain: requireEnv(import.meta.env.VITE_WEBSITE_DOMAIN, window.location.origin),
  websiteBasePath: '/login'
};

let initialized = false;

export function initAuth() {
  if (initialized) {
    return;
  }

  SuperTokens.init({
    appInfo: {
      appName: 'SwapCampus',
      apiDomain: authConfig.apiDomain,
      apiBasePath: authConfig.apiBasePath,
      websiteDomain: authConfig.websiteDomain,
      websiteBasePath: authConfig.websiteBasePath
    },
    recipeList: [
      EmailPassword.init(),
      Session.init({
        tokenTransferMethod: 'header'
      })
    ]
  });

  initialized = true;
}
