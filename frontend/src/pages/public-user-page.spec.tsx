import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PublicUserPage } from './PublicUserPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  fetchUserTrustSummary: vi.fn(),
  fetchProducts: vi.fn(),
  fetchCampusServiceListings: vi.fn(),
  fetchUserReceivedReviews: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  useAuthState: vi.fn(),
  executeToggleFollow: vi.fn(),
  ensureTradingAccessOrNotify: vi.fn(() => true)
}));

let mockedUserId = '95';

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      success: mocks.success,
      error: mocks.error
    }
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: () => ({ id: mockedUserId })
  };
});

vi.mock('../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../services/api', () => ({
  fetchUserTrustSummary: (id: number) => mocks.fetchUserTrustSummary(id),
  fetchProducts: (params?: unknown) => mocks.fetchProducts(params),
  fetchCampusServiceListings: (params?: unknown) => mocks.fetchCampusServiceListings(params),
  fetchUserReceivedReviews: (id: number) => mocks.fetchUserReceivedReviews(id),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback)
}));

vi.mock('../utils/followActions', () => ({
  executeToggleFollow: (options: any) => mocks.executeToggleFollow(options)
}));

vi.mock('../utils/tradingAccess', () => ({
  ensureTradingAccessOrNotify: () => mocks.ensureTradingAccessOrNotify()
}));

vi.mock('../components/user/UserAvatar', () => ({
  UserAvatar: ({ alt, fallbackLabel }: any) => <span>{alt || fallbackLabel || 'avatar'}</span>
}));

vi.mock('../components/user/UserNameWithBadge', () => ({
  UserNameWithBadge: ({ as: Tag = 'span', name }: any) => <Tag>{name}</Tag>
}));

vi.mock('../components/ui', () => ({
  CreditBadge: ({ label }: any) => <span>{label}</span>,
  SectionCard: ({ children }: any) => <div>{children}</div>
}));

vi.mock('../components/layout', () => ({
  SectionHeader: ({ title, description }: any) => <div><span>{title}</span><span>{description}</span></div>
}));

vi.mock('../components/data-display', () => ({
  MetaList: ({ items }: any) => <div>{items.join(' / ')}</div>
}));

vi.mock('../components/feedback', () => ({
  EmptyState: ({ title }: any) => <div>{title}</div>
}));

vi.mock('../components/user/UserReviewCard', () => ({
  UserReviewCard: ({ content }: any) => <div>{content}</div>
}));

vi.mock('../components/product', () => ({
  ProductGrid: ({ items, renderItem, emptyState }: any) => (
    <div>{items.length ? items.map((item: any, index: number) => renderItem(item, index)) : emptyState}</div>
  ),
  ProductSummaryCard: ({ item, onOpen, priceValue }: any) => (
    <button type="button" onClick={onOpen}>
      <span>{item.title}</span>
      <span>{priceValue}</span>
    </button>
  )
}));

