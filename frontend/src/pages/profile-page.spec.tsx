import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { normalizeProfileFormValues, ProfilePage } from './ProfilePage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  formInstance: {
    setFieldsValue: vi.fn(),
    setFieldValue: vi.fn(),
    validateFields: vi.fn(),
    resetFields: vi.fn()
  },
  fetchProducts: vi.fn(),
  fetchCampusServiceListings: vi.fn(),
  fetchCampusServiceOrders: vi.fn(),
  fetchFavoriteList: vi.fn(),
  fetchBrowsingHistory: vi.fn(),
  fetchFollowingUsers: vi.fn(),
  fetchUserReceivedReviews: vi.fn(),
  fetchOrders: vi.fn(),
  fetchUserProfile: vi.fn(),
  fetchUserTrustSummary: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  cancelCampusServiceOrder: vi.fn(),
  completeCampusServiceOrder: vi.fn(),
  confirmCampusServiceOrder: vi.fn(),
  rejectCampusServiceOrder: vi.fn(),
  uploadImageAsset: vi.fn(),
  updateUserProfile: vi.fn(),
  useAuthState: vi.fn(),
  hasTradingAccess: vi.fn(),
  isGuestUser: vi.fn(),
  executeCampusServiceOrderAction: vi.fn(async ({ run, onSuccess }: any) => {
    const result = await run();
    await onSuccess?.(result);
    return result;
  }),
  getCampusServiceOrderRejectOrCancelText: vi.fn((_order?: any, _currentUserId?: number | null) => ({
    title: '填写原因',
    okText: '确认'
  }))
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  const MockForm = ({ children, className, onFinish }: any) => (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        void onFinish?.({});
      }}
    >
      {children}
    </form>
  );

  MockForm.Item = ({ children, label, hidden }: any) => (
    <div style={hidden ? { display: 'none' } : undefined}>
      {label ? <span>{label}</span> : null}
      {children}
    </div>
  );

  MockForm.useForm = () => [mocks.formInstance];

  return {
    ...actual,
    message: {
      success: mocks.success,
      error: mocks.error,
      warning: mocks.warning,
      info: mocks.info
    },
    Form: MockForm,
    Select: ({ value, onChange, options = [], placeholder }: any) => (
      <select
        aria-label={placeholder || 'select'}
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">empty</option>
        {options.map((option: any) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    ),
    InputNumber: ({ value, onChange, placeholder }: any) => (
      <input
        aria-label={placeholder || 'number'}
        type="number"
        value={value ?? ''}
        onChange={(event) => onChange?.(Number(event.target.value))}
      />
    )
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ state: null })
  };
});

vi.mock('../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../services/session', async () => {
  const actual = await vi.importActual<typeof import('../services/session')>('../services/session');
  return {
    ...actual,
    hasTradingAccess: (user: any) => mocks.hasTradingAccess(user),
    isGuestUser: (user: any) => mocks.isGuestUser(user)
  };
});

vi.mock('../services/api', () => ({
  cancelCampusServiceOrder: (...args: any[]) => mocks.cancelCampusServiceOrder(...args),
  completeCampusServiceOrder: (...args: any[]) => mocks.completeCampusServiceOrder(...args),
  confirmCampusServiceOrder: (...args: any[]) => mocks.confirmCampusServiceOrder(...args),
  rejectCampusServiceOrder: (...args: any[]) => mocks.rejectCampusServiceOrder(...args),
  fetchCampusServiceOrders: (...args: any[]) => mocks.fetchCampusServiceOrders(...args),
  fetchCampusServiceListings: (...args: any[]) => mocks.fetchCampusServiceListings(...args),
  fetchFavoriteList: (...args: any[]) => mocks.fetchFavoriteList(...args),
  fetchFollowingUsers: (...args: any[]) => mocks.fetchFollowingUsers(...args),
  fetchBrowsingHistory: (...args: any[]) => mocks.fetchBrowsingHistory(...args),
  fetchOrders: (...args: any[]) => mocks.fetchOrders(...args),
  fetchProducts: (...args: any[]) => mocks.fetchProducts(...args),
  fetchUserProfile: (...args: any[]) => mocks.fetchUserProfile(...args),
  fetchUserReceivedReviews: (...args: any[]) => mocks.fetchUserReceivedReviews(...args),
  fetchUserTrustSummary: (...args: any[]) => mocks.fetchUserTrustSummary(...args),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback),
  uploadImageAsset: (file: File, purpose?: string) => mocks.uploadImageAsset(file, purpose),
  updateUserProfile: (payload: unknown) => mocks.updateUserProfile(payload)
}));

