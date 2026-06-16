import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FavoritesPage } from './FavoritesPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAuthState: vi.fn(),
  fetchProducts: vi.fn(),
  getFavoriteIds: vi.fn(),
  loadFavorites: vi.fn(),
  subscribeFavorites: vi.fn(() => () => undefined),
  toggleFavorite: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate
  };
});

vi.mock('../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../services/api', () => ({
  fetchProducts: (...args: any[]) => mocks.fetchProducts(...args)
}));

vi.mock('../services/favorites', () => ({
  getFavoriteIds: (user: any) => mocks.getFavoriteIds(user),
  loadFavorites: (user: any) => mocks.loadFavorites(user),
  subscribeFavorites: (listener: () => void) => mocks.subscribeFavorites(listener),
  toggleFavorite: (productId: number, user: any) => mocks.toggleFavorite(productId, user)
}));

describe('FavoritesPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 7, displayName: '张同学', role: 'USER' }
    });
    mocks.getFavoriteIds.mockReturnValue([]);
    mocks.loadFavorites.mockResolvedValue({
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
          sellerName: '卖家甲',
          favoriteCount: 4,
          favoritedAt: '2026-06-16T10:00:00.000Z'
        },
        {
          id: 12,
          title: '旧耳机',
          description: '可正常使用',
          price: 30,
          category: '数码电子',
          condition: '七成新',
          tags: ['耳机'],
          status: 'SOLD',
          sellerName: '卖家乙',
          favoriteCount: 2,
          favoritedAt: '2026-06-15T10:00:00.000Z'
        }
      ],
      total: 2
    });
    mocks.fetchProducts.mockResolvedValue({
      items: [
        {
          id: 31,
          title: '旅行箱',
          description: '八成新',
          price: 80,
          category: '鞋服箱包',
          condition: '八成新',
          tags: ['箱包'],
          status: 'ON_SALE',
          sellerName: '卖家丙',
          favoriteCount: 1
        }
      ],
      pagination: { page: 1, pageSize: 60, total: 1, totalPages: 1 }
    });
    mocks.toggleFavorite.mockResolvedValue(false);
  });

  it('renders favorite items, filters lists and clears inactive favorites', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <FavoritesPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /高数教材/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /旧耳机/ })).toBeInTheDocument();
    expect(screen.getByText('2 件')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1 件在售' }));
    expect(screen.getByRole('button', { name: /高数教材/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /旧耳机/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1 件失效' }));
    expect(await screen.findByRole('button', { name: /旧耳机/ })).toBeInTheDocument();
    expect(screen.getByText('暂不可交易')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清理失效收藏' }));
    await waitFor(() => {
      expect(mocks.toggleFavorite).toHaveBeenCalledWith(12, { id: 7, displayName: '张同学', role: 'USER' });
    });

    await user.click(screen.getByRole('button', { name: '全部' }));
    await user.click(screen.getByRole('button', { name: /高数教材/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/products/11');
  });

  it('shows empty state and navigates home when there are no favorites', async () => {
    const user = userEvent.setup();
    mocks.loadFavorites.mockResolvedValueOnce({ items: [], total: 0 });

    render(
      <MemoryRouter>
        <FavoritesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('还没有收藏的商品')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '去逛逛' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/');
  });

  it('loads guest favorites from product ids when the current user is not a normal user', async () => {
    const user = userEvent.setup();
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 1, displayName: '游客', role: 'GUEST' }
    });
    mocks.getFavoriteIds.mockReturnValue([31]);

    render(
      <MemoryRouter>
        <FavoritesPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /旅行箱/ })).toBeInTheDocument();
    expect(mocks.fetchProducts).toHaveBeenCalledWith({ ids: [31], status: 'ALL', page: 1, pageSize: 60 });
    await user.click(screen.getByRole('button', { name: /旅行箱/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/products/31');
  });
});
