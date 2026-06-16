import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CampusServiceOrderCard,
  CampusServicePublisherOrderWorkbench,
  ListingDetailHero,
  ListingDetailMetaPanel,
  ListingDetailTagPanel,
  ListingDetailTimelinePanel,
  ProductOrderCard
} from '.';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  fetchCampusServiceOrders: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  getProductImage: vi.fn(() => '/generated-product.png'),
  resolvePrimaryProductImage: vi.fn(() => '/generated-service.png'),
  getUserPresentation: vi.fn((user: any) => ({
    displayName: user?.displayName ?? '默认用户',
    initial: (user?.displayName ?? '默').slice(0, 1),
    avatarUrl: user?.avatarUrl ?? null,
    avatarFrame: user?.avatarFrame ?? null,
    trustedBadgeUnlocked: Boolean(user?.trustedBadgeUnlocked),
    collegeLabel: user?.college ?? '同校用户',
    emailLabel: user?.email ?? 'user@example.com',
    creditScore: user?.creditScore ?? 80,
    creditBadge: {
      label: user?.creditScore && user.creditScore >= 90 ? '信用优秀' : '信用稳定',
      score: user?.creditScore ?? 80,
      tone: user?.creditScore && user.creditScore >= 90 ? 'excellent' : 'stable'
    },
    verificationLabel: '已实名',
    publicIdentityLabel: '实名认证'
  })),
  formatProductOrderStatus: vi.fn((status: string) => `状态:${status}`),
  getProductOrderStatusColor: vi.fn(() => 'blue')
}));

vi.mock('@ant-design/icons', () => ({
  EnvironmentOutlined: () => <span>ENV_ICON</span>,
  MessageOutlined: () => <span>MSG_ICON</span>
}));

vi.mock('antd', () => {
  const Button = ({ children, onClick, icon, loading, danger, type, className, ...props }: any) => (
    <button
      type="button"
      className={className}
      data-loading={loading ? 'true' : 'false'}
      data-danger={danger ? 'true' : 'false'}
      data-type={type ?? ''}
      onClick={onClick}
      {...props}
    >
      {icon}
      {children}
    </button>
  );

  const Tag = ({ children, color }: any) => <span data-testid="tag" data-color={color}>{children}</span>;

  const EmptyComponent = ({ description }: any) => <div>{description}</div>;
  (EmptyComponent as any).PRESENTED_IMAGE_SIMPLE = 'simple';

  const Pagination = ({ current, onChange }: any) => (
    <button type="button" onClick={() => onChange(current + 1)}>
      {`翻页到 ${current + 1}`}
    </button>
  );

  const Skeleton = () => <div>loading skeleton</div>;

  return {
    Button,
    Empty: EmptyComponent,
    Pagination,
    Skeleton,
    Tag
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate
  };
});

vi.mock('../../services/api', () => ({
  fetchCampusServiceOrders: (...args: any[]) => mocks.fetchCampusServiceOrders(...args),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback)
}));

vi.mock('../../utils/productCover', () => ({
  getProductImage: (...args: any[]) => mocks.getProductImage(...args),
  resolvePrimaryProductImage: (...args: any[]) => mocks.resolvePrimaryProductImage(...args)
}));

vi.mock('../../utils/userPresentation', () => ({
  getUserPresentation: (user: any) => mocks.getUserPresentation(user)
}));

vi.mock('../../utils/orderStatus', () => ({
  formatProductOrderStatus: (status: string) => mocks.formatProductOrderStatus(status),
  getProductOrderStatusColor: (status: string) => mocks.getProductOrderStatusColor(status)
}));