vi.mock('../utils/campusServiceOrderActions', () => ({
  executeCampusServiceOrderAction: (options: any) => mocks.executeCampusServiceOrderAction(options),
  getCampusServiceOrderRejectOrCancelText: (order: any, currentUserId?: number | null) => mocks.getCampusServiceOrderRejectOrCancelText(order, currentUserId)
}));

vi.mock('../components/user/UserAvatar', () => ({
  AVATAR_FRAMES: [],
  UserAvatar: ({ alt, fallbackLabel }: any) => <span>{alt || fallbackLabel || 'avatar'}</span>
}));

vi.mock('../components/user/UserNameWithBadge', () => ({
  UserNameWithBadge: ({ as: Tag = 'span', name }: any) => <Tag>{name}</Tag>
}));

vi.mock('../components/user/UserReviewCard', () => ({
  UserReviewCard: ({ content }: any) => <div>{content}</div>
}));

vi.mock('../components/feedback', () => ({
  EmptyState: ({ title, description }: any) => <div><span>{title}</span><span>{description}</span></div>
}));

vi.mock('../components/layout', () => ({
  SectionHeader: ({ title, description, action }: any) => <div><span>{title}</span><span>{description}</span>{action}</div>
}));

vi.mock('../components/image-upload', () => ({
  ImageCropUploadModal: ({ open, onConfirm, onCancel }: any) => open ? (
    <div>
      <div>头像上传</div>
      <button
        type="button"
        onClick={() => onConfirm(new File(['avatar'], 'avatar.png', { type: 'image/png' }), 'blob:avatar')}
      >
        确认上传头像
      </button>
      <button type="button" onClick={onCancel}>关闭头像上传</button>
    </div>
  ) : null
}));

vi.mock('../components/listing', () => ({
  CampusServiceOrderCard: ({ order, onViewDetail, onOpenConversation, onCancel, onComplete }: any) => (
    <div>
      <button type="button" onClick={() => onViewDetail(order)}>
        <span>{order.title}</span>
        <span>{order.orderStatusLabel}</span>
      </button>
      {onOpenConversation ? <button type="button" onClick={() => onOpenConversation(order)}>打开会话{order.id}</button> : null}
      {onCancel ? <button type="button" onClick={() => onCancel(order)}>取消协作{order.id}</button> : null}
      {onComplete ? <button type="button" onClick={() => onComplete(order)}>完成协作{order.id}</button> : null}
    </div>
  ),
  CampusServicePublisherOrderWorkbench: ({ listing }: any) => listing ? <div>申请与预约管理</div> : null,
  ProductOrderCard: ({ order, onViewDetail, onOpenConversation }: any) => (
    <div>
      <button type="button" onClick={() => onViewDetail(order)}>
        <span>{order.productTitle}</span>
      </button>
      {onOpenConversation ? <button type="button" onClick={() => onOpenConversation(order)}>{order.productTitle}会话</button> : null}
    </div>
  )
}));

vi.mock('../components/product', () => ({
  ProductGrid: ({ items, renderItem }: any) => <div>{items.map((item: any, index: number) => renderItem(item, index))}</div>,
  ProductSummaryCard: ({ item, onOpen, priceValue, priceMeta }: any) => (
    <button type="button" onClick={onOpen}>
      <span>{item.title}</span>
      <span>{priceValue ?? priceMeta ?? ''}</span>
    </button>
  )
}));

vi.mock('../components/ui', () => ({
  ConfirmReasonModal: ({ open }: any) => open ? <div>原因弹窗</div> : null,
  CreditBadge: ({ label }: any) => <span>{label}</span>,
  ProfileOrderScopePanel: ({ children, title, scope, onScopeChange }: any) => (
    <div>
      <span>{title}</span>
      <button type="button" onClick={() => onScopeChange('active')}>{scope === 'active' ? '进行中' : '切到进行中'}</button>
      <button type="button" onClick={() => onScopeChange('ended')}>{scope === 'ended' ? '已结束' : '切到已结束'}</button>
      {children}
    </div>
  )
}));

