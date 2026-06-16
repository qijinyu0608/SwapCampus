import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProfileDetailPage } from './ProfileDetailPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAuthState: vi.fn(),
  useCurrentUserProfileBundle: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate
  };
});

vi.mock('../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../services/user-profile', () => ({
  useCurrentUserProfileBundle: (user: any) => mocks.useCurrentUserProfileBundle(user)
}));

describe('ProfileDetailPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.useAuthState.mockReturnValue({
      currentUser: {
        id: 7,
        displayName: '张同学',
        email: 'zhang@example.com',
        role: 'USER',
        verificationStatus: 'APPROVED',
        avatarUrl: null,
        avatarFrame: null,
        avatarFrameUnlocked: false,
        trustedBadgeUnlocked: true,
        creditScore: 96,
        accountStatus: 'ACTIVE'
      }
    });
    mocks.useCurrentUserProfileBundle.mockReturnValue({
      profile: {
        id: 7,
        displayName: '张同学',
        email: 'zhang@example.com',
        studentId: '202600007',
        realName: '张三',
        college: '信息学院',
        phone: '13800138000',
        role: 'USER'
      },
      trustSummary: null,
      presentation: {
        displayName: '张同学',
        initial: '张',
        avatarUrl: null,
        avatarFrame: null,
        trustedBadgeUnlocked: true,
        collegeLabel: '信息学院',
        emailLabel: 'zhang@example.com',
        creditScore: 96,
        creditBadge: { tone: 'excellent', label: '信用优秀', score: 96 },
        verificationLabel: '已实名',
        publicIdentityLabel: '实名认证'
      },
      loading: false,
      errorMessage: ''
    });
  });

  it('renders profile details and navigates back to profile page', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ProfileDetailPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '张同学' })).toBeInTheDocument();
    expect(screen.getByText('zhang@example.com')).toBeInTheDocument();
    expect(screen.getByText('202600007')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('信息学院')).toBeInTheDocument();
    expect(screen.getByText('13800138000')).toBeInTheDocument();
    expect(screen.getAllByText('已实名').length).toBeGreaterThan(0);
    expect(screen.getAllByText('信用优秀').length).toBeGreaterThan(0);
    expect(screen.getByText('普通用户')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /返回我的闲置/ }));
    await user.click(screen.getByRole('button', { name: '编辑资料' }));

    expect(mocks.navigate).toHaveBeenNthCalledWith(1, '/profile');
    expect(mocks.navigate).toHaveBeenNthCalledWith(2, '/profile');
  });

  it('shows guest empty state when trading access is unavailable', () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 1, displayName: '游客', role: 'GUEST' }
    });

    render(
      <MemoryRouter>
        <ProfileDetailPage />
      </MemoryRouter>
    );

    expect(screen.getByText('游客模式下暂不支持个人资料详情')).toBeInTheDocument();
  });

  it('shows loading skeleton while profile bundle is loading', () => {
    mocks.useCurrentUserProfileBundle.mockReturnValue({
      profile: null,
      trustSummary: null,
      presentation: {
        displayName: '张同学',
        initial: '张',
        avatarUrl: null,
        avatarFrame: null,
        trustedBadgeUnlocked: false,
        collegeLabel: '信息学院',
        emailLabel: 'zhang@example.com',
        creditScore: 96,
        creditBadge: { tone: 'excellent', label: '信用优秀', score: 96 },
        verificationLabel: '已实名',
        publicIdentityLabel: '实名认证'
      },
      loading: true,
      errorMessage: ''
    });

    const { container } = render(
      <MemoryRouter>
        <ProfileDetailPage />
      </MemoryRouter>
    );

    expect(container.querySelector('.ant-skeleton')).toBeTruthy();
  });

  it('shows error empty state when profile data is unavailable', () => {
    mocks.useCurrentUserProfileBundle.mockReturnValue({
      profile: null,
      trustSummary: null,
      presentation: {
        displayName: '张同学',
        initial: '张',
        avatarUrl: null,
        avatarFrame: null,
        trustedBadgeUnlocked: false,
        collegeLabel: '信息学院',
        emailLabel: 'zhang@example.com',
        creditScore: 96,
        creditBadge: { tone: 'excellent', label: '信用优秀', score: 96 },
        verificationLabel: '已实名',
        publicIdentityLabel: '实名认证'
      },
      loading: false,
      errorMessage: '个人资料加载失败'
    });

    render(
      <MemoryRouter>
        <ProfileDetailPage />
      </MemoryRouter>
    );

    expect(screen.getByText('个人资料加载失败')).toBeInTheDocument();
  });
});
