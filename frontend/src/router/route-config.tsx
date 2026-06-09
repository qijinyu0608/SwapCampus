import type { ReactElement } from 'react';
import { AdminPage } from '../pages/AdminPage';
import { CampusServiceDetailPage } from '../pages/CampusServiceDetailPage';
import { CampusServicePublishPage } from '../pages/CampusServicePublishPage';
import { CampusServicesPage } from '../pages/CampusServicesPage';
import { CreditBadgePreviewPage } from '../pages/CreditBadgePreviewPage';
import { FavoritesPage } from '../pages/FavoritesPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { MessagesPage } from '../pages/MessagesPage';
import { ProductDetailPage } from '../pages/ProductDetailPage';
import { ProductPublishPage } from '../pages/ProductPublishPage';
import { ProfileDetailPage } from '../pages/ProfileDetailPage';
import { ProfilePage } from '../pages/ProfilePage';
import { PublicUserPage } from '../pages/PublicUserPage';
import { SearchPage } from '../pages/SearchPage';
import { RequireAdmin, RequireUser } from './guards';

export type AppRouteDefinition = {
  path: string;
  element: ReactElement;
  navigationLabel?: string;
};

export const appRoutes: AppRouteDefinition[] = [
  { path: '/', element: <HomePage />, navigationLabel: '首页' },
  { path: '/search', element: <RequireUser><SearchPage /></RequireUser> },
  { path: '/campus-services', element: <RequireUser><CampusServicesPage /></RequireUser>, navigationLabel: '校园服务' },
  { path: '/campus-services/:id', element: <RequireUser><CampusServiceDetailPage /></RequireUser> },
  { path: '/campus-services/publish', element: <RequireUser><CampusServicePublishPage /></RequireUser> },
  { path: '/credit-badges', element: <CreditBadgePreviewPage /> },
  { path: '/favorites', element: <FavoritesPage />, navigationLabel: '想要' },
  { path: '/products/:id', element: <ProductDetailPage /> },
  { path: '/users/:id', element: <PublicUserPage /> },
  { path: '/publish', element: <RequireUser><ProductPublishPage /></RequireUser> },
  { path: '/messages', element: <RequireUser><MessagesPage /></RequireUser>, navigationLabel: '消息' },
  { path: '/profile', element: <RequireUser><ProfilePage /></RequireUser>, navigationLabel: '我的' },
  { path: '/profile/detail', element: <RequireUser><ProfileDetailPage /></RequireUser> },
  { path: '/admin', element: <RequireAdmin><AdminPage /></RequireAdmin> },
  { path: '/login', element: <LoginPage /> }
];

export const navigationItems = appRoutes
  .filter((route): route is AppRouteDefinition & { navigationLabel: string } => Boolean(route.navigationLabel))
  .map((route) => ({
    key: route.path,
    label: route.navigationLabel
  }));
