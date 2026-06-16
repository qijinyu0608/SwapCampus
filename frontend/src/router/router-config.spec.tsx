import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pageModules = [
  ['../pages/AdminPage', 'AdminPage'],
  ['../pages/AvatarFramePreviewPage', 'AvatarFramePreviewPage'],
  ['../pages/CampusServiceDetailPage', 'CampusServiceDetailPage'],
  ['../pages/CampusServiceOrderDetailPage', 'CampusServiceOrderDetailPage'],
  ['../pages/CampusServicePublishPage', 'CampusServicePublishPage'],
  ['../pages/CampusServicesPage', 'CampusServicesPage'],
  ['../pages/CreditBadgePreviewPage', 'CreditBadgePreviewPage'],
  ['../pages/CreditCenterPage', 'CreditCenterPage'],
  ['../pages/FavoritesPage', 'FavoritesPage'],
  ['../pages/HomePage', 'HomePage'],
  ['../pages/LoginPage', 'LoginPage'],
  ['../pages/MessagesPage', 'MessagesPage'],
  ['../pages/OrderCheckoutPage', 'OrderCheckoutPage'],
  ['../pages/OrderDetailPage', 'OrderDetailPage'],
  ['../pages/OrderSnapshotPage', 'OrderSnapshotPage'],
  ['../pages/ProductDetailPage', 'ProductDetailPage'],
  ['../pages/ProductPublishPage', 'ProductPublishPage'],
  ['../pages/ProductPublishRulesPage', 'ProductPublishRulesPage'],
  ['../pages/ProfileDetailPage', 'ProfileDetailPage'],
  ['../pages/ProfilePage', 'ProfilePage'],
  ['../pages/PublicUserPage', 'PublicUserPage'],
  ['../pages/SearchPage', 'SearchPage']
] as const;

function registerRouteMocks() {
  for (const [modulePath, exportName] of pageModules) {
    vi.doMock(modulePath, () => ({
      [exportName]: () => <div>{exportName}</div>
    }));
  }

  vi.doMock('./guards', () => ({
    RequireUser: ({ children }: any) => <div data-testid="require-user">{children}</div>,
    RequireAdmin: ({ children }: any) => <div data-testid="require-admin">{children}</div>
  }));
}

describe('router configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('defines the expected routes and navigation items', async () => {
    registerRouteMocks();

    const { appRoutes, navigationItems } = await import('./route-config');

    expect(appRoutes).toHaveLength(24);
    expect(navigationItems).toEqual([
      { key: '/', label: '首页' },
      { key: '/campus-services', label: '校园服务' },
      { key: '/favorites', label: '收藏' },
      { key: '/messages', label: '消息' },
      { key: '/profile', label: '我的' }
    ]);

    render(appRoutes.find((route) => route.path === '/')!.element);
    expect(screen.getByText('HomePage')).toBeInTheDocument();

    render(appRoutes.find((route) => route.path === '/search')!.element);
    expect(screen.getAllByTestId('require-user').length).toBeGreaterThan(0);
    expect(screen.getByText('SearchPage')).toBeInTheDocument();

    render(appRoutes.find((route) => route.path === '/admin')!.element);
    expect(screen.getAllByTestId('require-admin').length).toBeGreaterThan(0);
    expect(screen.getByText('AdminPage')).toBeInTheDocument();
  });

  it('renders all configured routes inside the app shell', async () => {
    registerRouteMocks();

    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
      return {
        ...actual,
        Route: ({ path }: any) => <div data-testid="route" data-path={path}>{path}</div>,
        Routes: ({ children }: any) => <div data-testid="routes">{children}</div>
      };
    });

    vi.doMock('../components/layout', () => ({
      AppShell: ({ children }: any) => <section data-testid="app-shell">{children}</section>
    }));

    const { AppRouter } = await import('./index');
    const { appRoutes } = await import('./route-config');

    render(<AppRouter />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('routes')).toBeInTheDocument();

    const routeNodes = screen.getAllByTestId('route');
    expect(routeNodes).toHaveLength(appRoutes.length);
    expect(routeNodes.map((node) => node.getAttribute('data-path'))).toContain('/profile/detail');
    expect(routeNodes.map((node) => node.getAttribute('data-path'))).toContain('/orders/:id/snapshot');
  });
});
