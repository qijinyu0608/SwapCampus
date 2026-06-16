import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SearchPage } from './SearchPage';

const navigate = vi.fn();
const searchParamsState = new URLSearchParams();
const setSearchParams = vi.fn((next: Record<string, string>) => {
  searchParamsState.forEach((_value, key) => searchParamsState.delete(key));
  Object.entries(next).forEach(([key, value]) => searchParamsState.set(key, value));
});

let favoritesRefresh: null | (() => void) = null;

const mocks = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  getListingStatusPresentation: vi.fn(() => ({ label: '在售' })),
  getProductImage: vi.fn(() => '/mock-product.png')
}));

const products = [
  {
    id: 1,
    title: '极好商品',
    description: 'A',
    price: 95,
    category: '数码电子',
    condition: '九成新',
    tags: ['A'],
    status: 'ON_SALE',
    sellerName: '卖家A',
    sellerCreditScore: 95
  },
  {
    id: 2,
    title: '优秀商品',
    description: 'B',
    price: 85,
    category: '数码电子',
    condition: '九成新',
    tags: ['B'],
    status: 'ON_SALE',
    sellerName: '卖家B',
    sellerCreditScore: 85
  },
  {
    id: 3,
    title: '良好商品',
    description: 'C',
    price: 75,
    category: '教材资料',
    condition: '八成新',
    tags: ['C'],
    status: 'ON_SALE',
    sellerName: '卖家C',
    sellerCreditScore: 75
  },
  {
    id: 4,
    title: '稳定商品',
    description: 'D',
    price: 65,
    category: '教材资料',
    condition: '八成新',
    tags: ['D'],
    status: 'ON_SALE',
    sellerName: '卖家D',
    sellerCreditScore: 65
  },
  {
    id: 5,
    title: '待提升商品',
    description: 'E',
    price: 55,
    category: '生活用品',
    condition: '七成新',
    tags: ['E'],
    status: 'ON_SALE',
    sellerName: '卖家E',
    sellerCreditScore: 55
  }
];

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
    useSearchParams: () => [searchParamsState, setSearchParams]
  };
});

vi.mock('../services/api', () => ({
  fetchProducts: (...args: unknown[]) => mocks.fetchProducts(...args),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback)
}));

vi.mock('../services/favorites', () => ({
  subscribeFavorites: vi.fn((callback: () => void) => {
    favoritesRefresh = callback;
    return () => {
      favoritesRefresh = null;
    };
  })
}));

vi.mock('../utils/listingStatus', () => ({
  getListingStatusPresentation: (...args: unknown[]) => mocks.getListingStatusPresentation(...args)
}));

vi.mock('../utils/productCover', () => ({
  getProductImage: (...args: unknown[]) => mocks.getProductImage(...args)
}));

vi.mock('../components/feedback', () => ({
  EmptyState: ({ title, description }: any) => (
    <div>
      <span>{title}</span>
      {description ? <span>{description}</span> : null}
    </div>
  )
}));