vi.mock('../data-display', () => ({
  KeyValueGrid: ({ items, className, columns, emphasizeValue }: any) => (
    <div className={className} data-columns={columns == null ? '' : String(columns)} data-emphasis={String(Boolean(emphasizeValue))}>
      {items.map((item: any) => (
        <div key={item.key}>
          <span>{item.label}</span>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  ),
  StatusBadge: ({ children, tone, className }: any) => <span className={className} data-tone={tone}>{children}</span>,
  TagList: ({ items, className, compact }: any) => (
    <div className={className} data-compact={String(Boolean(compact))}>
      {items.map((item: any) => (
        <span key={item.key}>{item.label}</span>
      ))}
    </div>
  )
}));

vi.mock('../ui', () => ({
  OrderPreviewCard: ({ articleClassName, cardClassName, headerProps, summaryProps, beforeSummary, afterSummary }: any) => {
    const content = (
      <div className={cardClassName}>
        {headerProps ? (
          <div data-testid="preview-header">
            <div className={headerProps.copyClassName}>{headerProps.copyContent}</div>
            <div className={headerProps.actionsClassName}>
              {headerProps.conversationButton}
              <span>{headerProps.creditLabel}</span>
            </div>
          </div>
        ) : null}
        {beforeSummary}
        <div className={summaryProps.className}>
          <img src={summaryProps.imageSrc} alt={summaryProps.imageAlt} />
          <div className={summaryProps.copyClassName}>
            {typeof summaryProps.title === 'string' ? <h3>{summaryProps.title}</h3> : summaryProps.title}
            {summaryProps.subtitle}
          </div>
          <div className={summaryProps.attrsClassName}>{summaryProps.attrs}</div>
          <div className={summaryProps.amountClassName}>{summaryProps.amount}</div>
          <div className={summaryProps.actionsClassName}>{summaryProps.actions}</div>
        </div>
        {afterSummary}
      </div>
    );

    return articleClassName ? <article className={articleClassName}>{content}</article> : content;
  },
  ProfileOrderIdentity: ({ avatarAlt, fallbackLabel, name, statusTag }: any) => (
    <div>
      <span>{avatarAlt}</span>
      <span>{fallbackLabel}</span>
      <span>{name}</span>
      {statusTag}
    </div>
  )
}));

vi.mock('../user/UserAvatar', () => ({
  UserAvatar: ({ alt, fallbackLabel }: any) => <span>{alt ?? fallbackLabel ?? 'avatar'}</span>
}));

vi.mock('../user/UserNameWithBadge', () => ({
  UserNameWithBadge: ({ name }: any) => <span>{name}</span>
}));

function createListingDetailBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    title: '代取快递',
    description: '从东门取件后送到宿舍楼下',
    amountLabel: '¥8',
    statusLabel: '待确认',
    type: 'CAMPUS_SERVICE',
    summaryTags: ['跑腿', '东门取件'],
    metaItems: [
      { key: 'route', label: '路线', value: '东门 -> 13号公寓' },
      { key: 'deadline', label: '截止', value: '今天 18:00' }
    ],
    timeline: [
      { key: 'created', label: '创建', value: '06-16 10:00' },
      { key: 'published', label: '发布', value: '06-16 10:05' },
      { key: 'updated', label: '更新', value: '06-16 10:10' },
      { key: 'deadline', label: '截止', value: '06-16 18:00' }
    ],
    publisher: {
      id: 9,
      displayName: '王同学'
    },
    ...overrides
  } as any;
}

function createProductOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 18,
    orderCode: 'ORD-18',
    productId: 201,
    buyerId: 1,
    sellerId: 2,
    status: 'IN_PROGRESS',
    meetupLocation: '图书馆东门',
    note: '晚饭后交易',
    paymentIntent: '线下面交',
    createdAt: '2026-06-16T10:00:00.000Z',
    updatedAt: '2026-06-16T10:00:00.000Z',
    productTitle: '高数教材',
    productPrice: 18,
    productCategory: '教材资料',
    productCondition: '九成新',
    productStatus: 'ON_SALE',
    productImageUrl: '/book.png',
    conversationId: 91,
    buyerName: '买家甲',
    buyerAvatarUrl: '/buyer.png',
    buyerAvatarFrame: 'aurora',
    buyerTrustedBadgeUnlocked: false,
    buyerCreditScore: 78,
    buyerVerified: true,
    sellerName: '卖家乙',
    sellerAvatarUrl: '/seller.png',
    sellerAvatarFrame: 'gold-ring',
    sellerTrustedBadgeUnlocked: true,
    sellerCreditScore: 93,
    sellerVerified: true,
    ...overrides
  } as any;
}

function createCampusServiceOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 701,
    listingId: 401,
    title: '代取快递订单',
    description: '从东门送到 13 号公寓',
    price: 8,
    imageUrl: '/service.png',
    tags: ['跑腿'],
    status: 'PENDING_CONFIRMATION',
    statusLabel: '待确认',
    orderStatus: 'PENDING_CONFIRMATION',
    orderStatusLabel: '待确认',
    listingStatus: 'OPEN',
    listingStatusLabel: '开放中',
    intent: 'REQUEST',
    intentLabel: '需求',
    category: 'ERRAND',
    categoryLabel: '跑腿代办',
    reward: 8,
    rewardLabel: '¥8',
    route: {
      from: '东门',
      to: '13号公寓',
      label: '东门 -> 13号公寓'
    },
    deadlineLabel: '今天 18:00',
    estimatedMinutes: 20,
    role: 'PROVIDER',
    roleLabel: '接单方',
    summaryTags: ['跑腿', '接单'],
    actionState: {
      canComplete: true,
      canCancel: true,
      canOpenConversation: true,
      canConfirm: true,
      canReject: true
    },
    actionLabels: {
      confirm: '确认协作',
      reject: '拒绝申请',
      complete: '提交进度',
      cancel: '取消协作',
      conversation: '看消息'
    },
    conversationId: 990,
    counterpart: {
      id: 8,
      displayName: '李同学',
      avatarUrl: '/counterpart.png',
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      creditScore: 90,
      college: '信息学院'
    },
    publisher: {
      id: 8,
      displayName: '李同学',
      avatarUrl: '/counterpart.png',
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      creditScore: 90,
      college: '信息学院'
    },
    createdAt: '2026-06-16T10:00:00.000Z',
    updatedAt: '2026-06-16T10:00:00.000Z',
    ...overrides
  } as any;
}

