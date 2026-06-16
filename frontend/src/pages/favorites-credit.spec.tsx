import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FavoritesPage } from './FavoritesPage';
import { CreditCenterPage } from './CreditCenterPage';

const navigate = vi.fn();

const mocks = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
  loadFavorites: vi.fn(),
  getFavoriteIds: vi.fn(),
  subscribeFavorites: vi.fn(() => () => undefined),
  toggleFavorite: vi.fn(),
  fetchCreditCenterSummary: vi.fn(),
  fetchCreditCenterMissions: vi.fn(),
  fetchCreditCenterLedger: vi.fn(),
  fetchCreditCenterRewards: vi.fn(),
  checkInCreditCenter: vi.fn(),
  claimCreditMission: vi.fn(),
  redeemCreditReward: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  hasTradingAccess: vi.fn(),
  useAuthState: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate
  };
});

vi.mock('../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../services/api', () => ({
  fetchProducts: mocks.fetchProducts,
  fetchCreditCenterSummary: mocks.fetchCreditCenterSummary,
  fetchCreditCenterMissions: mocks.fetchCreditCenterMissions,
  fetchCreditCenterLedger: mocks.fetchCreditCenterLedger,
  fetchCreditCenterRewards: mocks.fetchCreditCenterRewards,
  checkInCreditCenter: mocks.checkInCreditCenter,
  claimCreditMission: mocks.claimCreditMission,
  redeemCreditReward: mocks.redeemCreditReward,
  getApiErrorMessage: mocks.getApiErrorMessage
}));

vi.mock('../services/favorites', () => ({
  getFavoriteIds: mocks.getFavoriteIds,
  loadFavorites: mocks.loadFavorites,
  subscribeFavorites: mocks.subscribeFavorites,
  toggleFavorite: mocks.toggleFavorite
}));

vi.mock('../services/session', async () => {
  const actual = await vi.importActual<typeof import('../services/session')>('../services/session');
  return {
    ...actual,
    hasTradingAccess: (user: any) => mocks.hasTradingAccess(user)
  };
});

vi.mock('../components/disclosure', () => ({
  FoldSection: ({ title, children }: any) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  )
}));

vi.mock('../components/data-display', () => ({
  StatStrip: ({ items }: any) => (
    <div>
      {items.map((item: any) => <span key={item.key}>{item.label}:{String(item.value)}</span>)}
    </div>
  )
}));

vi.mock('../components/layout', () => ({
  PageHeader: ({ title, subtitle, meta }: any) => <div><h1>{title}</h1><span>{subtitle}</span>{meta}</div>,
  SectionHeader: ({ title, description }: any) => <div><h2>{title}</h2><span>{description}</span></div>
}));

vi.mock('../components/product', () => ({
  ProductGrid: ({ items, renderItem, emptyState }: any) => (
    <div>
      {items.length ? items.map((item: any, index: number) => renderItem(item, index)) : emptyState}
    </div>
  ),
  ProductSummaryCard: ({ item, onOpen, priceMeta, tagItems }: any) => (
    <button type="button" onClick={onOpen}>
      <span>{item.title}</span>
      <span>{priceMeta}</span>
      <span>{tagItems?.join?.(' / ')}</span>
    </button>
  )
}));

vi.mock('../components/feedback', () => ({
  EmptyState: ({ title, action }: any) => <div><span>{title}</span>{action}</div>
}));

vi.mock('../components/user/UserAvatar', () => ({
  UserAvatar: ({ fallbackLabel }: any) => <span>{fallbackLabel || 'avatar'}</span>
}));

