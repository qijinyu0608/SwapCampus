export const DEFAULT_TENANT_ID = 'public';

export const APP_PERMISSIONS = {
  ADMIN_ACCESS: 'admin:access',
  PRODUCTS_MODERATE: 'products:moderate',
  ORDERS_MODERATE: 'orders:moderate',
  REPORTS_MODERATE: 'reports:moderate',
  USERS_MODERATE: 'users:moderate'
} as const;

export const APP_ROLES = {
  USER: 'user',
  ADMIN: 'admin'
} as const;

export type AppPermission = (typeof APP_PERMISSIONS)[keyof typeof APP_PERMISSIONS];
export type AppRoleName = (typeof APP_ROLES)[keyof typeof APP_ROLES];
