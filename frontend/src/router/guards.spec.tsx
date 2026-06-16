import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAdmin, RequireUser } from './guards';

const mocks = vi.hoisted(() => ({
  currentUser: null as any,
  hydrated: true,
  pathname: '/favorites',
  hasTradingAccess: vi.fn(),
  hasAdminAccess: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to, replace, state }: any) => (
      <div
        data-testid="navigate"
        data-to={to}
        data-replace={String(Boolean(replace))}
        data-state={JSON.stringify(state)}
      />
    ),
    useLocation: () => ({ pathname: mocks.pathname })
  };
});

vi.mock('../components/feedback', () => ({
  EmptyState: ({ title, className }: any) => <div data-testid="empty-state" data-class-name={className}>{title}</div>
}));

vi.mock('../services/auth-state', () => ({
  useAuthState: () => ({
    currentUser: mocks.currentUser,
    hydrated: mocks.hydrated
  })
}));

vi.mock('../services/session', () => ({
  hasTradingAccess: (user: any) => mocks.hasTradingAccess(user),
  hasAdminAccess: (user: any) => mocks.hasAdminAccess(user)
}));

describe('route guards', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.currentUser = { id: 1, role: 'USER' };
    mocks.hydrated = true;
    mocks.pathname = '/favorites';
    mocks.hasTradingAccess.mockReturnValue(true);
    mocks.hasAdminAccess.mockReturnValue(false);
  });

  it('renders nothing until auth state is hydrated', () => {
    mocks.hydrated = false;

    const { container } = render(
      <RequireUser>
        <div>user-page</div>
      </RequireUser>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('redirects guests away from user routes', () => {
    mocks.hasTradingAccess.mockReturnValue(false);

    render(
      <RequireUser>
        <div>user-page</div>
      </RequireUser>
    );

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-replace', 'true');
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-state', JSON.stringify({ from: '/favorites' }));
  });

  it('renders user routes for accounts with trading access', () => {
    render(
      <RequireUser>
        <div>user-page</div>
      </RequireUser>
    );

    expect(screen.getByText('user-page')).toBeInTheDocument();
  });

  it('redirects unauthenticated visitors from admin routes', () => {
    mocks.currentUser = null;

    render(
      <RequireAdmin>
        <div>admin-page</div>
      </RequireAdmin>
    );

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-state', JSON.stringify({ from: '/admin' }));
  });

  it('shows an empty state when the account lacks admin access', () => {
    mocks.currentUser = { id: 9, role: 'USER' };
    mocks.hasAdminAccess.mockReturnValue(false);

    render(
      <RequireAdmin>
        <div>admin-page</div>
      </RequireAdmin>
    );

    expect(screen.getByTestId('empty-state')).toHaveAttribute('data-class-name', 'is-shell');
    expect(screen.getByText('当前账号没有后台权限')).toBeInTheDocument();
  });

  it('renders admin routes for privileged accounts', () => {
    mocks.currentUser = { id: 7, role: 'ADMIN' };
    mocks.hasAdminAccess.mockReturnValue(true);

    render(
      <RequireAdmin>
        <div>admin-page</div>
      </RequireAdmin>
    );

    expect(screen.getByText('admin-page')).toBeInTheDocument();
  });
});