describe('listing components', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders listing detail hero, meta, tag and timeline panels', () => {
    const detail = createListingDetailBase();
    const { container } = render(
      <div>
        <ListingDetailHero
          detail={detail}
          statusTone="warning"
          amountAside="总价"
          metrics={<span>2 人咨询</span>}
          titleAs="h2"
          className="hero-x"
        />
        <ListingDetailMetaPanel
          detail={detail}
          extraItems={[{ key: 'trust', label: '信用', value: '信用稳定' }]}
          className="meta-x"
        />
        <ListingDetailTagPanel
          detail={detail}
          extraTags={[{ key: 't-extra', label: '支持加急' }]}
          className="tags-x"
        />
        <ListingDetailTimelinePanel
          detail={detail}
          className="timeline-x"
        />
      </div>
    );

    expect(screen.getByRole('heading', { name: '代取快递' })).toBeInTheDocument();
    expect(screen.getByText('待确认')).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByText('¥8')).toBeInTheDocument();
    expect(screen.getByText('总价')).toBeInTheDocument();
    expect(screen.getByText('从东门取件后送到宿舍楼下')).toBeInTheDocument();
    expect(screen.getByText('2 人咨询')).toBeInTheDocument();
    expect(screen.getByText('路线')).toBeInTheDocument();
    expect(screen.getByText('东门 -> 13号公寓')).toBeInTheDocument();
    expect(screen.getByText('信用稳定')).toBeInTheDocument();
    expect(screen.getByText('跑腿')).toBeInTheDocument();
    expect(screen.getByText('支持加急')).toBeInTheDocument();
    expect(container.querySelector('.hero-x')).toBeTruthy();
    expect(container.querySelector('.meta-x')).toHaveAttribute('data-emphasis', 'true');
    expect(container.querySelector('.tags-x')).toHaveAttribute('data-compact', 'true');
    expect(container.querySelector('.timeline-x')).toHaveAttribute('data-columns', '4');

    render(<ListingDetailHero detail={detail} showStatus={false} />);
    expect(screen.queryByText('待确认')).not.toBeNull();
  });

  it('renders product order cards for buyer and seller contexts', () => {
    const onOpenConversation = vi.fn();
    const onViewDetail = vi.fn();
    const buyerViewOrder = createProductOrder();
    const sellerViewOrder = createProductOrder({
      productImageUrl: null,
      productPrice: null,
      buyerId: 3,
      sellerId: 2
    });

    const { rerender } = render(
      <ProductOrderCard
        order={buyerViewOrder}
        currentUserId={1}
        onOpenConversation={onOpenConversation}
        onViewDetail={onViewDetail}
      />
    );

    expect(screen.getByText('卖家乙')).toBeInTheDocument();
    expect(screen.getByText('状态:IN_PROGRESS')).toHaveAttribute('data-color', 'blue');
    expect(screen.getByText('信用优秀')).toBeInTheDocument();
    expect(screen.getByAltText('高数教材')).toHaveAttribute('src', '/book.png');
    expect(screen.getByText('订单编号：ORD-18')).toBeInTheDocument();
    expect(screen.getByText('¥18.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看聊天' }));
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));

    expect(onOpenConversation).toHaveBeenCalledWith(buyerViewOrder);
    expect(onViewDetail).toHaveBeenCalledWith(buyerViewOrder);

    rerender(
      <ProductOrderCard
        order={sellerViewOrder}
        currentUserId={2}
      />
    );

    expect(screen.getByText('买家甲')).toBeInTheDocument();
    expect(screen.getByText('价格待确认')).toBeInTheDocument();
    expect(screen.getByAltText('高数教材')).toHaveAttribute('src', '/generated-product.png');
    expect(mocks.getProductImage).toHaveBeenCalled();
  });

  it('renders campus service order cards in compact and full layouts', () => {
    const onOpenConversation = vi.fn();
    const onConfirm = vi.fn();
    const onReject = vi.fn();
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const onViewDetail = vi.fn();
    const compactOrder = createCampusServiceOrder();
    const fullOrder = createCampusServiceOrder({
      id: 702,
      title: '代打印资料',
      orderStatus: 'CONFIRMED',
      orderStatusLabel: '进行中',
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
        conversation: '看消息'
      }
    });

    const { rerender } = render(
      <CampusServiceOrderCard
        order={compactOrder}
        actingOrderId={701}
        layout="compact"
        onOpenConversation={onOpenConversation}
        onConfirm={onConfirm}
        onReject={onReject}
        onComplete={onComplete}
        onCancel={onCancel}
        onViewDetail={onViewDetail}
      />
    );

    expect(screen.getByText('李同学')).toBeInTheDocument();
    expect(screen.getByText('信用优秀')).toBeInTheDocument();
    expect(screen.getByAltText('代取快递订单')).toHaveAttribute('src', '/generated-service.png');
    expect(screen.getByText('东门 -> 13号公寓')).toBeInTheDocument();
    expect(screen.getByText('¥8')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看聊天' }));
    fireEvent.click(screen.getByRole('button', { name: '取消协作' }));
    fireEvent.click(screen.getByRole('button', { name: '提交进度' }));
    fireEvent.click(screen.getByRole('button', { name: '确认协作' }));
    fireEvent.click(screen.getByRole('button', { name: '拒绝申请' }));
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));

    expect(onOpenConversation).toHaveBeenCalledWith(compactOrder);
    expect(onCancel).toHaveBeenCalledWith(compactOrder);
    expect(onComplete).toHaveBeenCalledWith(compactOrder);
    expect(onConfirm).toHaveBeenCalledWith(compactOrder);
    expect(onReject).toHaveBeenCalledWith(compactOrder);
    expect(onViewDetail).toHaveBeenCalledWith(compactOrder);

    rerender(
      <CampusServiceOrderCard
        order={fullOrder}
        detailButtonLabel="打开详情"
        onOpenConversation={onOpenConversation}
        onViewDetail={onViewDetail}
      />
    );

    expect(screen.getByText('代打印资料')).toBeInTheDocument();
    expect(screen.getByText('接单方 · 对方 李同学')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toHaveAttribute('data-color', 'blue');
    expect(screen.getByText('方向')).toBeInTheDocument();
    expect(screen.getByText('分类')).toBeInTheDocument();
    expect(screen.getByText('金额')).toBeInTheDocument();
    expect(screen.getByText('截止')).toBeInTheDocument();
    expect(screen.getByText('预计 20 分钟')).toBeInTheDocument();
    expect(screen.getByText('看消息')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开详情' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /看消息/ }));
    fireEvent.click(screen.getByRole('button', { name: '打开详情' }));

    expect(onOpenConversation).toHaveBeenCalledWith(fullOrder);
    expect(onViewDetail).toHaveBeenCalledWith(fullOrder);
  });

  it('loads publisher workbench orders, switches tabs, paginates and handles errors', async () => {
    const listing = {
      id: 401,
      title: '代取快递'
    } as any;
    const onError = vi.fn();
    const initialOrder = createCampusServiceOrder();
    const activeOrder = createCampusServiceOrder({
      id: 703,
      title: '代送文件',
      orderStatus: 'CONFIRMED',
      orderStatusLabel: '进行中'
    });

    mocks.fetchCampusServiceOrders
      .mockResolvedValueOnce({
        items: [initialOrder],
        pagination: { page: 1, pageSize: 6, total: 8, totalPages: 2 }
      })
      .mockResolvedValueOnce({
        items: [activeOrder],
        pagination: { page: 1, pageSize: 6, total: 1, totalPages: 1 }
      })
      .mockResolvedValueOnce({
        items: [initialOrder],
        pagination: { page: 1, pageSize: 6, total: 8, totalPages: 2 }
      })
      .mockResolvedValueOnce({
        items: [initialOrder],
        pagination: { page: 2, pageSize: 6, total: 8, totalPages: 2 }
      })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        items: [],
        pagination: { page: 1, pageSize: 6, total: 0, totalPages: 0 }
      });

    const { rerender } = render(
      <CampusServicePublisherOrderWorkbench
        listing={listing}
        onError={onError}
        onConfirmOrder={vi.fn()}
        onRejectOrder={vi.fn()}
        onCompleteOrder={vi.fn()}
        onCancelOrder={vi.fn()}
      />
    );

    expect(screen.getByText('loading skeleton')).toBeInTheDocument();
    expect(await screen.findByText('代取快递订单')).toBeInTheDocument();
    expect(screen.getByText('申请与预约管理')).toBeInTheDocument();
    expect(screen.getByText('8 单')).toBeInTheDocument();
    expect(mocks.fetchCampusServiceOrders).toHaveBeenNthCalledWith(1, {
      listingId: 401,
      group: 'PENDING',
      page: 1,
      pageSize: 6
    });

    fireEvent.click(screen.getByRole('button', { name: /看消息/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/messages?conversationId=990');

    fireEvent.click(screen.getByRole('button', { name: '进行中' }));
    await waitFor(() => {
      expect(mocks.fetchCampusServiceOrders).toHaveBeenNthCalledWith(2, {
        listingId: 401,
        group: 'ACTIVE',
        page: 1,
        pageSize: 6
      });
    });
    expect(await screen.findByText('代送文件')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '待确认' }));
    await waitFor(() => {
      expect(mocks.fetchCampusServiceOrders).toHaveBeenNthCalledWith(3, {
        listingId: 401,
        group: 'PENDING',
        page: 1,
        pageSize: 6
      });
    });

    fireEvent.click(screen.getByRole('button', { name: '翻页到 2' }));
    await waitFor(() => {
      expect(mocks.fetchCampusServiceOrders).toHaveBeenNthCalledWith(4, {
        listingId: 401,
        group: 'PENDING',
        page: 2,
        pageSize: 6
      });
    });

    rerender(
      <CampusServicePublisherOrderWorkbench
        listing={{ ...listing, id: 402 }}
        onError={onError}
        onConfirmOrder={vi.fn()}
        onRejectOrder={vi.fn()}
        onCompleteOrder={vi.fn()}
        onCancelOrder={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mocks.fetchCampusServiceOrders).toHaveBeenNthCalledWith(5, {
        listingId: 402,
        group: 'PENDING',
        page: 2,
        pageSize: 6
      });
      expect(mocks.fetchCampusServiceOrders).toHaveBeenNthCalledWith(6, {
        listingId: 402,
        group: 'PENDING',
        page: 1,
        pageSize: 6
      });
    });
    expect(screen.getByText('当前筛选下还没有相关申请或预约记录。')).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
  });
});