vi.mock('../utils/listingStatus', () => ({
  getListingStatusPresentation: () => ({ label: '在售' })
}));

vi.mock('../utils/productCover', () => ({
  getProductImage: () => '/product.png',
  resolvePrimaryProductImage: () => '/campus-service.png'
}));

vi.mock('../utils/userPresentation', () => ({
  getUserPresentation: (user: any) => ({
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    initial: user.displayName?.slice(0, 1) ?? 'U',
    avatarFrame: user.avatarFrame ?? null,
    trustedBadgeUnlocked: Boolean(user.trustedBadgeUnlocked),
    creditBadge: { tone: 'green', label: user.creditLevel ?? '优秀' },
    collegeLabel: user.college ?? '信息学院'
  })
}));

function createCampusServiceListing(overrides: Record<string, unknown> = {}) {
  return {
    id: 401,
    title: '代取快递',
    description: '下午可送达',
    price: 8,
    imageUrl: '/listing.png',
    tags: ['快递'],
    status: 'OPEN',
    statusLabel: '进行中',
    category: 'ERRAND',
    categoryLabel: '跑腿代办',
    intent: 'REQUEST',
    intentLabel: '需求',
    pattern: 'ONE_TIME',
    serviceType: { key: 'ERRAND', label: '跑腿代办' },
    reward: 8,
    rewardLabel: '¥8',
    route: { from: '菜鸟驿站', to: '宿舍楼', label: '菜鸟驿站 -> 宿舍楼' },
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
    summaryTags: ['跑腿', '送达'],
    participantSummary: { publisherLabel: '发布者', participantLabel: null },
    viewerContext: {
      role: 'PUBLISHER',
      canAccept: false,
      canConfirm: false,
      canReject: false,
      canComplete: false,
      canPause: false,
      canReopen: false,
      canEnd: false,
      canCancel: false,
      canOpenConversation: false
    },
    actionState: {
      isPublisher: true,
      isParticipant: false,
      canAccept: false,
      canConfirm: false,
      canReject: false,
      canComplete: false,
      canPause: false,
      canReopen: false,
      canEnd: false,
      canCancel: false,
      canOpenConversation: false
    },
    actionLabels: {
      accept: null,
      confirm: null,
      reject: null,
      complete: null,
      pause: null,
      reopen: null,
      end: null,
      cancel: null,
      conversation: null
    },
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
    publisher: {
      id: 7,
      displayName: '张同学',
      studentId: '202600007',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      creditScore: 96,
      verificationStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      college: '信息学院',
      averageRating: 4.9,
      completedOrders: 12
    },
    participant: null,
    ...overrides
  } as any;
}

function createCampusServiceOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 701,
    listingId: 401,
    title: '代取快递订单',
    description: '帮忙送到宿舍',
    price: 8,
    imageUrl: '/order.png',
    tags: ['快递'],
    status: 'CONFIRMED',
    statusLabel: '进行中',
    orderStatus: 'CONFIRMED',
    orderStatusLabel: '进行中',
    listingStatus: 'BUSY',
    listingStatusLabel: '进行中',
    intent: 'REQUEST',
    intentLabel: '需求',
    category: 'ERRAND',
    categoryLabel: '跑腿代办',
    reward: 8,
    rewardLabel: '¥8',
    route: { from: '菜鸟驿站', to: '宿舍楼', label: '菜鸟驿站 -> 宿舍楼' },
    deadlineLabel: '今天 18:00',
    estimatedMinutes: 20,
    role: 'PROVIDER',
    roleLabel: '接单方',
    summaryTags: ['跑腿', '接单'],
    actionState: {
      canComplete: true,
      canCancel: true,
      canOpenConversation: false,
      canConfirm: false,
      canReject: false
    },
    actionLabels: {
      confirm: null,
      reject: null,
      complete: '确认完工',
      cancel: '取消订单',
      conversation: null
    },
    conversationId: null,
    counterpart: {
      id: 8,
      displayName: '李同学',
      studentId: '202600008',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      creditScore: 90,
      verificationStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      college: '园林学院',
      averageRating: 4.8,
      completedOrders: 6
    },
    publisher: {
      id: 8,
      displayName: '李同学',
      studentId: '202600008',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      creditScore: 90,
      verificationStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      college: '园林学院',
      averageRating: 4.8,
      completedOrders: 6
    },
    createdAt: '2026-06-16T10:00:00.000Z',
    updatedAt: '2026-06-16T10:00:00.000Z',
    ...overrides
  } as any;
}

function createProductOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 801,
    productId: 11,
    productTitle: '高数教材订单',
    productStatus: 'ON_SALE',
    buyerId: 7,
    sellerId: 8,
    status: 'IN_PROGRESS',
    conversationId: 990,
    orderCode: 'ORD-801',
    createdAt: '2026-06-16T10:00:00.000Z',
    updatedAt: '2026-06-16T10:00:00.000Z',
    ...overrides
  } as any;
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuthState.mockReturnValue({
      currentUser: {
        id: 7,
        displayName: '张同学',
        role: 'USER',
        avatarUrl: null,
        avatarFrame: null,
        trustedBadgeUnlocked: false,
        college: '信息学院',
        creditLevel: '优秀'
      },
      refreshCurrentUser: vi.fn()
    });
    mocks.hasTradingAccess.mockReturnValue(true);
    mocks.isGuestUser.mockReturnValue(false);
    mocks.fetchProducts.mockResolvedValue({
      items: [
        {
          id: 11,
          title: '高数教材',
          description: '九成新',
          price: 18,
          category: '教材资料',
          condition: '九成新',
          tags: ['教材'],
          status: 'ON_SALE',
          sellerId: 7,
          sellerName: '张同学',
          wantCount: 2
        }
      ],
      pagination: { page: 1, pageSize: 60, total: 1, totalPages: 1 }
    });
    mocks.fetchCampusServiceListings.mockResolvedValue({
      items: [
        createCampusServiceListing(),
        createCampusServiceListing({
          id: 402,
          title: '高数答疑',
          category: 'TUTORING',
          categoryLabel: '学习辅导',
          intent: 'OFFER',
          intentLabel: '服务',
          reward: 35,
          rewardLabel: '¥35',
          serviceType: { key: 'TUTORING', label: '学习辅导' }
        })
      ],
      pagination: { page: 1, pageSize: 60, total: 2, totalPages: 1 }
    });
    mocks.fetchCampusServiceOrders.mockResolvedValue({
      items: [
        createCampusServiceOrder(),
        createCampusServiceOrder({
          id: 702,
          listingId: 402,
          title: '高数答疑预约',
          intent: 'OFFER',
          intentLabel: '服务',
          category: 'TUTORING',
          categoryLabel: '学习辅导',
          role: 'REQUESTER',
          roleLabel: '预约方'
        })
      ],
      pagination: { page: 1, pageSize: 60, total: 2, totalPages: 1 }
    });
    mocks.fetchFavoriteList.mockResolvedValue({ items: [], total: 0 });
    mocks.fetchBrowsingHistory.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 24, total: 0, totalPages: 0 } });
    mocks.fetchFollowingUsers.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 24, total: 0, totalPages: 0 } });
    mocks.fetchUserReceivedReviews.mockResolvedValue({ items: [] });
    mocks.fetchOrders.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } });
    mocks.fetchUserProfile.mockResolvedValue({
      id: 7,
      displayName: '张同学',
      studentId: '202600007',
      email: 'zhang@example.com',
      realName: '张三',
      college: '信息学院',
      graduationYear: 2028,
      phone: '13800138000',
      avatarUrl: null,
      avatarFrame: 'none',
      avatarFrameUnlocked: false
    });
    mocks.fetchUserTrustSummary.mockResolvedValue({
      id: 7,
      displayName: '张同学',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      creditScore: 96,
      creditLevel: '优秀',
      verificationStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      college: '信息学院',
      completedOrders: 12,
      followerCount: 3,
      isFollowing: false,
      averageRating: 4.9
    });
  });

  it('shows published request and offer services under separate profile scopes', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: '编辑资料' })).toBeInTheDocument();
    expect(mocks.fetchCampusServiceListings).toHaveBeenCalledWith({
      ownerId: 7,
      page: 1,
      pageSize: 60,
      sort: 'newest'
    });

    await user.click(screen.getByRole('button', { name: '我发布的需求' }));
    expect(await screen.findByText('代取快递')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '代取快递 ¥8' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/401');

    await user.click(screen.getByRole('button', { name: '我发布的服务' }));
    expect(await screen.findByText('高数答疑')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '高数答疑 ¥35' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/402');
  });

  it('shows provider and booking campus service orders in separate sections', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: '高数教材 2 人想要' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /我接的单/ })[0]!);
    expect(await screen.findByText('代取快递订单')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '代取快递订单 进行中' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-service-orders/701');

    await user.click(screen.getAllByRole('button', { name: /我预约的服务/ })[0]!);
    expect(await screen.findByText('高数答疑预约')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '高数答疑预约 进行中' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-service-orders/702');

    await waitFor(() => {
      expect(mocks.fetchCampusServiceOrders).toHaveBeenCalledWith({ page: 1, pageSize: 60 });
    });
  });

  it('shows guest empty state when trading access is unavailable', () => {
    mocks.hasTradingAccess.mockReturnValue(false);
    mocks.isGuestUser.mockReturnValue(true);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText('游客模式暂不支持')).toBeInTheDocument();
  });

  it('renders favorites, history, following, reviews and product orders with navigation actions', async () => {
    const user = userEvent.setup();
    mocks.fetchFavoriteList.mockResolvedValue({
      items: [
        {
          id: 21,
          title: '收藏耳机',
          description: '无线',
          price: 99,
          category: '数码电子',
          condition: '九成新',
          tags: ['耳机'],
          status: 'ON_SALE',
          sellerId: 9,
          sellerName: '卖家甲',
          imageUrl: '/favorite.png'
        }
      ],
      total: 1
    });
    mocks.fetchBrowsingHistory.mockResolvedValue({
      items: [
        {
          id: 31,
          title: '浏览教材',
          description: '带笔记',
          price: 20,
          category: '教材资料',
          condition: '八成新',
          tags: ['教材'],
          status: 'ON_SALE',
          sellerName: '卖家乙',
          imageUrl: '/history-product.png',
          viewedAt: '2026-06-16T10:00:00.000Z'
        },
        {
          type: 'campus-service',
          id: 32,
          title: '浏览服务',
          description: '代办',
          category: 'ERRAND',
          categoryLabel: '跑腿代办',
          intent: 'REQUEST',
          intentLabel: '需求',
          status: 'OPEN',
          statusLabel: '开放中',
          imageUrl: '/history-service.png',
          price: 6,
          rewardLabel: '¥6',
          sellerName: '服务者',
          publisher: { id: 3, displayName: '服务者' },
          summaryTags: ['代办'],
          viewedAt: '2026-06-16T11:00:00.000Z'
        }
      ],
      pagination: { page: 1, pageSize: 24, total: 2, totalPages: 1 }
    });
    mocks.fetchFollowingUsers.mockResolvedValue({
      items: [
        {
          id: 41,
          displayName: '关注对象',
          avatarUrl: null,
          avatarFrame: null,
          trustedBadgeUnlocked: true,
          creditScore: 88,
          creditLevel: '稳定',
          college: '园林学院',
          activeProductCount: 3,
          followerCount: 5,
          followedAt: '2026-06-16T09:00:00.000Z'
        }
      ],
      pagination: { page: 1, pageSize: 24, total: 1, totalPages: 1 }
    });
    mocks.fetchUserReceivedReviews.mockResolvedValue({
      items: [
        {
          id: 51,
          reviewerName: '买家甲',
          createdAt: '2026-06-16T12:00:00.000Z',
          rating: 5,
          content: '沟通顺畅',
          reviewerTrustedBadgeUnlocked: true
        }
      ]
    });
    mocks.fetchOrders.mockResolvedValue({
      items: [
        createProductOrder(),
        createProductOrder({
          id: 802,
          buyerId: 9,
          sellerId: 7,
          productTitle: '我卖出的相机',
          conversationId: 991,
          status: 'COMPLETED'
        })
      ],
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 }
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: '高数教材 2 人想要' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /我的收藏/ })[0]!);
    expect(await screen.findByText('收藏耳机')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /收藏耳机/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/products/21');

    await user.click(screen.getAllByRole('button', { name: /历史浏览/ })[0]!);
    expect(await screen.findByText('浏览教材')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '浏览教材' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/products/31');
    await user.click(screen.getByRole('button', { name: '浏览服务 ¥6' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/32');

    await user.click(screen.getAllByRole('button', { name: /我的关注/ })[0]!);
    expect(await screen.findByText('关注对象')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '查看 关注对象 的主页' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/users/41');

    await user.click(screen.getAllByRole('button', { name: /收到的评价/ })[0]!);
    expect(await screen.findByText('沟通顺畅')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /我买到的/ })[0]!);
    expect(await screen.findByText('高数教材订单')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '高数教材订单会话' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/messages?conversationId=990');
    await user.click(screen.getByRole('button', { name: '高数教材订单' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/orders/801');

    await user.click(screen.getAllByRole('button', { name: /我卖出的/ })[0]!);
    await user.click(screen.getByRole('button', { name: '切到已结束' }));
    expect(await screen.findByText('我卖出的相机')).toBeInTheDocument();
  });

  it('opens profile editor, uploads avatar, navigates to credit center and handles provider actions', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '编辑资料' }).length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByRole('button', { name: '编辑资料' })[0]!);
    expect(await screen.findByText('基础信息')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '上传自定义头像' }));
    expect(await screen.findByText('头像上传')).toBeInTheDocument();

    mocks.uploadImageAsset.mockResolvedValueOnce({ url: '/uploaded-avatar.png' });
    await user.click(screen.getByRole('button', { name: '确认上传头像' }));
    await waitFor(() => {
      expect(mocks.uploadImageAsset).toHaveBeenCalledWith(expect.any(File), 'avatar');
      expect(mocks.formInstance.setFieldValue).toHaveBeenCalledWith('avatarUrl', '/uploaded-avatar.png');
      expect(mocks.success).toHaveBeenCalledWith('头像已上传，保存资料后生效');
    });

    await user.click(screen.getByRole('button', { name: '前往信用中心兑换头像框' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/credit-center');

    mocks.completeCampusServiceOrder.mockResolvedValueOnce(undefined);
    mocks.cancelCampusServiceOrder.mockResolvedValueOnce(undefined);

    await user.click(screen.getAllByRole('button', { name: /我接的单/ })[0]!);
    expect(await screen.findByText('代取快递订单')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开会话701' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/messages?conversationId=null');

    const listingsReloadBaseline = mocks.fetchCampusServiceListings.mock.calls.length;
    const ordersReloadBaseline = mocks.fetchCampusServiceOrders.mock.calls.length;

    await user.click(screen.getByRole('button', { name: '完成协作701' }));
    await waitFor(() => {
      expect(mocks.completeCampusServiceOrder).toHaveBeenCalledWith(701);
      expect(mocks.fetchCampusServiceListings.mock.calls.length).toBeGreaterThan(listingsReloadBaseline);
      expect(mocks.fetchCampusServiceOrders.mock.calls.length).toBeGreaterThan(ordersReloadBaseline);
    });

    const listingsReloadAfterComplete = mocks.fetchCampusServiceListings.mock.calls.length;
    const ordersReloadAfterComplete = mocks.fetchCampusServiceOrders.mock.calls.length;

    await user.click(screen.getByRole('button', { name: '取消协作701' }));
    await waitFor(() => {
      expect(mocks.cancelCampusServiceOrder).toHaveBeenCalledWith(701);
      expect(mocks.fetchCampusServiceListings.mock.calls.length).toBeGreaterThan(listingsReloadAfterComplete);
      expect(mocks.fetchCampusServiceOrders.mock.calls.length).toBeGreaterThan(ordersReloadAfterComplete);
    });
  });

  it('normalizes profile form values before submitting', () => {
    expect(normalizeProfileFormValues({
      displayName: '张同学',
      studentId: ' 20260008 ',
      email: 'zhang@example.com',
      realName: ' 张三 ',
      college: ' 待填写 ',
      graduationYear: 2028,
      phone: ' 待填写 ',
      avatarUrl: ' /avatar.png ',
      avatarFrame: 'none'
    })).toEqual({
      displayName: '张同学',
      studentId: '20260008',
      email: 'zhang@example.com',
      realName: '张三',
      college: undefined,
      graduationYear: 2028,
      phone: undefined,
      avatarUrl: '/avatar.png',
      avatarFrame: undefined
    });
  });
});