vi.mock('../components/product', () => ({
  ResultFilterBar: ({
    tabs,
    sortOptions,
    activeSort,
    activeCredits,
    creditOptions,
    minPrice,
    maxPrice,
    onTabChange,
    onSortChange,
    onMinPriceChange,
    onMaxPriceChange,
    onCreditToggle
  }: any) => (
    <div>
      {tabs?.map((tab: any) => (
        <button key={tab.key} type="button" onClick={() => onTabChange?.(tab.key)}>
          {tab.label}
        </button>
      ))}
      {sortOptions?.map((option: any) => (
        <button key={option.key} type="button" data-active={activeSort === option.key} onClick={() => onSortChange?.(option.key)}>
          {option.label}
        </button>
      ))}
      <label>
        最低价
        <input
          aria-label="最低价"
          value={minPrice ?? ''}
          onChange={(event) => onMinPriceChange?.(event.target.value === '' ? null : Number(event.target.value))}
        />
      </label>
      <label>
        最高价
        <input
          aria-label="最高价"
          value={maxPrice ?? ''}
          onChange={(event) => onMaxPriceChange?.(event.target.value === '' ? null : Number(event.target.value))}
        />
      </label>
      {creditOptions?.map((option: any) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={activeCredits?.includes(option.key)}
          onClick={() => onCreditToggle?.(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
  ProductGrid: ({ items, emptyState, renderItem }: any) => (
    <div data-testid="product-grid">
      {items.length ? items.map((item: any, index: number) => renderItem(item, index)) : emptyState}
    </div>
  ),
  ProductSummaryCard: ({ item, className, onOpen, priceMeta }: any) => (
    <button
      type="button"
      data-testid={`product-${item.id}`}
      data-title={item.title}
      className={className}
      onClick={onOpen}
    >
      <span>{item.title}</span>
      <span>{priceMeta}</span>
    </button>
  )
}));

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.forEach((_value, key) => searchParamsState.delete(key));
    favoritesRefresh = null;
    mocks.fetchProducts.mockResolvedValue({
      items: products,
      pagination: { page: 1, pageSize: 60, total: products.length, totalPages: 1 }
    });
  });

  afterEach(() => {
    cleanup();
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>
    );
  }

  it('loads results, submits empty searches, reloads on favorites, and opens products', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    expect(await screen.findByText('搜索商品')).toBeInTheDocument();
    expect(await screen.findByText('极好商品')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '搜索' }));
    expect(setSearchParams).toHaveBeenCalledWith({});

    favoritesRefresh?.();
    await waitFor(() => {
      expect(mocks.fetchProducts).toHaveBeenCalledTimes(2);
    });

    await user.click(screen.getByTestId('product-1'));
    expect(navigate).toHaveBeenCalledWith('/products/1');

    const titles = Array.from(container.querySelectorAll('[data-testid^="product-"]')).map((node) =>
      node.getAttribute('data-title')
    );
    expect(titles).toContain('待提升商品');
  });

  it('uses the keyword header, submits non-empty searches, and toggles credit bands', async () => {
    const user = userEvent.setup();
    searchParamsState.set('q', '耳机');
    renderPage();

    expect(await screen.findByText('搜索 “耳机”')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('搜索手机、电脑、教材、卡券');
    await user.clear(input);
    await user.type(input, '蓝牙耳机');
    await user.keyboard('{Enter}');
    expect(setSearchParams).toHaveBeenCalledWith({ q: '蓝牙耳机' });

    const creditCases: Array<[string, string]> = [
      ['极好', '极好商品'],
      ['优秀', '优秀商品'],
      ['良好', '良好商品'],
      ['稳定', '稳定商品'],
      ['待提升', '待提升商品']
    ];

    for (const [label, title] of creditCases) {
      await user.click(screen.getByRole('button', { name: label }));
      expect(screen.getByText(title)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: label }));
    }
  });

  it('sorts and filters by price', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    expect(await screen.findByText('极好商品')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '价格低到高' }));
    expect(Array.from(container.querySelectorAll('[data-testid^="product-"]')).map((node) => node.getAttribute('data-title')).filter(Boolean)).toEqual([
      '待提升商品',
      '稳定商品',
      '良好商品',
      '优秀商品',
      '极好商品'
    ]);

    await user.click(screen.getByRole('button', { name: '价格高到低' }));
    expect(Array.from(container.querySelectorAll('[data-testid^="product-"]')).map((node) => node.getAttribute('data-title')).filter(Boolean)[0]).toBe('极好商品');

    const minInput = screen.getByLabelText('最低价');
    const maxInput = screen.getByLabelText('最高价');
    await user.clear(minInput);
    await user.type(minInput, '70');
    await user.clear(maxInput);
    await user.type(maxInput, '80');

    expect(screen.queryByText('极好商品')).not.toBeInTheDocument();
    expect(screen.getByText('良好商品')).toBeInTheDocument();
    expect(screen.queryByText('待提升商品')).not.toBeInTheDocument();
  });

  it('shows a load error when the product request fails', async () => {
    mocks.fetchProducts.mockRejectedValueOnce(new Error('offline'));

    renderPage();

    expect(await screen.findByText('搜索暂不可用')).toBeInTheDocument();
    expect(screen.getByText('搜索服务当前不可用')).toBeInTheDocument();
  });
});
