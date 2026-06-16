import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OrderCheckoutPage } from './OrderCheckoutPage';

const routeState = vi.hoisted(() => ({
  searchParams: new URLSearchParams({ productId: '8' })
}));

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  useAuthState: vi.fn(),
  fetchProductDetail: vi.fn(),
  fetchCampusServiceDetail: vi.fn(),
  createOrder: vi.fn(),
  acceptCampusServiceListing: vi.fn(),
  createConversation: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback)
}));

function setSearch(next: Record<string, string>) {
  routeState.searchParams = new URLSearchParams(next);
}

function createProductDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 8,
    title: '高数教材',
    category: '教材资料',
    imageUrl: '/book.png',
    images: ['/book.png'],
    publishedAt: '2026-06-16T08:30:00.000Z',
    seller: {
      id: 2,
      displayName: '卖家甲',
      trustedBadgeUnlocked: true,
      creditScore: 91,
      verificationStatus: 'APPROVED',
      college: '信息学院',
      email: 'seller@bjfu.edu.cn'
    },
    detailBase: {
      amountLabel: '¥18.00',
      metaItems: [
        { key: 'category', label: '分类', value: '教材资料' }
      ]
    },
    ...overrides
  } as any;
}

function createServiceDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 18,
    title: '代取快递',
    categoryLabel: '校园跑腿',
    reward: 8,
    rewardLabel: '¥8.00',
    imageUrl: '/service.png',
    images: ['/service.png'],
    createdAt: '2026-06-16T09:00:00.000Z',
    intent: 'REQUEST',
    autoConfirm: false,
    contactPreferenceLabel: '站内私信',
    conversationId: 66,
    publisher: {
      id: 3,
      displayName: '发布者乙',
      trustedBadgeUnlocked: false,
      creditScore: 85,
      verificationStatus: 'APPROVED',
      college: '工学院',
      email: 'publisher@bjfu.edu.cn'
    },
    fulfillment: {
      deadlineLabel: '今天 18:00',
      modeLabel: '送达宿舍'
    },
    detailBase: {
      images: ['/service.png']
    },
    ...overrides
  } as any;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OrderCheckoutPage />
    </MemoryRouter>
  );
}

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      success: mocks.messageSuccess,
      error: mocks.messageError
    }
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [routeState.searchParams, vi.fn()]
  };
});

vi.mock('../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../services/session', () => ({
  hasTradingAccess: (user: any) => user?.role === 'USER',
  isGuestUser: (user: any) => user?.role === 'GUEST'
}));

vi.mock('../services/api', () => ({
  fetchProductDetail: (id: number) => mocks.fetchProductDetail(id),
  fetchCampusServiceDetail: (id: number) => mocks.fetchCampusServiceDetail(id),
  createOrder: (payload: unknown) => mocks.createOrder(payload),
  acceptCampusServiceListing: (listingId: number, payload: unknown) => mocks.acceptCampusServiceListing(listingId, payload),
  createConversation: (payload: unknown) => mocks.createConversation(payload),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback)
}));

vi.mock('../components/layout', () => ({
  ActionRow: ({ leading, children, className }: any) => (
    <div className={className}>
      <div>{leading}</div>
      <div>{children}</div>
    </div>
  )
}));

vi.mock('../components/ui', () => ({
  SectionCard: ({ children, className }: any) => <div className={className}>{children}</div>,
  OrderPreviewCard: ({ headerProps, beforeSummary, summaryProps }: any) => (
    <div>
      {headerProps?.copyContent}
      {headerProps?.conversationButton}
      {beforeSummary}
      <img src={summaryProps.imageSrc} alt={summaryProps.imageAlt} />
      <h1>{summaryProps.title}</h1>
      <div>{summaryProps.attrs}</div>
      <div>{summaryProps.amount}</div>
    </div>
  )
}));

vi.mock('../components/user/UserNameWithBadge', () => ({
  UserNameWithBadge: ({ as: Tag = 'span', name }: any) => <Tag>{name}</Tag>
}));

