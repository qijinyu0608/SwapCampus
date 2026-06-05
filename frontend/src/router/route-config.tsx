import type { ReactElement } from 'react';
import { AdminPage } from '../pages/AdminPage';
import { CampusServicesPage } from '../pages/CampusServicesPage';
import { FavoritesPage } from '../pages/FavoritesPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { MessagesPage } from '../pages/MessagesPage';
import { ProductDetailPage } from '../pages/ProductDetailPage';
import { ProductPublishPage } from '../pages/ProductPublishPage';
import { ProfileDetailPage } from '../pages/ProfileDetailPage';
import { ProfilePage } from '../pages/ProfilePage';
import { PublicUserPage } from '../pages/PublicUserPage';

export type AppRouteDefinition = {
  path: string;
  element: ReactElement;
  navigationLabel?: string;
};

export const appRoutes: AppRouteDefinition[] = [
  { path: '/', element: <HomePage />, navigationLabel: '首页' },
  { path: '/campus-services', element: <CampusServicesPage />, navigationLabel: '校园服务' },
  { path: '/favorites', element: <FavoritesPage />, navigationLabel: '想要' },
  { path: '/products/:id', element: <ProductDetailPage /> },
  { path: '/users/:id', element: <PublicUserPage /> },
  { path: '/publish', element: <ProductPublishPage /> },
  { path: '/messages', element: <MessagesPage />, navigationLabel: '消息' },
  { path: '/profile', element: <ProfilePage />, navigationLabel: '我的' },
  { path: '/profile/detail', element: <ProfileDetailPage /> },
  { path: '/admin', element: <AdminPage /> },
  { path: '/login', element: <LoginPage /> }
];

export const navigationItems = appRoutes
  .filter((route): route is AppRouteDefinition & { navigationLabel: string } => Boolean(route.navigationLabel))
  .map((route) => ({
    key: route.path,
    label: route.navigationLabel
  }));
