import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OrderDetailPage } from './OrderDetailPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { id: '18' },
  success: vi.fn(),
  error: vi.fn(),
  fetchOrderDetail: vi.fn(),
  completeOrderMeetup: vi.fn(),
  createOrderReview: vi.fn(),
  createOrderAppeal: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  useAuthState: vi.fn()
}));

function createOrderDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 18,
    orderCode: 'ORD-18',
    productId: 7,
    buyerId: 1,
    sellerId: 2,
    status: 'IN_PROGRESS',
    meetupLocation: '图书馆东门',
    note: '晚饭后交易',
    paymentIntent: '线下面交后付款',
    autoConfirmAt: '2026-06-16T18:00:00.000Z',
    autoConfirmCountdownSeconds: 7200,
    canBuyerComplete: true,
    canReview: true,
    createdAt: '2026-06-16T10:00:00.000Z',
    updatedAt: '2026-06-16T10:00:00.000Z',
    productTitle: '高数教材',
    productPrice: 18,
    productCategory: '教材资料',
    productCondition: '九成新',
    productStatus: 'ON_SALE',
    productImageUrl: '/book.png',
    conversationId: 81,
    buyerName: '买家甲',
    buyerCreditScore: 90,
    buyerVerified: true,
    sellerName: '卖家乙',
    sellerTrustedBadgeUnlocked: true,
    sellerCreditScore: 95,
    sellerVerified: true,
    completedAt: null,
    canceledAt: null,
    orderSnapshot: {
      productId: 7,
      title: '高数教材',
      description: '九成新，带笔记',
      price: 18,
      category: '教材资料',
      condition: '九成新',
      imageUrl: '/book.png',
      sellerId: 2,
      sellerName: '卖家乙'
    },
    timeline: [
      { label: '下单时间', value: '06-16 10:00' },
      { label: '自动确认', value: '06-16 18:00' }
    ],
    reviews: [],
    appeals: [],
    actionState: {
      canComplete: true,
      canReview: true,
      canAppeal: true,
      canOpenConversation: true
    },
    ...overrides
  } as any;
}

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    Rate: ({ value = 0, onChange }: any) => (
      <div>
        {Array.from({ length: 5 }, (_, index) => {
          const score = index + 1;
          return (
            <button key={score} type="button" onClick={() => onChange?.(score)}>
              {value === score ? `已选 ${score}` : `${score} 星`}
            </button>
          );
        })}
      </div>
    ),
    Select: ({ options = [], value = '', onChange }: any) => (
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
        <option value="">请选择</option>
        {options.map((option: any) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    ),
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
    useParams: () => mocks.params
  };
});

vi.mock('../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../services/api', () => ({
  fetchOrderDetail: (id: number) => mocks.fetchOrderDetail(id),
  completeOrderMeetup: (id: number) => mocks.completeOrderMeetup(id),
  createOrderReview: (id: number, payload: unknown) => mocks.createOrderReview(id, payload),
  createOrderAppeal: (id: number, payload: unknown) => mocks.createOrderAppeal(id, payload),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback)
}));

vi.mock('../components/layout', () => ({
  SectionHeader: ({ title }: any) => <div><h1>{title}</h1></div>
}));

vi.mock('../components/ui', () => ({
  SectionCard: ({ children }: any) => <div>{children}</div>,
  FormActionModal: ({ title, open, onSubmit, onCancel, children }: any) => open ? (
    <div>
      <h2>{title}</h2>
      {children}
      <button type="button" onClick={onSubmit}>确认{title}</button>
      <button type="button" onClick={onCancel}>关闭{title}</button>
    </div>
  ) : null,
  OrderDetailHeroSection: ({ title, counterpartName, amountLabel }: any) => <div><span>{title}</span><span>{counterpartName}</span><span>{amountLabel}</span></div>,
  OrderDetailToolbarSection: ({ children, extra }: any) => <div>{children}{extra}</div>,
  OrderDetailDescriptionsSection: ({ title, items }: any) => <div><span>{title}</span>{items.map((item: any) => <span key={item.key}>{item.value}</span>)}</div>,
  OrderDetailEntrySection: ({ title, subtitle, meta, onClick }: any) => <button type="button" onClick={onClick}>{title}{subtitle}{meta}</button>
}));

