import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    useParams: () => ({ id: '95' })
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
        }
      ],
      pagination: { page: 1, pageSize: 60, total: 1, totalPages: 1 }
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
  });
});
