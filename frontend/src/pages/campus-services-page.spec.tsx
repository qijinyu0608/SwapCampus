import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CampusServicesPage } from './CampusServicesPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  fetchCampusServiceListings: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  useAuthState: vi.fn(),
  animate: vi.fn(async () => undefined),
  stop: vi.fn()
}));

function createListing(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: '代取快递',
    description: '今天下午可送到宿舍',
    category: 'ERRAND',
    categoryLabel: '跑腿代办',
    intent: 'REQUEST',
    intentLabel: '需求',
    pattern: 'ONE_TIME',
    serviceType: { key: 'ERRAND', label: '跑腿代办' },
    imageUrl: '/service.png',
    price: 8,
    reward: 8,
    rewardLabel: '¥8',
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
    summaryTags: ['跑腿', '送达'],
    participantSummary: { publisherLabel: '发布者', participantLabel: null },
    viewerContext: {} as any,
    actionState: {
      isPublisher: false,
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
      id: 2,
      displayName: '发布者',
      studentId: '202600002',
      email: 'publisher@example.com',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      creditScore: 90,
      verificationStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      college: '信息学院',
      averageRating: null,
      completedOrders: 3
    },
    participant: null,
    ...overrides
  } as any;
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate
  };
});

vi.mock('react-peel', () => ({
  PeelBack: ({ children }: any) => <div>{children}</div>,
  PeelBottom: ({ children }: any) => <div>{children}</div>,
  PeelTop: ({ children }: any) => <div>{children}</div>,
  PeelWrapper: ({ children }: any) => <div>{children}</div>,
  usePeel: () => ({
    peelRef: { current: null },
    animate: mocks.animate,
    stop: mocks.stop
  })
}));

vi.mock('../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../services/api', () => ({
  fetchCampusServiceListings: (params: unknown) => mocks.fetchCampusServiceListings(params),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback)
}));

vi.mock('../components/feedback', () => ({
  EmptyState: ({ title, description }: any) => <div><span>{title}</span><span>{description}</span></div>
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
  ),
  ResultFilterBar: (props: any) => (
    <div>
      <button type="button" onClick={() => props.onSortChange('price_desc')}>价格降序</button>
      <button type="button" onClick={() => props.onCategoryToggle(props.categoryOptions[0].key)}>切换分类</button>
      {props.categoryOptions.some((option: any) => option.key === 'GROUP_BUY') ? (
        <button
          type="button"
          onClick={() => props.onCategoryToggle('GROUP_BUY')}
        >
          切换拼单
        </button>
      ) : null}
      <button type="button" onClick={() => props.onCreditToggle(props.creditOptions[0].key)}>切换信用</button>
      <button type="button" onClick={() => props.onMinPriceChange(6)}>最低价 6</button>
      <button type="button" onClick={() => props.onMaxPriceChange(20)}>最高价 20</button>
      {props.leadingContent}
    </div>
  )
}));

describe('CampusServicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 1, displayName: '当前用户', role: 'USER' }
    });
    mocks.fetchCampusServiceListings.mockResolvedValue({
      items: [createListing()],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 }
    });
    mocks.getApiErrorMessage.mockImplementation((_error, fallback) => fallback);
  });

  it('loads listings, supports search and applies filter changes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CampusServicesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('代取快递')).toBeInTheDocument();
    expect(mocks.fetchCampusServiceListings).toHaveBeenCalledWith(expect.objectContaining({
      intent: 'REQUEST',
      status: 'OPEN',
      sort: 'composite',
      page: 1,
      pageSize: 12
    }));

    await user.type(screen.getByPlaceholderText('搜索路线、地点、任务'), '图书馆{enter}');
    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenLastCalledWith(expect.objectContaining({
        keyword: '图书馆'
      }));
    });

    await user.click(screen.getByRole('button', { name: '我要接单挣钱' }));
    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenLastCalledWith(expect.objectContaining({
        intent: 'OFFER'
      }));
    });

    await user.click(screen.getByRole('button', { name: '价格降序' }));
    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenLastCalledWith(expect.objectContaining({
        sort: 'price_desc'
      }));
    });

    await user.click(screen.getByRole('button', { name: '切换分类' }));
    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenLastCalledWith(expect.objectContaining({
        categories: ['ERRAND']
      }));
    });

    await user.click(screen.getByRole('button', { name: '切换信用' }));
    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenLastCalledWith(expect.objectContaining({
        credit: ['EXCELLENT']
      }));
    });

    await user.click(screen.getByRole('button', { name: '最低价 6' }));
    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenLastCalledWith(expect.objectContaining({
        minReward: 6
      }));
    });

    await user.click(screen.getByRole('button', { name: '最高价 20' }));
    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenLastCalledWith(expect.objectContaining({
        minReward: 6,
        maxReward: 20
      }));
    });

    await user.click(screen.getByRole('button', { name: /代取快递/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/1');
  });

  it('shows an error message when loading fails', async () => {
    mocks.fetchCampusServiceListings.mockRejectedValueOnce(new Error('backend down'));

    render(
      <MemoryRouter>
        <CampusServicesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('校园服务加载失败，请确认 Docker 后端已启动。')).toBeInTheDocument();
  });

  it('shows the empty state when no listings are returned', async () => {
    mocks.fetchCampusServiceListings.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0 }
    });

    render(
      <MemoryRouter>
        <CampusServicesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('暂无任务')).toBeInTheDocument();
  });

  it('discovers group-buy listings through the category filter', async () => {
    const user = userEvent.setup();
    mocks.fetchCampusServiceListings.mockImplementation(async (params: any) => {
      if (Array.isArray(params?.categories) && params.categories.includes('GROUP_BUY')) {
        return {
          items: [
            createListing({
              id: 2,
              title: '校内午餐拼单',
              description: '中午一起拼轻食外卖',
              category: 'GROUP_BUY',
              categoryLabel: '拼单',
              serviceType: { key: 'GROUP_BUY', label: '拼单' },
              price: 1,
              reward: 1,
              rewardLabel: '¥1',
              route: { from: '线上', to: '线上', label: '群里确认后统一下单' },
              schedule: {
                deadlineLabel: '今天 12:00',
                estimatedMinutes: 15,
                urgency: 'NORMAL',
                urgencyLabel: '普通',
                summary: '午饭前拼单'
              },
              urgency: 'NORMAL',
              urgencyLabel: '普通',
              estimatedMinutes: 15,
              summaryTags: ['拼单', '午餐']
            })
          ],
          pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 }
        };
      }

      return {
        items: [createListing()],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 }
      };
    });

    render(
      <MemoryRouter>
        <CampusServicesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('代取快递')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '切换拼单' }).at(-1)!);

    await waitFor(() => {
      expect(mocks.fetchCampusServiceListings).toHaveBeenLastCalledWith(expect.objectContaining({
        categories: ['GROUP_BUY']
      }));
    });
    expect(await screen.findByText('校内午餐拼单')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /校内午餐拼单/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/2');
  });
});