vi.mock('../components/user/UserReviewCard', () => ({
  UserReviewCard: ({ reviewerName, content }: any) => <div>{reviewerName}:{content}</div>
}));

vi.mock('../components/user/UserNameWithBadge', () => ({
  UserNameWithBadge: ({ as: Tag = 'span', name }: any) => <Tag>{name}</Tag>
}));

describe('OrderDetailPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.params = { id: '18' };
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 1, displayName: '买家甲', role: 'USER' }
    });
    mocks.fetchOrderDetail.mockResolvedValue(createOrderDetail());
    mocks.completeOrderMeetup.mockResolvedValue(undefined);
    mocks.createOrderReview.mockResolvedValue(undefined);
    mocks.createOrderAppeal.mockResolvedValue(undefined);
    mocks.getApiErrorMessage.mockImplementation((_error, fallback) => fallback);
  });

  it('loads the order, confirms receipt and opens the snapshot page', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OrderDetailPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('高数教材')).toBeInTheDocument();
    expect(screen.getByText('卖家乙')).toBeInTheDocument();
    expect(screen.getByText('自动确认收货倒计时')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '确认收货' }));

    await waitFor(() => {
      expect(mocks.completeOrderMeetup).toHaveBeenCalledWith(18);
      expect(mocks.success).toHaveBeenCalledWith('已确认收货，订单进入待评价');
    });

    await user.click(screen.getByRole('button', { name: /商品快照/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/orders/18/snapshot');
  });

  it('submits a review and an appeal', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OrderDetailPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('订单评价')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '评价订单' })[0]);
    const reviewModal = await screen.findByRole('heading', { name: '评价订单' });
    expect(reviewModal).toBeInTheDocument();
    const reviewButtons = screen.getAllByRole('button', { name: '5 星' });
    reviewButtons.forEach((button) => fireEvent.click(button));
    await user.type(screen.getByPlaceholderText('可以补充描述交易过程、面交体验或其他细节'), '很顺利');
    await user.click(screen.getByRole('button', { name: '确认评价订单' }));

    await waitFor(() => {
      expect(mocks.createOrderReview).toHaveBeenCalledWith(18, expect.objectContaining({
        rating: 5,
        content: expect.stringContaining('综合评分：5.00 分')
      }));
      expect(mocks.success).toHaveBeenCalledWith('评价已提交');
    });

    await user.click(screen.getByRole('button', { name: /申\s*诉/ }));
    const appealModal = await screen.findByText('提交申诉');
    expect(appealModal).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox'), '未按约定交付');
    const [expectedActionInput, reasonInput] = screen.getAllByRole('textbox');
    await user.type(expectedActionInput, '请平台核查');
    await user.type(reasonInput, '对方迟到且未提前说明');
    await user.click(screen.getByRole('button', { name: '确认提交申诉' }));

    await waitFor(() => {
      expect(mocks.createOrderAppeal).toHaveBeenCalledWith(18, expect.objectContaining({
        reason: '对方迟到且未提前说明',
        expectedAction: '请平台核查'
      }));
      expect(mocks.success).toHaveBeenCalledWith('申诉已提交');
    });
  });

  it('shows an error state for invalid ids and failed loads', async () => {
    mocks.params = { id: 'bad' };
    const { rerender } = render(
      <MemoryRouter>
        <OrderDetailPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('缺少有效订单编号。')).toBeInTheDocument();

    mocks.params = { id: '19' };
    mocks.fetchOrderDetail.mockRejectedValueOnce(new Error('not found'));
    rerender(
      <MemoryRouter>
        <OrderDetailPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('订单详情加载失败。')).toBeInTheDocument();
  });
});
