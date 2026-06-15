import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HomePage } from './HomePage';
import { ProductDetailPage } from './ProductDetailPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  formInstance: {
    setFieldsValue: vi.fn(),
    validateFields: vi.fn(),
    resetFields: vi.fn()
  },
  fetchHomeRecommendations: vi.fn(),
  fetchOrders: vi.fn(),
  fetchCampusServiceOrders: vi.fn(),
  fetchProductDetail: vi.fn(),
  fetchUserTrustSummary: vi.fn(),
  fetchUserProfile: vi.fn(),
  createConversation: vi.fn(),
  createReport: vi.fn(),
  recordProductContact: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  subscribeFavorites: vi.fn(() => () => undefined),
  isFavorite: vi.fn(),
  toggleFavorite: vi.fn(),
  useAuthState: vi.fn(),
  hasTradingAccess: vi.fn(),
  isGuestUser: vi.fn(),
  executeToggleFollow: vi.fn(),
  loadFollowStateForTarget: vi.fn(),
  openReportForm: vi.fn(({ open }: any) => open()),
  submitReportForm: vi.fn(async ({ submit, onSuccess }: any) => {
    await submit('测试举报原因');
    onSuccess();
    return true;
  }),
  ensureTradingAccessOrNotify: vi.fn((_options: any) => true),
  useCurrentUserProfileBundle: vi.fn()
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      info: mocks.info,
      success: mocks.success,
      error: mocks.error
    },
    Form: {
      ...actual.Form,
      useForm: () => [mocks.formInstance]
    }
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: () => ({ id: '9' }),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>
  };
});

vi.mock('../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../services/api', () => ({
  fetchHomeRecommendations: mocks.fetchHomeRecommendations,
  fetchOrders: mocks.fetchOrders,
  fetchCampusServiceOrders: mocks.fetchCampusServiceOrders,
  fetchProductDetail: mocks.fetchProductDetail,
  fetchUserTrustSummary: mocks.fetchUserTrustSummary,
  fetchUserProfile: mocks.fetchUserProfile,
  createConversation: mocks.createConversation,
  createReport: mocks.createReport,
  recordProductContact: mocks.recordProductContact,
  getApiErrorMessage: mocks.getApiErrorMessage
}));

vi.mock('../services/favorites', () => ({
  subscribeFavorites: mocks.subscribeFavorites,
  isFavorite: (...args: any[]) => mocks.isFavorite(...args),
  toggleFavorite: (...args: any[]) => mocks.toggleFavorite(...args)
}));

vi.mock('../services/session', async () => {
  const actual = await vi.importActual<typeof import('../services/session')>('../services/session');
  return {
    ...actual,
    hasTradingAccess: (user: any) => mocks.hasTradingAccess(user),
    isGuestUser: (user: any) => mocks.isGuestUser(user)
  };
});

vi.mock('../services/user-profile', () => ({
  useCurrentUserProfileBundle: (user: any) => mocks.useCurrentUserProfileBundle(user)
}));

vi.mock('../utils/followActions', () => ({
  executeToggleFollow: (options: any) => mocks.executeToggleFollow(options)
}));

vi.mock('../utils/followState', () => ({
  loadFollowStateForTarget: (options: any) => mocks.loadFollowStateForTarget(options)
}));

vi.mock('../utils/reportForm', () => ({
  openReportForm: (options: any) => mocks.openReportForm(options),
  submitReportForm: (options: any) => mocks.submitReportForm(options)
}));

vi.mock('../utils/tradingAccess', () => ({
  ensureTradingAccessOrNotify: (options: any) => mocks.ensureTradingAccessOrNotify(options)
}));

vi.mock('../components/user/UserAvatar', () => ({
  UserAvatar: ({ alt, fallbackLabel }: any) => <span>{alt || fallbackLabel || 'avatar'}</span>
}));

vi.mock('../components/user/UserNameWithBadge', () => ({
  UserNameWithBadge: ({ as: Tag = 'span', name }: any) => <Tag>{name}</Tag>
}));

