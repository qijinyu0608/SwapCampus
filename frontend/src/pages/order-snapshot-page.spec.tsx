import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OrderSnapshotPage } from './OrderSnapshotPage';

const mocks = vi.hoisted(() => ({
  params: { id: '18' },
  fetchOrderDetail: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  resolveProductGallery: vi.fn()
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
    timeline: [],
    reviews: [],
    appeals: [],
    actionState: {
      canComplete: false,
      canReview: false,
      canAppeal: false,
      canOpenConversation: false
    },
    ...overrides
  } as any;
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => mocks.params
  };
});

vi.mock('../services/api', () => ({
  fetchOrderDetail: (id: number) => mocks.fetchOrderDetail(id),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback)
}));

vi.mock('../utils/productCover', () => ({
  resolveProductGallery: (...args: any[]) => mocks.resolveProductGallery(...args)
}));

describe('OrderSnapshotPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.params = { id: '18' };
    mocks.fetchOrderDetail.mockResolvedValue(createOrderDetail());
    mocks.resolveProductGallery.mockReturnValue(['/snapshot-1.png', '/snapshot-2.png']);
  });

  it('loads snapshot detail and switches gallery images', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OrderSnapshotPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('高数教材')).toBeInTheDocument();
    expect(screen.getByText('九成新，带笔记')).toBeInTheDocument();
    expect(screen.getByText('教材资料')).toBeInTheDocument();
    expect(screen.getByText('九成新')).toBeInTheDocument();
    expect(screen.getByText('卖家乙')).toBeInTheDocument();
    expect(screen.getByText('¥18.00')).toBeInTheDocument();
    expect(mocks.fetchOrderDetail).toHaveBeenCalledWith(18);
    expect(mocks.resolveProductGallery).toHaveBeenCalledWith(expect.objectContaining({
      title: '高数教材',
      category: '教材资料',
      price: 18,
      sellerName: '卖家乙',
      imageUrl: '/book.png'
    }), 7, 6);

    const mainImage = screen.getByAltText('高数教材') as HTMLImageElement;
    expect(mainImage.src).toContain('/snapshot-1.png');

    await user.click(screen.getByRole('button', { name: '高数教材-2' }));
    expect(mainImage.src).toContain('/snapshot-2.png');
  });

  it('shows invalid id and failed load states', async () => {
    mocks.params = { id: 'bad' };
    const { rerender } = render(
      <MemoryRouter>
        <OrderSnapshotPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('缺少有效订单编号。')).toBeInTheDocument();
    expect(screen.getByText('未找到商品快照')).toBeInTheDocument();
    expect(mocks.fetchOrderDetail).not.toHaveBeenCalled();

    mocks.params = { id: '19' };
    mocks.fetchOrderDetail.mockRejectedValueOnce(new Error('not found'));
    mocks.getApiErrorMessage.mockReturnValueOnce('商品快照加载失败。');

    rerender(
      <MemoryRouter>
        <OrderSnapshotPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('商品快照加载失败。')).toBeInTheDocument();
    expect(screen.getByText('未找到商品快照')).toBeInTheDocument();
    expect(mocks.fetchOrderDetail).toHaveBeenCalledWith(19);
  });
});