describe('OrderCheckoutPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    setSearch({ productId: '8' });

    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 1, displayName: '买家甲', role: 'USER' }
    });
    mocks.fetchProductDetail.mockResolvedValue(createProductDetail());
    mocks.fetchCampusServiceDetail.mockResolvedValue(createServiceDetail());
    mocks.createOrder.mockResolvedValue({ id: 501 });
    mocks.acceptCampusServiceListing.mockResolvedValue({ id: 601 });
    mocks.createConversation.mockResolvedValue({ id: 701 });
    mocks.getApiErrorMessage.mockImplementation((_error, fallback) => fallback);
  });

  it('loads product checkout, opens chat, submits an order and supports cancel', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('确认订单信息')).toBeInTheDocument();
    expect(screen.getByText('高数教材')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '聊一聊' }));

    await waitFor(() => {
      expect(mocks.createConversation).toHaveBeenCalledWith({ productId: 8 });
      expect(mocks.navigate).toHaveBeenCalledWith('/messages', {
        state: {
          conversationId: 701,
          channel: 'trade'
        }
      });
    });

    const noteInput = screen.getByPlaceholderText('请输入，提交后对方可见');
    await user.type(noteInput, ' 今晚图书馆东门面交 ');
    await user.click(screen.getByRole('button', { name: '确认下单' }));

    await waitFor(() => {
      expect(mocks.createOrder).toHaveBeenCalledWith({
        productId: 8,
        note: '今晚图书馆东门面交'
      });
      expect(mocks.messageSuccess).toHaveBeenCalledWith('下单成功，订单已进入待面交');
      expect(mocks.navigate).toHaveBeenCalledWith('/profile', {
        state: { section: 'orders', orderScope: 'buying' }
      });
    });

    await user.click(screen.getByRole('button', { name: /取\s*消/ }));
    expect(mocks.navigate).toHaveBeenCalledWith(-1);
  });

  it('loads service checkout, pre-fills the request note, opens chat and submits the request', async () => {
    const user = userEvent.setup();
    setSearch({ type: 'service', serviceId: '18' });
    renderPage();

    expect(await screen.findByText('确认申请信息')).toBeInTheDocument();
    expect(screen.getByText('代取快递')).toBeInTheDocument();
    expect(screen.getByDisplayValue('我来接“代取快递”，可按约定时间地点服务。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '聊一聊' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/messages?conversationId=66');

    const noteInput = screen.getByPlaceholderText('请输入，提交后对方可见');
    await user.clear(noteInput);
    await user.type(noteInput, '今晚 7 点可以处理');
    await user.click(screen.getByRole('button', { name: '确认报名接单' }));

    await waitFor(() => {
      expect(mocks.acceptCampusServiceListing).toHaveBeenCalledWith(18, {
        initialMessage: '今晚 7 点可以处理'
      });
      expect(mocks.messageSuccess).toHaveBeenCalledWith('报名成功，等待发布者确认');
      expect(mocks.navigate).toHaveBeenCalledWith('/profile', {
        state: { section: 'items', publishedScope: 'campus-services-booking' }
      });
    });
  });

  it('handles offer services with auto-confirm and warns when no conversation is available', async () => {
    const user = userEvent.setup();
    setSearch({ type: 'service', serviceId: '18' });
    mocks.fetchCampusServiceDetail.mockResolvedValueOnce(createServiceDetail({
      intent: 'OFFER',
      autoConfirm: true,
      conversationId: null
    }));

    renderPage();

    expect(await screen.findByRole('button', { name: '确认提交预约' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '聊一聊' }));
    expect(mocks.messageError).toHaveBeenCalledWith('当前服务暂时没有可用会话');

    await user.click(screen.getByRole('button', { name: '确认提交预约' }));

    await waitFor(() => {
      expect(mocks.acceptCampusServiceListing).toHaveBeenCalledWith(18, {
        initialMessage: '我想预约“代取快递”，请确认时间地点。'
      });
      expect(mocks.messageSuccess).toHaveBeenCalledWith('预约成功，已进入进行中');
    });
  });

  it('shows invalid object and load failure states', async () => {
    setSearch({ productId: 'bad' });
    const { unmount } = renderPage();

    expect(await screen.findByText('缺少有效的下单对象。')).toBeInTheDocument();
    unmount();

    setSearch({ productId: '19' });
    mocks.fetchProductDetail.mockRejectedValueOnce(new Error('boom'));
    renderPage();

    expect(await screen.findByText('下单信息加载失败。')).toBeInTheDocument();
  });

  it('guards product checkout for anonymous users', async () => {
    const user = userEvent.setup();
    mocks.useAuthState.mockReturnValue({ currentUser: null });
    renderPage();

    expect(await screen.findByText('确认订单信息')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认下单' }));

    await waitFor(() => {
      expect(mocks.messageError).toHaveBeenCalledWith('请先登录后再下单');
      expect(mocks.navigate).toHaveBeenCalledWith('/login');
      expect(mocks.createOrder).not.toHaveBeenCalled();
    });
  });

  it('guards service checkout for guest and restricted users', async () => {
    const user = userEvent.setup();

    setSearch({ type: 'service', serviceId: '18' });
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 7, displayName: '访客', role: 'GUEST' }
    });
    const firstRender = renderPage();

    expect(await screen.findByRole('button', { name: '确认报名接单' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认报名接单' }));

    await waitFor(() => {
      expect(mocks.messageError).toHaveBeenCalledWith('浏览账号不可提交申请');
      expect(mocks.navigate).toHaveBeenCalledWith('/login');
      expect(mocks.acceptCampusServiceListing).not.toHaveBeenCalled();
    });

    firstRender.unmount();
    cleanup();

    mocks.messageError.mockClear();
    mocks.navigate.mockClear();
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 8, displayName: '受限用户', role: 'RESTRICTED' }
    });

    renderPage();
    expect(await screen.findByRole('button', { name: '确认报名接单' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认报名接单' }));

    await waitFor(() => {
      expect(mocks.messageError).toHaveBeenCalledWith('当前账号不可提交申请');
      expect(mocks.acceptCampusServiceListing).not.toHaveBeenCalled();
    });
  });

  it('shows product chat and submit errors', async () => {
    const user = userEvent.setup();
    mocks.createConversation.mockRejectedValueOnce(new Error('chat failed'));
    mocks.createOrder.mockRejectedValueOnce(new Error('submit failed'));
    renderPage();

    expect(await screen.findByText('确认订单信息')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '聊一聊' }));
    await waitFor(() => {
      expect(mocks.messageError).toHaveBeenCalledWith('打开会话失败，请稍后重试。');
    });

    await user.click(screen.getByRole('button', { name: '确认下单' }));
    await waitFor(() => {
      expect(mocks.messageError).toHaveBeenCalledWith('下单失败，请稍后重试。');
    });
  });

  it('shows service submit errors', async () => {
    const user = userEvent.setup();
    setSearch({ type: 'service', serviceId: '18' });
    mocks.acceptCampusServiceListing.mockRejectedValueOnce(new Error('service submit failed'));
    renderPage();

    expect(await screen.findByRole('button', { name: '确认报名接单' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认报名接单' }));

    await waitFor(() => {
      expect(mocks.messageError).toHaveBeenCalledWith('提交申请失败，请稍后重试。');
    });
  });
});