vi.mock('../components/ui', () => ({
  CreditBadge: ({ label }: any) => <span>{label}</span>,
  DetailContentBody: ({ title, description, expandButton }: any) => <div><h2>{title}</h2><p>{description}</p>{expandButton}</div>,
  DetailActionFooter: ({ actions, status, quietAction }: any) => <div>{actions}{status}{quietAction}</div>,
  DetailInfoPanel: ({ top, body, footer }: any) => <div>{top}{body}{footer}</div>,
  DetailMediaGallery: ({ title }: any) => <div>{title} 图库</div>,
  DetailInfoTopSummary: ({ stats, favoriteButton, amount }: any) => <div>{stats.join(' / ')}{favoriteButton}{amount}</div>,
  DetailSellerStrip: ({ name, followButton }: any) => <div><span>{name}</span>{followButton}</div>,
  ReportFormModal: ({ open, onSubmit, onCancel }: any) => open ? <div><button type="button" onClick={onSubmit}>提交举报</button><button type="button" onClick={onCancel}>关闭举报</button></div> : null
}));

vi.mock('../components/layout', () => ({
  DetailShell: ({ mainMedia, sidePanel }: any) => <div>{mainMedia}{sidePanel}</div>
}));

vi.mock('../components/product', () => ({
  ProductGrid: ({ items, renderItem, emptyState }: any) => (
    <div>{items.length ? items.map((item: any, index: number) => renderItem(item, index)) : emptyState}</div>
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
  EmptyState: ({ title, description, action }: any) => <div><span>{title}</span><span>{description}</span>{action}</div>
}));

describe('HomePage and ProductDetailPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.navigate.mockReset();
    mocks.subscribeFavorites.mockReturnValue(() => undefined);
    mocks.getApiErrorMessage.mockImplementation((_error, fallback) => fallback);
    mocks.useCurrentUserProfileBundle.mockReturnValue({
      presentation: {
        avatarUrl: '/avatar.png',
        initial: 'U',
        avatarFrame: null,
        trustedBadgeUnlocked: true,
        creditBadge: { tone: 'green', label: '优秀' }
      }
    });
    mocks.loadFollowStateForTarget.mockImplementation(async ({ apply }: any) => apply(false));
    vi.spyOn(window, 'setInterval').mockImplementation(((handler: any) => {
      handler();
      return 1;
    }) as any);
    vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders guest home page and routes login and campaign actions', async () => {
    mocks.useAuthState.mockReturnValue({ currentUser: { id: 1, displayName: '游客', role: 'GUEST' } });
    mocks.fetchHomeRecommendations.mockResolvedValue([
      {
        id: 1,
        title: '毕业教材',
        description: '毕业季清仓',
        price: 30,
        category: '教材资料',
        condition: '九成新',
        tags: ['毕业', '教材'],
        status: 'ON_SALE',
        sellerName: '卖家A',
        wantCount: 2
      }
    ]);
    mocks.fetchOrders.mockResolvedValue({ items: [] });
    mocks.fetchCampusServiceOrders.mockResolvedValue({ items: [] });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(await screen.findByText('登录后查看收藏、订单、发布')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '立即登录' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/login', { state: { from: '/', mode: 'login' } });

    await user.click(screen.getByRole('button', { name: /毕业教材/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/products/1');

    await user.click(screen.getByRole('button', { name: '下一张活动图' }));
    expect(screen.getByText('立即登录')).toBeInTheDocument();
  });

  it('renders user home page and supports search, category and order navigation', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 9, displayName: '用户A', email: 'user@example.com', role: 'USER' }
    });
    mocks.fetchHomeRecommendations.mockResolvedValue([
      {
        id: 2,
        title: '高数教材',
        description: '图书馆自提',
        price: 18,
        category: '教材资料',
        condition: '九成新',
        tags: ['教材', '高数'],
        status: 'ON_SALE',
        sellerName: '卖家B',
        wantCount: 3
      }
    ]);
    mocks.fetchOrders.mockResolvedValue({
      items: [
        {
          id: 18,
          buyerId: 9,
          sellerId: 12,
          status: 'IN_PROGRESS',
          meetupLocation: '图书馆',
          productTitle: '高数教材',
          productImageUrl: '/book.png',
          sellerName: '卖家B',
          buyerName: '用户A'
        }
      ]
    });
    mocks.fetchCampusServiceOrders.mockResolvedValue({ items: [] });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await screen.findAllByText('高数教材');
    await user.type(screen.getByPlaceholderText('搜索手机、电脑、教材、卡券'), '教材');
    await user.click(screen.getByRole('button', { name: '搜索' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/search?q=%E6%95%99%E6%9D%90');

    await user.click(screen.getByRole('button', { name: /高数教材.*图书馆/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/profile', {
      state: {
        section: 'orders',
        orderScope: 'buying'
      }
    });

    await user.hover(screen.getByRole('button', { name: '教材资料' }));
    expect(await screen.findByRole('button', { name: '高数' })).toBeInTheDocument();
  });

  it('prefers active campus service hints when current user has service orders', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 9, displayName: '用户A', email: 'user@example.com', role: 'USER' }
    });
    mocks.fetchHomeRecommendations.mockResolvedValue([
      {
        id: 2,
        title: '高数教材',
        description: '图书馆自提',
        price: 18,
        category: '教材资料',
        condition: '九成新',
        tags: ['教材', '高数'],
        status: 'ON_SALE',
        sellerName: '卖家B',
        wantCount: 3
      }
    ]);
    mocks.fetchOrders.mockResolvedValue({
      items: [
        {
          id: 18,
          buyerId: 9,
          sellerId: 12,
          status: 'COMPLETED',
          meetupLocation: '图书馆',
          productTitle: '高数教材',
          productImageUrl: '/book.png',
          sellerName: '卖家B',
          buyerName: '用户A',
          createdAt: '2026-06-01T08:00:00.000Z'
        }
      ]
    });
    mocks.fetchCampusServiceOrders.mockResolvedValue({
      items: [
        {
          id: 32,
          listingId: 8,
          title: '代取快递',
          description: '南门驿站到宿舍',
          price: 8,
          reward: 8,
          rewardLabel: '¥8.00',
          tags: [],
          status: 'WAITING_COMPLETE_CONFIRM',
          statusLabel: '待完成确认',
          orderStatus: 'WAITING_COMPLETE_CONFIRM',
          orderStatusLabel: '待完成确认',
          listingStatus: 'BUSY',
          listingStatusLabel: '进行中',
          intent: 'OFFER',
          intentLabel: '可预约',
          category: 'ERRAND',
          categoryLabel: '跑腿',
          route: {
            from: '南门驿站',
            to: '13号公寓',
            label: '南门驿站 -> 13号公寓'
          },
          deadlineLabel: '今晚 20:00 前',
          estimatedMinutes: 30,
          role: 'REQUESTER',
          roleLabel: '预约方',
          summaryTags: [],
          actionState: {
            canComplete: false,
            canCancel: false,
            canOpenConversation: true,
            canConfirm: false,
            canReject: false
          },
          actionLabels: {
            confirm: null,
            reject: null,
            complete: null,
            cancel: null,
            conversation: '联系对方'
          },
          conversationId: 99,
          counterpart: {
            id: 12,
            displayName: '艺同学',
            college: '信息学院',
            averageRating: 4.8,
            completedOrders: 3,
            creditScore: 88,
            verificationStatus: 'APPROVED',
            accountStatus: 'ACTIVE',
            trustedBadgeUnlocked: true
          },
          publisher: {
            id: 12,
            displayName: '艺同学',
            college: '信息学院',
            averageRating: 4.8,
            completedOrders: 3,
            creditScore: 88,
            verificationStatus: 'APPROVED',
            accountStatus: 'ACTIVE',
            trustedBadgeUnlocked: true
          },
          createdAt: '2026-06-16T08:00:00.000Z',
          updatedAt: '2026-06-16T09:00:00.000Z'
        }
      ]
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('tab', { name: /我预约的服务.*1/ })).toBeInTheDocument();
    expect(screen.getByText('待完成确认')).toBeInTheDocument();
    expect(screen.getByText('代取快递')).toBeInTheDocument();
    expect(screen.getByText('对方 艺同学')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /代取快递/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/profile', {
      state: {
        section: 'orders',
        orderScope: 'booking'
      }
    });
  });

  it('allows switching to an empty tab without forcing the populated side back', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 9, displayName: '用户A', email: 'user@example.com', role: 'USER' }
    });
    mocks.fetchHomeRecommendations.mockResolvedValue([
      {
        id: 2,
        title: '高数教材',
        description: '图书馆自提',
        price: 18,
        category: '教材资料',
        condition: '九成新',
        tags: ['教材', '高数'],
        status: 'ON_SALE',
        sellerName: '卖家B',
        wantCount: 3
      }
    ]);
    mocks.fetchOrders.mockResolvedValue({ items: [] });
    mocks.fetchCampusServiceOrders.mockResolvedValue({
      items: [
        {
          id: 32,
          listingId: 8,
          title: '代取快递',
          description: '南门驿站到宿舍',
          price: 8,
          reward: 8,
          rewardLabel: '¥8.00',
          tags: [],
          status: 'CONFIRMED',
          statusLabel: '进行中',
          orderStatus: 'CONFIRMED',
          orderStatusLabel: '进行中',
          listingStatus: 'BUSY',
          listingStatusLabel: '进行中',
          intent: 'REQUEST',
          intentLabel: '求助',
          category: 'ERRAND',
          categoryLabel: '跑腿',
          route: {
            from: '南门驿站',
            to: '13号公寓',
            label: '南门驿站 -> 13号公寓'
          },
          deadlineLabel: '今晚 20:00 前',
          estimatedMinutes: 30,
          role: 'PROVIDER',
          roleLabel: '接单方',
          summaryTags: [],
          actionState: {
            canComplete: true,
            canCancel: false,
            canOpenConversation: true,
            canConfirm: false,
            canReject: false
          },
          actionLabels: {
            confirm: null,
            reject: null,
            complete: '提交进度',
            cancel: null,
            conversation: '联系对方'
          },
          conversationId: 99,
          counterpart: {
            id: 15,
            displayName: '林同学',
            college: '信息学院',
            averageRating: 4.8,
            completedOrders: 3,
            creditScore: 88,
            verificationStatus: 'APPROVED',
            accountStatus: 'ACTIVE',
            trustedBadgeUnlocked: true
          },
          publisher: {
            id: 15,
            displayName: '林同学',
            college: '信息学院',
            averageRating: 4.8,
            completedOrders: 3,
            creditScore: 88,
            verificationStatus: 'APPROVED',
            accountStatus: 'ACTIVE',
            trustedBadgeUnlocked: true
          },
          createdAt: '2026-06-16T08:00:00.000Z',
          updatedAt: '2026-06-16T09:00:00.000Z'
        }
      ]
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('tab', { name: /我接的单.*1/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: /我预约的服务.*0/ }));
    expect(screen.getByRole('tab', { name: /我预约的服务.*0/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('暂无预约服务')).toBeInTheDocument();
  });

  it('renders product detail interactions and action flows', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 9, displayName: '买家', email: 'buyer@example.com', role: 'USER', verificationStatus: 'APPROVED' },
      clearCurrentUser: vi.fn()
    });
    mocks.isFavorite.mockReturnValue(false);
    mocks.toggleFavorite.mockResolvedValue(true);
    mocks.fetchProductDetail.mockResolvedValue({
      id: 9,
      title: '二手键盘',
      description: '这是一个很长很长的商品描述，用于覆盖详情页的展开逻辑。'.repeat(4),
      price: 66,
      category: '数码电子',
      condition: '九成新',
      tags: ['键盘', '桌搭'],
      status: 'ON_SALE',
      sellerName: '卖家A',
      detailBase: {
        title: '二手键盘',
        description: '这是一个很长很长的商品描述，用于覆盖详情页的展开逻辑。'.repeat(4),
        price: 66,
        tradeState: null
      },
      seller: {
        id: 21,
        displayName: '卖家A',
        avatarUrl: null,
        avatarFrame: null,
        completedOrders: 5,
        averageRating: 4.8,
        college: '信息学院',
        creditScore: 88,
        verificationStatus: 'APPROVED'
      },
      stats: { wantCount: 3, favoriteCount: 5, viewCount: 20 },
      actionState: {
        canEdit: false
      },
      relatedProducts: [{ id: 12, title: '鼠标', description: 'desc', price: 20, tags: [], status: 'ON_SALE' }],
      images: ['/a.png']
    });
    mocks.createConversation.mockResolvedValue({ id: 77 });
    mocks.recordProductContact.mockResolvedValue({ productId: 9, recorded: true });
    mocks.fetchUserTrustSummary.mockResolvedValue({ isFollowing: false });
    mocks.executeToggleFollow.mockImplementation(async ({ onSuccess, notifySuccess }: any) => {
      onSuccess({ isFollowing: true });
      notifySuccess('已关注卖家');
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/products/9']}>
        <Routes>
          <Route path="/products/:id" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('卖家A')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '关注' }));
    await waitFor(() => {
      expect(mocks.executeToggleFollow).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('button', { name: '收藏商品' }));
    await waitFor(() => {
      expect(mocks.toggleFavorite).toHaveBeenCalledWith(9, expect.objectContaining({ id: 9 }));
    });

    await user.click(screen.getByRole('button', { name: '展开' }));
    expect(screen.getByText(/这是一个很长很长的商品描述/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '聊一聊' }));
    await waitFor(() => {
      expect(mocks.recordProductContact).toHaveBeenCalledWith(9);
      expect(mocks.createConversation).toHaveBeenCalledWith({ productId: 9 });
    });
    expect(mocks.navigate).toHaveBeenCalledWith('/messages', {
      state: {
        conversationId: 77,
        channel: 'trade'
      }
    });

    await user.click(screen.getByRole('button', { name: '立即下单' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/orders/checkout?type=product&productId=9');

    await user.click(screen.getByRole('button', { name: '举报' }));
    expect(mocks.openReportForm).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '提交举报' }));
    await waitFor(() => {
      expect(mocks.submitReportForm).toHaveBeenCalled();
    });
    expect(mocks.createReport).toHaveBeenCalledWith({
      productId: 9,
      reason: expect.any(String)
    });

    expect(screen.getByRole('link', { name: /鼠标/ })).toHaveAttribute('href', '/products/12');
  });

  it('shows seller-side controls on own product detail', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 21, displayName: '卖家A', email: 'seller@example.com', role: 'USER', verificationStatus: 'APPROVED' },
      clearCurrentUser: vi.fn()
    });
    mocks.isFavorite.mockReturnValue(false);
    mocks.fetchProductDetail.mockResolvedValue({
      id: 9,
      title: '二手键盘',
      description: '卖家自己的商品',
      price: 66,
      category: '数码电子',
      condition: '九成新',
      tags: ['键盘'],
      status: 'ON_SALE',
      sellerName: '卖家A',
      detailBase: {
        title: '二手键盘',
        description: '卖家自己的商品',
        price: 66,
        tradeState: null
      },
      seller: {
        id: 21,
        displayName: '卖家A',
        avatarUrl: null,
        avatarFrame: null,
        completedOrders: 5,
        averageRating: 4.8,
        college: '信息学院',
        creditScore: 88,
        verificationStatus: 'APPROVED'
      },
      stats: { wantCount: 3, favoriteCount: 5, viewCount: 20 },
      actionState: {
        canEdit: true
      },
      relatedProducts: [],
      images: ['/a.png']
    });

    render(
      <MemoryRouter initialEntries={['/products/9']}>
        <Routes>
          <Route path="/products/:id" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('卖家A')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '收藏商品' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '聊一聊' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '立即下单' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /编\s*辑/ })).toBeInTheDocument();
  });
});