describe('PublicUserPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUserId = '95';
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 1, displayName: '当前用户', role: 'USER' }
    });
    mocks.fetchUserTrustSummary.mockResolvedValue({
      id: 95,
      displayName: '林同学',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      creditScore: 94,
      creditLevel: '优秀',
      verificationStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      college: '林学院',
      completedOrders: 3,
      followerCount: 0,
      isFollowing: false,
      averageRating: null
    });
    mocks.fetchProducts.mockResolvedValue({
      items: [
        {
          id: 1,
          title: '二手教材',
          description: '九成新',
          price: 20,
          category: '教材资料',
          condition: '九成新',
          tags: ['教材'],
          status: 'ON_SALE',
          sellerId: 95,
          sellerName: '林同学'
        },
        {
          id: 2,
          title: '旧键盘',
          description: '手感正常',
          price: 45,
          category: '数码电子',
          condition: '八成新',
          tags: ['键盘'],
          status: 'ON_SALE',
          sellerId: 95,
          sellerName: '林同学',
          wantCount: 2
        },
        {
          id: 3,
          title: '台灯',
          description: '宿舍可用',
          price: 30,
          category: '生活用品',
          condition: '九成新',
          tags: ['台灯'],
          status: 'ON_SALE',
          sellerId: 95,
          sellerName: '林同学',
          wantCount: 5
        }
      ],
      pagination: { page: 1, pageSize: 60, total: 3, totalPages: 1 }
    });
    mocks.fetchCampusServiceListings.mockResolvedValue({
      items: [
        {
          id: 201,
          title: '代取快递',
          description: '今天下午可送到宿舍',
          price: 8,
          reward: 8,
          rewardLabel: '¥8',
          category: 'EXPRESS',
          categoryLabel: '快递跑腿',
          intent: 'REQUEST',
          pattern: 'ONE_TIME',
          serviceType: { key: 'EXPRESS', label: '快递跑腿' },
          imageUrl: '/service-request.png',
          route: { from: '菜鸟驿站', to: '3号宿舍楼', label: '菜鸟驿站 -> 3号宿舍楼' },
          deadlineLabel: '今天 18:00',
          estimatedMinutes: 20,
          urgency: 'TODAY',
          urgencyLabel: '今天',
          fulfillmentMode: 'DROP_OFF',
          fulfillmentModeLabel: '送达',
          schedule: {
            deadlineLabel: '今天 18:00',
            estimatedMinutes: 20,
            urgency: 'TODAY',
            urgencyLabel: '今天',
            summary: '今天 18:00 前送达'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['快递'],
          summaryTags: ['快递', '送达'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T10:00:00.000Z',
          updatedAt: '2026-06-16T10:00:00.000Z',
          conversationId: null,
          publisher: { id: 95, displayName: '林同学', college: '林学院', averageRating: null, completedOrders: 3, creditScore: 94, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        },
        {
          id: 203,
          title: '帮交补办材料',
          description: '明早可代交到服务大厅',
          price: 10,
          reward: 10,
          rewardLabel: '¥10',
          category: 'AGENCY',
          categoryLabel: '代办服务',
          intent: 'REQUEST',
          pattern: 'ONE_TIME',
          serviceType: { key: 'AGENCY', label: '代办服务' },
          imageUrl: '/service-agency.png',
          route: { from: '宿舍楼', to: '学生服务中心', label: '宿舍楼 -> 学生服务中心' },
          deadlineLabel: '明天 10:00',
          estimatedMinutes: 25,
          urgency: 'TODAY',
          urgencyLabel: '今天',
          fulfillmentMode: 'DROP_OFF',
          fulfillmentModeLabel: '送达',
          schedule: {
            deadlineLabel: '明天 10:00',
            estimatedMinutes: 25,
            urgency: 'TODAY',
            urgencyLabel: '今天',
            summary: '明早前代交'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['材料'],
          summaryTags: ['材料', '代交'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T10:30:00.000Z',
          updatedAt: '2026-06-16T10:30:00.000Z',
          conversationId: null,
          publisher: { id: 95, displayName: '林同学', college: '林学院', averageRating: null, completedOrders: 3, creditScore: 94, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        },
        {
          id: 205,
          title: '校内午餐拼单',
          description: '中午一起拼轻食外卖，按人数平摊。',
          price: 1,
          reward: 1,
          rewardLabel: '¥1',
          category: 'GROUP_BUY',
          categoryLabel: '拼单服务',
          intent: 'REQUEST',
          pattern: 'REUSABLE',
          serviceType: { key: 'GROUP_BUY', label: '拼单服务' },
          imageUrl: '/service-group-buy.png',
          route: { from: '线上', to: '线上', label: '群里确认后统一下单' },
          deadlineLabel: '今天 12:00',
          estimatedMinutes: 15,
          urgency: 'NORMAL',
          urgencyLabel: '普通',
          fulfillmentMode: 'ONLINE',
          fulfillmentModeLabel: '线上',
          schedule: {
            deadlineLabel: '今天 12:00',
            estimatedMinutes: 15,
            urgency: 'NORMAL',
            urgencyLabel: '普通',
            summary: '午饭前拼单'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['拼单'],
          summaryTags: ['午餐', '拼单'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T10:45:00.000Z',
          updatedAt: '2026-06-16T10:45:00.000Z',
          conversationId: null,
          publisher: { id: 95, displayName: '林同学', college: '林学院', averageRating: null, completedOrders: 3, creditScore: 94, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        },
        {
          id: 202,
          title: '代写实验报告排版',
          description: '今晚可交付',
          price: 30,
          reward: 30,
          rewardLabel: '¥30',
          category: 'TUTOR',
          categoryLabel: '辅导答疑',
          intent: 'OFFER',
          pattern: 'ONE_TIME',
          serviceType: { key: 'TUTOR', label: '辅导答疑' },
          imageUrl: '/service-offer.png',
          route: { from: '线上', to: '线上', label: '线上' },
          deadlineLabel: '今晚 22:00',
          estimatedMinutes: 90,
          urgency: 'NORMAL',
          urgencyLabel: '普通',
          fulfillmentMode: 'ONLINE',
          fulfillmentModeLabel: '线上',
          schedule: {
            deadlineLabel: '今晚 22:00',
            estimatedMinutes: 90,
            urgency: 'NORMAL',
            urgencyLabel: '普通',
            summary: '今晚可交付'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['排版'],
          summaryTags: ['排版', '线上'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T11:00:00.000Z',
          updatedAt: '2026-06-16T11:00:00.000Z',
          conversationId: null,
          publisher: { id: 95, displayName: '林同学', college: '林学院', averageRating: null, completedOrders: 3, creditScore: 94, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        },
        {
          id: 204,
          title: '简历排版优化',
          description: '今晚可线上修改一版简历',
          price: 25,
          reward: 25,
          rewardLabel: '¥25',
          category: 'SKILL',
          categoryLabel: '技能服务',
          intent: 'OFFER',
          pattern: 'ONE_TIME',
          serviceType: { key: 'SKILL', label: '技能服务' },
          imageUrl: '/service-skill.png',
          route: { from: '线上', to: '线上', label: '线上' },
          deadlineLabel: '今晚 23:00',
          estimatedMinutes: 60,
          urgency: 'NORMAL',
          urgencyLabel: '普通',
          fulfillmentMode: 'ONLINE',
          fulfillmentModeLabel: '线上',
          schedule: {
            deadlineLabel: '今晚 23:00',
            estimatedMinutes: 60,
            urgency: 'NORMAL',
            urgencyLabel: '普通',
            summary: '今晚可完成一版'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['简历'],
          summaryTags: ['设计', '排版'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T11:30:00.000Z',
          updatedAt: '2026-06-16T11:30:00.000Z',
          conversationId: null,
          publisher: { id: 95, displayName: '林同学', college: '林学院', averageRating: null, completedOrders: 3, creditScore: 94, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        }
      ],
      pagination: { page: 1, pageSize: 60, total: 4, totalPages: 1 }
    });
    mocks.fetchUserReceivedReviews.mockResolvedValue({
      items: [],
      summary: { total: 0, averageRating: null }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads public campus services and reuses the existing detail card entry', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PublicUserPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenCalledWith({
        ownerId: 95,
        status: 'OPEN',
        page: 1,
        pageSize: 60,
        sort: 'newest'
      });
    });

    await user.click(await screen.findByRole('tab', { name: '发布的需求 3' }));
    expect(screen.getByText('代取快递')).toBeInTheDocument();
    expect(screen.getByText('帮交补办材料')).toBeInTheDocument();
    expect(screen.getByText('校内午餐拼单')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /代取快递/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/201');

    await user.click(screen.getByRole('tab', { name: '发布的服务 2' }));
    expect(screen.getByText('代写实验报告排版')).toBeInTheDocument();
    expect(screen.getByText('简历排版优化')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /简历排版优化/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/204');

    await user.click(screen.getByRole('tab', { name: '收到的评价 0' }));
    expect(screen.getByText('暂无收到的评价')).toBeInTheDocument();
  });

  it('renders another public publisher with both request and offer listings', async () => {
    const user = userEvent.setup();
    mockedUserId = '108';
    mocks.fetchUserTrustSummary.mockResolvedValueOnce({
      id: 108,
      displayName: '资同学',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      creditScore: 82,
      creditLevel: '优秀',
      verificationStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      college: '资源与环境学院',
      completedOrders: 2,
      followerCount: 1,
      isFollowing: false,
      averageRating: 4.8
    });
    mocks.fetchProducts.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, pageSize: 60, total: 0, totalPages: 0 }
    });
    mocks.fetchCampusServiceListings.mockResolvedValueOnce({
      items: [
        {
          id: 301,
          title: '资源学院活动签到值守',
          description: '明天下午活动开始前帮忙看签到台',
          price: 12,
          reward: 12,
          rewardLabel: '¥12',
          category: 'EVENT',
          categoryLabel: '活动协作',
          intent: 'REQUEST',
          pattern: 'ONE_TIME',
          serviceType: { key: 'EVENT', label: '活动协作' },
          imageUrl: '/service-event.png',
          route: { from: '报告厅门口', to: '签到台', label: '报告厅门口 -> 签到台' },
          deadlineLabel: '明天 14:00',
          estimatedMinutes: 20,
          urgency: 'TODAY',
          urgencyLabel: '今天',
          fulfillmentMode: 'ON_SITE',
          fulfillmentModeLabel: '线下',
          schedule: {
            deadlineLabel: '明天 14:00',
            estimatedMinutes: 20,
            urgency: 'TODAY',
            urgencyLabel: '今天',
            summary: '活动开始前值守 20 分钟'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['签到'],
          summaryTags: ['活动', '签到'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T12:00:00.000Z',
          updatedAt: '2026-06-16T12:00:00.000Z',
          conversationId: null,
          publisher: { id: 108, displayName: '资同学', college: '资源与环境学院', averageRating: 4.8, completedOrders: 2, creditScore: 82, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        },
        {
          id: 302,
          title: '资源学院数据处理答疑',
          description: '这周可线上答疑 Excel 数据清洗',
          price: 24,
          reward: 24,
          rewardLabel: '¥24',
          category: 'TUTORING',
          categoryLabel: '辅导答疑',
          intent: 'OFFER',
          pattern: 'REUSABLE',
          serviceType: { key: 'TUTORING', label: '辅导答疑' },
          imageUrl: '/service-tutoring.png',
          route: { from: '线上', to: '线上', label: '线上答疑' },
          deadlineLabel: '本周可约',
          estimatedMinutes: 60,
          urgency: 'NORMAL',
          urgencyLabel: '普通',
          fulfillmentMode: 'ONLINE',
          fulfillmentModeLabel: '线上',
          schedule: {
            deadlineLabel: '本周可约',
            estimatedMinutes: 60,
            urgency: 'NORMAL',
            urgencyLabel: '普通',
            summary: '线上答疑 1 小时'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['Excel'],
          summaryTags: ['数据', '线上'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T12:10:00.000Z',
          updatedAt: '2026-06-16T12:10:00.000Z',
          conversationId: null,
          publisher: { id: 108, displayName: '资同学', college: '资源与环境学院', averageRating: 4.8, completedOrders: 2, creditScore: 82, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        }
      ],
      pagination: { page: 1, pageSize: 60, total: 2, totalPages: 1 }
    });
    mocks.fetchUserReceivedReviews.mockResolvedValueOnce({
      items: [],
      summary: { total: 0, averageRating: 4.8 }
    });

    render(
      <MemoryRouter>
        <PublicUserPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenCalledWith({
        ownerId: 108,
        status: 'OPEN',
        page: 1,
        pageSize: 60,
        sort: 'newest'
      });
    });

    await user.click(await screen.findByRole('tab', { name: '发布的需求 1' }));
    expect(screen.getByText('资源学院活动签到值守')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /资源学院活动签到值守/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/301');

    await user.click(screen.getByRole('tab', { name: '发布的服务 1' }));
    expect(screen.getByText('资源学院数据处理答疑')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /资源学院数据处理答疑/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/302');
  });

  it('renders a fourth public publisher with agency requests and help offers', async () => {
    const user = userEvent.setup();
    mockedUserId = '114';
    mocks.fetchUserTrustSummary.mockResolvedValueOnce({
      id: 114,
      displayName: '材同学',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      creditScore: 74,
      creditLevel: '良好',
      verificationStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      college: '材料科学与工程学院',
      completedOrders: 1,
      followerCount: 0,
      isFollowing: false,
      averageRating: 4.5
    });
    mocks.fetchProducts.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, pageSize: 60, total: 0, totalPages: 0 }
    });
    mocks.fetchCampusServiceListings.mockResolvedValueOnce({
      items: [
        {
          id: 401,
          title: '材料学院资料代交',
          description: '整理好的纸质材料需要帮忙送到学院办公室',
          price: 8,
          reward: 8,
          rewardLabel: '¥8',
          category: 'AGENCY',
          categoryLabel: '代办服务',
          intent: 'REQUEST',
          pattern: 'ONE_TIME',
          serviceType: { key: 'AGENCY', label: '代办服务' },
          imageUrl: '/service-agency.png',
          route: { from: '宿舍楼', to: '学院办公室', label: '宿舍楼 -> 学院办公室' },
          deadlineLabel: '今天 17:30',
          estimatedMinutes: 25,
          urgency: 'TODAY',
          urgencyLabel: '今天',
          fulfillmentMode: 'DROP_OFF',
          fulfillmentModeLabel: '送达',
          schedule: {
            deadlineLabel: '今天 17:30',
            estimatedMinutes: 25,
            urgency: 'TODAY',
            urgencyLabel: '今天',
            summary: '今天送达学院办公室'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['代交'],
          summaryTags: ['材料', '代交'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T13:00:00.000Z',
          updatedAt: '2026-06-16T13:00:00.000Z',
          conversationId: null,
          publisher: { id: 114, displayName: '材同学', college: '材料科学与工程学院', averageRating: 4.5, completedOrders: 1, creditScore: 74, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        },
        {
          id: 402,
          title: '材料学院晚间顺路帮忙',
          description: '晚间回宿舍途中可顺路帮忙带饭、送资料',
          price: 0,
          reward: 0,
          rewardLabel: '¥0',
          category: 'HELP',
          categoryLabel: '临时帮忙',
          intent: 'OFFER',
          pattern: 'REUSABLE',
          serviceType: { key: 'HELP', label: '临时帮忙' },
          imageUrl: '/service-help.png',
          route: { from: '图书馆', to: '宿舍区', label: '图书馆 -> 宿舍区' },
          deadlineLabel: '今晚 21:00',
          estimatedMinutes: 20,
          urgency: 'NORMAL',
          urgencyLabel: '普通',
          fulfillmentMode: 'FLEXIBLE',
          fulfillmentModeLabel: '灵活交付',
          schedule: {
            deadlineLabel: '今晚 21:00',
            estimatedMinutes: 20,
            urgency: 'NORMAL',
            urgencyLabel: '普通',
            summary: '晚间顺路帮忙'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['带饭'],
          summaryTags: ['顺路', '带饭'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T13:10:00.000Z',
          updatedAt: '2026-06-16T13:10:00.000Z',
          conversationId: null,
          publisher: { id: 114, displayName: '材同学', college: '材料科学与工程学院', averageRating: 4.5, completedOrders: 1, creditScore: 74, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        }
      ],
      pagination: { page: 1, pageSize: 60, total: 2, totalPages: 1 }
    });
    mocks.fetchUserReceivedReviews.mockResolvedValueOnce({
      items: [],
      summary: { total: 0, averageRating: 4.5 }
    });

    render(
      <MemoryRouter>
        <PublicUserPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenCalledWith({
        ownerId: 114,
        status: 'OPEN',
        page: 1,
        pageSize: 60,
        sort: 'newest'
      });
    });

    await user.click(await screen.findByRole('tab', { name: '发布的需求 1' }));
    expect(screen.getByText('材料学院资料代交')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /材料学院资料代交/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/401');

    await user.click(screen.getByRole('tab', { name: '发布的服务 1' }));
    expect(screen.getByText('材料学院晚间顺路帮忙')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /材料学院晚间顺路帮忙/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/402');
  });

  it('renders a fifth public publisher with errand requests and skill offers', async () => {
    const user = userEvent.setup();
    mockedUserId = '121';
    mocks.fetchUserTrustSummary.mockResolvedValueOnce({
      id: 121,
      displayName: '计同学',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: true,
      creditScore: 86,
      creditLevel: '优秀',
      verificationStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      college: '计算机与控制工程学院',
      completedOrders: 4,
      followerCount: 2,
      isFollowing: false,
      averageRating: 4.9
    });
    mocks.fetchProducts.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, pageSize: 60, total: 0, totalPages: 0 }
    });
    mocks.fetchCampusServiceListings.mockResolvedValueOnce({
      items: [
        {
          id: 501,
          title: '计控学院资料代拿',
          description: '图书馆服务台的资料需要顺路代拿到教学楼',
          price: 5,
          reward: 5,
          rewardLabel: '¥5',
          category: 'ERRAND',
          categoryLabel: '跑腿服务',
          intent: 'REQUEST',
          pattern: 'ONE_TIME',
          serviceType: { key: 'ERRAND', label: '跑腿服务' },
          imageUrl: '/service-errand.png',
          route: { from: '图书馆服务台', to: '教学楼', label: '图书馆服务台 -> 教学楼' },
          deadlineLabel: '今天 18:30',
          estimatedMinutes: 20,
          urgency: 'TODAY',
          urgencyLabel: '今天',
          fulfillmentMode: 'DROP_OFF',
          fulfillmentModeLabel: '送达',
          schedule: {
            deadlineLabel: '今天 18:30',
            estimatedMinutes: 20,
            urgency: 'TODAY',
            urgencyLabel: '今天',
            summary: '今天送到教学楼'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['资料'],
          summaryTags: ['图书馆', '代拿'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T13:30:00.000Z',
          updatedAt: '2026-06-16T13:30:00.000Z',
          conversationId: null,
          publisher: { id: 121, displayName: '计同学', college: '计算机与控制工程学院', averageRating: 4.9, completedOrders: 4, creditScore: 86, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        },
        {
          id: 502,
          title: '计控学院 PPT 梳理',
          description: '今晚可帮忙梳理课程汇报 PPT 结构和视觉层级',
          price: 26,
          reward: 26,
          rewardLabel: '¥26',
          category: 'SKILL',
          categoryLabel: '技能服务',
          intent: 'OFFER',
          pattern: 'REUSABLE',
          serviceType: { key: 'SKILL', label: '技能服务' },
          imageUrl: '/service-skill.png',
          route: { from: '线上', to: '线上', label: '线上沟通' },
          deadlineLabel: '今晚 23:00',
          estimatedMinutes: 50,
          urgency: 'NORMAL',
          urgencyLabel: '普通',
          fulfillmentMode: 'FLEXIBLE',
          fulfillmentModeLabel: '灵活交付',
          schedule: {
            deadlineLabel: '今晚 23:00',
            estimatedMinutes: 50,
            urgency: 'NORMAL',
            urgencyLabel: '普通',
            summary: '今晚可完成结构梳理'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['PPT'],
          summaryTags: ['汇报', '梳理'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T13:40:00.000Z',
          updatedAt: '2026-06-16T13:40:00.000Z',
          conversationId: null,
          publisher: { id: 121, displayName: '计同学', college: '计算机与控制工程学院', averageRating: 4.9, completedOrders: 4, creditScore: 86, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        }
      ],
      pagination: { page: 1, pageSize: 60, total: 2, totalPages: 1 }
    });
    mocks.fetchUserReceivedReviews.mockResolvedValueOnce({
      items: [],
      summary: { total: 0, averageRating: 4.9 }
    });

    render(
      <MemoryRouter>
        <PublicUserPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenCalledWith({
        ownerId: 121,
        status: 'OPEN',
        page: 1,
        pageSize: 60,
        sort: 'newest'
      });
    });

    await user.click(await screen.findByRole('tab', { name: '发布的需求 1' }));
    expect(screen.getByText('计控学院资料代拿')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /计控学院资料代拿/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/501');

    await user.click(screen.getByRole('tab', { name: '发布的服务 1' }));
    expect(screen.getByText('计控学院 PPT 梳理')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /计控学院 PPT 梳理/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/502');
  });

  it('renders a sixth public publisher with moving requests and tutoring offers', async () => {
    const user = userEvent.setup();
    mockedUserId = '126';
    mocks.fetchUserTrustSummary.mockResolvedValueOnce({
      id: 126,
      displayName: '化同学',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      creditScore: 84,
      creditLevel: '优秀',
      verificationStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      college: '化学与化工学院',
      completedOrders: 2,
      followerCount: 1,
      isFollowing: false,
      averageRating: 4.7
    });
    mocks.fetchProducts.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, pageSize: 60, total: 0, totalPages: 0 }
    });
    mocks.fetchCampusServiceListings.mockResolvedValueOnce({
      items: [
        {
          id: 601,
          title: '化工学院跨楼搬箱',
          description: '理科楼和实验楼之间需要搬两箱课程资料',
          price: 14,
          reward: 14,
          rewardLabel: '¥14',
          category: 'MOVING',
          categoryLabel: '搬运协作',
          intent: 'REQUEST',
          pattern: 'ONE_TIME',
          serviceType: { key: 'MOVING', label: '搬运协作' },
          imageUrl: '/service-moving.png',
          route: { from: '理科楼', to: '实验楼', label: '理科楼 -> 实验楼' },
          deadlineLabel: '今天 19:00',
          estimatedMinutes: 30,
          urgency: 'TODAY',
          urgencyLabel: '今天',
          fulfillmentMode: 'FACE_TO_FACE',
          fulfillmentModeLabel: '当面协作',
          schedule: {
            deadlineLabel: '今天 19:00',
            estimatedMinutes: 30,
            urgency: 'TODAY',
            urgencyLabel: '今天',
            summary: '今晚前搬到实验楼'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['搬箱'],
          summaryTags: ['资料', '跨楼'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T14:00:00.000Z',
          updatedAt: '2026-06-16T14:00:00.000Z',
          conversationId: null,
          publisher: { id: 126, displayName: '化同学', college: '化学与化工学院', averageRating: 4.7, completedOrders: 2, creditScore: 84, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        },
        {
          id: 602,
          title: '化工学院公开演讲陪练',
          description: '今晚可线上梳理公开表达节奏、开场过渡和讲解逻辑',
          price: 28,
          reward: 28,
          rewardLabel: '¥28',
          category: 'TUTORING',
          categoryLabel: '辅导答疑',
          intent: 'OFFER',
          pattern: 'REUSABLE',
          serviceType: { key: 'TUTORING', label: '辅导答疑' },
          imageUrl: '/service-tutoring.png',
          route: { from: '线上', to: '线上', label: '线上答疑' },
          deadlineLabel: '今晚 22:00',
          estimatedMinutes: 50,
          urgency: 'NORMAL',
          urgencyLabel: '普通',
          fulfillmentMode: 'ONLINE',
          fulfillmentModeLabel: '线上',
          schedule: {
            deadlineLabel: '今晚 22:00',
            estimatedMinutes: 50,
            urgency: 'NORMAL',
            urgencyLabel: '普通',
            summary: '今晚可答疑 1 小时内重点内容'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['汇报'],
          summaryTags: ['答疑', '线上'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T14:10:00.000Z',
          updatedAt: '2026-06-16T14:10:00.000Z',
          conversationId: null,
          publisher: { id: 126, displayName: '化同学', college: '化学与化工学院', averageRating: 4.7, completedOrders: 2, creditScore: 84, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        }
      ],
      pagination: { page: 1, pageSize: 60, total: 2, totalPages: 1 }
    });
    mocks.fetchUserReceivedReviews.mockResolvedValueOnce({
      items: [],
      summary: { total: 0, averageRating: 4.7 }
    });

    render(
      <MemoryRouter>
        <PublicUserPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenCalledWith({
        ownerId: 126,
        status: 'OPEN',
        page: 1,
        pageSize: 60,
        sort: 'newest'
      });
    });

    await user.click(await screen.findByRole('tab', { name: '发布的需求 1' }));
    expect(screen.getByText('化工学院跨楼搬箱')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /化工学院跨楼搬箱/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/601');

    await user.click(screen.getByRole('tab', { name: '发布的服务 1' }));
    expect(screen.getByText('化工学院公开演讲陪练')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /化工学院公开演讲陪练/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/602');
  });

  it('renders a seventh public publisher with errand requests and skill offers', async () => {
    const user = userEvent.setup();
    mockedUserId = '132';
    mocks.fetchUserTrustSummary.mockResolvedValueOnce({
      id: 132,
      displayName: '环同学二',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: true,
      creditScore: 83,
      creditLevel: '优秀',
      verificationStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      college: '环境科学与工程学院',
      completedOrders: 3,
      followerCount: 1,
      isFollowing: false,
      averageRating: 4.8
    });
    mocks.fetchProducts.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, pageSize: 60, total: 0, totalPages: 0 }
    });
    mocks.fetchCampusServiceListings.mockResolvedValueOnce({
      items: [
        {
          id: 701,
          title: '环工学院实验耗材代拿',
          description: '实验课前需要把已预约的小件耗材从材料点带到实验楼大厅',
          price: 6,
          reward: 6,
          rewardLabel: '¥6',
          category: 'ERRAND',
          categoryLabel: '跑腿服务',
          intent: 'REQUEST',
          pattern: 'ONE_TIME',
          serviceType: { key: 'ERRAND', label: '跑腿服务' },
          imageUrl: '/service-errand.png',
          route: { from: '实验耗材领取点', to: '实验楼大厅', label: '实验耗材领取点 -> 实验楼大厅' },
          deadlineLabel: '今天 16:30',
          estimatedMinutes: 20,
          urgency: 'TODAY',
          urgencyLabel: '今天',
          fulfillmentMode: 'DROP_OFF',
          fulfillmentModeLabel: '送达',
          schedule: {
            deadlineLabel: '今天 16:30',
            estimatedMinutes: 20,
            urgency: 'TODAY',
            urgencyLabel: '今天',
            summary: '实验课前送达'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['耗材'],
          summaryTags: ['实验', '代拿'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T15:00:00.000Z',
          updatedAt: '2026-06-16T15:00:00.000Z',
          conversationId: null,
          publisher: { id: 132, displayName: '环同学二', college: '环境科学与工程学院', averageRating: 4.8, completedOrders: 3, creditScore: 83, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        },
        {
          id: 702,
          title: '环工学院作品集封面微调',
          description: '今晚可帮忙做作品集封面、目录页和统一字体层级微调',
          price: 22,
          reward: 22,
          rewardLabel: '¥22',
          category: 'SKILL',
          categoryLabel: '技能服务',
          intent: 'OFFER',
          pattern: 'REUSABLE',
          serviceType: { key: 'SKILL', label: '技能服务' },
          imageUrl: '/service-skill.png',
          route: { from: '线上', to: '线上', label: '线上沟通后交付' },
          deadlineLabel: '今晚 22:30',
          estimatedMinutes: 45,
          urgency: 'NORMAL',
          urgencyLabel: '普通',
          fulfillmentMode: 'FLEXIBLE',
          fulfillmentModeLabel: '灵活交付',
          schedule: {
            deadlineLabel: '今晚 22:30',
            estimatedMinutes: 45,
            urgency: 'NORMAL',
            urgencyLabel: '普通',
            summary: '今晚可交付一版'
          },
          status: 'OPEN',
          statusLabel: '进行中',
          tags: ['作品集'],
          summaryTags: ['封面', '排版'],
          participantSummary: { publisherLabel: '发布者', participantLabel: null },
          viewerContext: { isLoggedIn: true, isPublisher: false, isParticipant: false },
          actionState: {
            isPublisher: false,
            isParticipant: false,
            canAccept: false,
            canPause: false,
            canReopen: false,
            canEnd: false,
            canCancel: false,
            canConfirm: false,
            canComplete: false,
            canReject: false
          },
          actionLabels: {},
          latestOrderId: null,
          actionOrderId: null,
          activeOrderCount: 0,
          pendingOrderCount: 0,
          waitingCompleteOrderCount: 0,
          endedOrderCount: 0,
          totalOrderCount: 0,
          createdAt: '2026-06-16T15:10:00.000Z',
          updatedAt: '2026-06-16T15:10:00.000Z',
          conversationId: null,
          publisher: { id: 132, displayName: '环同学二', college: '环境科学与工程学院', averageRating: 4.8, completedOrders: 3, creditScore: 83, verificationStatus: 'APPROVED', accountStatus: 'ACTIVE' },
          participant: null
        }
      ],
      pagination: { page: 1, pageSize: 60, total: 2, totalPages: 1 }
    });
    mocks.fetchUserReceivedReviews.mockResolvedValueOnce({
      items: [],
      summary: { total: 0, averageRating: 4.8 }
    });

    render(
      <MemoryRouter>
        <PublicUserPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenCalledWith({
        ownerId: 132,
        status: 'OPEN',
        page: 1,
        pageSize: 60,
        sort: 'newest'
      });
    });

    await user.click(await screen.findByRole('tab', { name: '发布的需求 1' }));
    expect(screen.getByText('环工学院实验耗材代拿')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /环工学院实验耗材代拿/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/701');

    await user.click(screen.getByRole('tab', { name: '发布的服务 1' }));
    expect(screen.getByText('环工学院作品集封面微调')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /环工学院作品集封面微调/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/702');
  });

  it('shows a missing profile for invalid ids', async () => {
    mockedUserId = '0';

    render(
      <MemoryRouter>
        <PublicUserPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('用户主页不存在')).toBeInTheDocument();
  });

  it('shows a load error when the profile request fails', async () => {
    mocks.fetchUserTrustSummary.mockRejectedValueOnce(new Error('boom'));

    render(
      <MemoryRouter>
        <PublicUserPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('用户主页加载失败')).toBeInTheDocument();
  });

  it('hides the follow button on the owner profile', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 95, displayName: '林同学', role: 'USER' }
    });

    render(
      <MemoryRouter>
        <PublicUserPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchUserTrustSummary).toHaveBeenCalledWith(95);
    });

    expect(screen.queryByRole('button', { name: '关注' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '已关注' })).not.toBeInTheDocument();
  });

  it('blocks follow when trading access is denied', async () => {
    const user = userEvent.setup();
    mocks.ensureTradingAccessOrNotify.mockReturnValueOnce(false);

    render(
      <MemoryRouter>
        <PublicUserPage />
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: '关注' }));
    expect(mocks.executeToggleFollow).not.toHaveBeenCalled();
  });

  it('updates the follow button after a successful follow', async () => {
    const user = userEvent.setup();
    mocks.executeToggleFollow.mockImplementation(async (options: any) => {
      options.setPending(true);
      options.notifySuccess('关注成功');
      options.onSuccess({ isFollowing: true, followerCount: 9 });
      options.setPending(false);
    });

    render(
      <MemoryRouter>
        <PublicUserPage />
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: '关注' }));

    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('关注成功');
      expect(screen.getByRole('button', { name: '已关注' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '已关注' })).toHaveClass('is-following');
  });
});
