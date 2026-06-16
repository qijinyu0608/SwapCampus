import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { TopBar } from './TopBar';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  navigate: vi.fn(),
  logoutUser: vi.fn(),
  clearCurrentUser: vi.fn(),
  useAuthState: vi.fn(),
  hasAdminAccess: vi.fn(),
  hasTradingAccess: vi.fn()
}));

vi.mock('@ant-design/icons', () => ({
  CustomerServiceOutlined: () => <span>CAMPUS_ICON</span>,
  HomeOutlined: () => <span>HOME_ICON</span>,
  LoginOutlined: () => <span>LOGIN_ICON</span>,
  LogoutOutlined: () => <span>LOGOUT_ICON</span>,
  MessageOutlined: () => <span>MESSAGE_ICON</span>,
  PlusCircleOutlined: () => <span>PLUS_ICON</span>,
  SafetyCertificateOutlined: () => <span>ADMIN_ICON</span>,
  UserOutlined: () => <span>USER_ICON</span>
}));

vi.mock('antd', () => {
  const Layout = ({ children, className }: any) => <div data-testid="layout" className={className}>{children}</div>;
  Layout.Header = ({ children, className }: any) => <header data-testid="layout-header" className={className}>{children}</header>;
  Layout.Content = ({ children, className }: any) => <main data-testid="layout-content" className={className}>{children}</main>;

  return {
    Layout,
    Tooltip: ({ children }: any) => <>{children}</>
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Link: ({ to, className, children, ...props }: any) => (
      <a href={to} className={className} {...props}>
        {children}
      </a>
    ),
    useLocation: () => ({ pathname: mocks.pathname }),
    useNavigate: () => mocks.navigate
  };
});

vi.mock('../../services/api', () => ({
  logoutUser: () => mocks.logoutUser()
}));

vi.mock('../../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../../services/session', () => ({
  hasAdminAccess: (user: unknown) => mocks.hasAdminAccess(user),
  hasTradingAccess: (user: unknown) => mocks.hasTradingAccess(user)
}));

describe('layout shell components', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.pathname = '/';
    mocks.logoutUser.mockResolvedValue(undefined);
    mocks.useAuthState.mockReturnValue({
      currentUser: null,
      clearCurrentUser: mocks.clearCurrentUser
    });
    mocks.hasAdminAccess.mockReturnValue(false);
    mocks.hasTradingAccess.mockReturnValue(false);
  });

  it('renders guest top bar navigation and updates the logo highlight hotspot', () => {
    mocks.pathname = '/login';

    const { container } = render(<TopBar currentUser={null} />);

    expect(screen.getByRole('link', { name: '首页' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '登录 / 注册' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: '登录 / 注册' })).toHaveClass('topbar-nav-button', 'active');
    expect(screen.queryByRole('link', { name: '校园服务' })).toBeNull();
    expect(screen.queryByRole('button', { name: '退出登录' })).toBeNull();

    const logoZone = container.querySelector('.topbar-logo-zone') as HTMLDivElement | null;
    const logoSpot = container.querySelector('.topbar-logo-mask-spot') as SVGCircleElement | null;
    if (!logoZone || !logoSpot) {
      throw new Error('topbar logo elements not found');
    }

    vi.spyOn(logoZone, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 100,
      height: 50,
      right: 100,
      bottom: 50,
      toJSON: () => ({})
    } as DOMRect);

    fireEvent.mouseMove(logoZone, { clientX: 50, clientY: 25 });

    expect(logoSpot.getAttribute('cx')).toBe('328.00');
    expect(logoSpot.getAttribute('cy')).toBe('84.50');
  });

  it('renders user navigation, marks active items and logs out successfully', async () => {
    const user = userEvent.setup();
    const currentUser = { id: 7, role: 'USER', displayName: '张同学' } as any;

    mocks.pathname = '/favorites';
    mocks.hasTradingAccess.mockReturnValue(true);

    render(<TopBar currentUser={currentUser} />);

    expect(screen.getByRole('link', { name: '首页' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '校园服务' })).toHaveAttribute('href', '/campus-services');
    expect(screen.getByRole('link', { name: '发布内容' })).toHaveAttribute('href', '/publish');
    expect(screen.getByRole('link', { name: '消息' })).toHaveAttribute('href', '/messages');
    expect(screen.getByRole('link', { name: '我的' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('link', { name: '我的' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '退出登录' }));

    await waitFor(() => {
      expect(mocks.logoutUser).toHaveBeenCalledTimes(1);
      expect(mocks.clearCurrentUser).toHaveBeenCalledTimes(1);
      expect(mocks.navigate).toHaveBeenCalledWith('/');
    });
  });

  it('renders admin navigation and still clears session state when logout fails', async () => {
    const user = userEvent.setup();
    const currentUser = { id: 1, role: 'ADMIN', displayName: '管理员' } as any;

    mocks.pathname = '/admin/reports';
    mocks.hasAdminAccess.mockReturnValue(true);
    mocks.hasTradingAccess.mockReturnValue(false);
    mocks.logoutUser.mockRejectedValue(new Error('network failed'));

    render(<TopBar currentUser={currentUser} />);

    expect(screen.queryByRole('link', { name: '首页' })).toBeNull();
    expect(screen.getByRole('link', { name: '后台' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: '后台' })).toHaveClass('active');

    await user.click(screen.getByRole('button', { name: '退出登录' }));

    await waitFor(() => {
      expect(mocks.logoutUser).toHaveBeenCalledTimes(1);
      expect(mocks.clearCurrentUser).toHaveBeenCalledTimes(1);
      expect(mocks.navigate).toHaveBeenCalledWith('/');
    });
  });

  it('renders the app shell around children using the current auth state', () => {
    const currentUser = { id: 9, role: 'USER', displayName: '李同学' } as any;
    mocks.useAuthState.mockReturnValue({
      currentUser,
      clearCurrentUser: mocks.clearCurrentUser
    });
    mocks.hasTradingAccess.mockReturnValue(true);

    render(
      <AppShell>
        <div>page body</div>
      </AppShell>
    );

    expect(screen.getByTestId('layout')).toHaveClass('app-shell');
    expect(screen.getByTestId('layout-header')).toHaveClass('app-header');
    expect(screen.getByTestId('layout-content')).toHaveClass('app-content');
    expect(screen.getByText('page body')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument();
  });
});