describe('favorites and credit center pages', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    navigate.mockReset();
    mocks.subscribeFavorites.mockReturnValue(() => undefined);
    mocks.getApiErrorMessage.mockImplementation((_error, fallback) => fallback);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders favorites for user accounts and clears inactive favorites', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 1, displayName: '用户', email: 'user@example.com', role: 'USER' }
    });
    mocks.getFavoriteIds.mockReturnValue([1, 2]);
    mocks.loadFavorites.mockResolvedValue({
      items: [
        {
          id: 1,
          title: '在售商品',
          description: 'ok',
          price: 88,
          category: '数码电子',
          condition: '九成新',
          tags: ['数码'],
          status: 'ON_SALE',
          sellerName: '卖家A',
          favoriteCount: 3,
          favoritedAt: '2026-06-15T00:00:00Z'
        },
        {
          id: 2,
          title: '失效商品',
          description: 'off',
          price: 20,
          category: '教材资料',
          condition: '八成新',
          tags: ['教材'],
          status: 'OFFLINE',
          sellerName: '卖家B',
          favoriteCount: 1,
          favoritedAt: null
        }
      ]
    });
    mocks.toggleFavorite.mockResolvedValue(false);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FavoritesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('在售商品')).toBeInTheDocument();
    expect(screen.getByText('失效商品')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1 件失效' }));
    expect(screen.getByText('失效商品')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清理失效收藏' }));
    await waitFor(() => {
      expect(mocks.toggleFavorite).toHaveBeenCalledWith(2, expect.objectContaining({ id: 1 }));
    });
  });

  it('renders guest favorites empty state and supports fallback product loading', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 99, displayName: '游客', email: 'guest@example.com', role: 'GUEST' }
    });
    mocks.getFavoriteIds.mockReturnValue([]);
    mocks.fetchProducts.mockResolvedValue({ items: [] });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FavoritesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('还没有收藏的商品')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '去逛逛' }));
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('renders credit center data and handles tab actions', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 7, displayName: '普通用户', email: 'user@example.com', role: 'USER' }
    });
    mocks.hasTradingAccess.mockReturnValue(true);
    mocks.fetchCreditCenterSummary.mockResolvedValue({
      id: 7,
      userId: 7,
      creditScore: 92,
      creditLevel: '优秀',
      verificationStatus: 'APPROVED',
      availablePoints: 120,
      totalEarnedPoints: 300,
      totalSpentPoints: 180,
      signInStreak: 6,
      checkedInToday: false,
      nextCheckInBasePoints: 5,
      nextCheckInBonusPoints: 2
    });
    mocks.fetchCreditCenterMissions.mockResolvedValue({
      items: [
        {
          code: 'DAILY_SIGNIN',
          title: '每日签到',
          description: '签到得积分',
          cycleType: 'daily',
          rewardPoints: 7,
          creditScoreDelta: 1,
          progressCurrent: 0,
          progressTarget: 1,
          completed: false,
          claimed: false
        },
        {
          code: 'POST_PRODUCT',
          title: '发布商品',
          description: '发布一个商品',
          cycleType: 'once',
          rewardPoints: 20,
          creditScoreDelta: 2,
          progressCurrent: 1,
          progressTarget: 1,
          completed: true,
          claimed: false
        }
      ]
    });
    mocks.fetchCreditCenterLedger.mockResolvedValue({
      items: [
        {
          id: 1,
          sourceType: 'SIGNIN',
          sourceId: '2026-06-15',
          pointsDelta: 7,
          balanceAfter: 120,
          remark: '签到奖励',
          createdAt: '2026-06-15T08:00:00Z'
        }
      ]
    });
    mocks.fetchCreditCenterRewards.mockResolvedValue({
      items: [
        {
          code: 'PROFILE_FRAME_BLUE',
          title: '蓝色头像框',
          description: '限时激活',
          pointsCost: 50,
          minCreditScore: 70,
          canRedeem: true,
          redeemed: false
        }
      ]
    });
    mocks.checkInCreditCenter.mockResolvedValue({ rewardPoints: 7 });
    mocks.claimCreditMission.mockResolvedValue({ rewardPoints: 20 });
    mocks.redeemCreditReward.mockResolvedValue({ pointsCost: 50 });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CreditCenterPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('信用分')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('每日签到')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '领取 20 积分' }));
    await waitFor(() => {
      expect(mocks.claimCreditMission).toHaveBeenCalledWith('POST_PRODUCT');
    });

    await user.click(screen.getByRole('button', { name: '去签到' }));
    await user.click(screen.getByRole('button', { name: /签到/ }));
    await waitFor(() => {
      expect(mocks.checkInCreditCenter).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('tab', { name: /积分兑换/ }));
    await user.click(screen.getByRole('button', { name: '50 积分兑换' }));
    await waitFor(() => {
      expect(mocks.redeemCreditReward).toHaveBeenCalledWith('PROFILE_FRAME_BLUE');
    });

    await user.click(screen.getByRole('button', { name: '返回个人中心' }));
    expect(navigate).toHaveBeenCalledWith('/profile');
  });

  it('shows credit center access restriction for unsupported accounts', () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 8, displayName: '游客', email: 'guest@example.com', role: 'GUEST' }
    });
    mocks.hasTradingAccess.mockReturnValue(false);

    render(
      <MemoryRouter>
        <CreditCenterPage />
      </MemoryRouter>
    );

    expect(screen.getByText('请使用普通用户账号查看信用中心')).toBeInTheDocument();
  });
});
