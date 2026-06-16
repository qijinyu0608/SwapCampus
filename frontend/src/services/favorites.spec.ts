import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addFavorite: vi.fn(),
  fetchFavoriteList: vi.fn(),
  fetchProducts: vi.fn(),
  removeFavorite: vi.fn()
}));

vi.mock('./api', () => ({
  addFavorite: mocks.addFavorite,
  fetchFavoriteList: mocks.fetchFavoriteList,
  fetchProducts: mocks.fetchProducts,
  removeFavorite: mocks.removeFavorite
}));

import {
  getFavoriteIds,
  hydrateFavorites,
  isFavorite,
  loadFavorites,
  setFavorite,
  subscribeFavorites,
  toggleFavorite
} from './favorites';

describe('favorites service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('manages guest favorites locally', async () => {
    expect(getFavoriteIds()).toEqual([]);
    expect(isFavorite(1)).toBe(false);

    setFavorite(1, true);
    setFavorite(2, true);
    setFavorite(1, false);
    expect(getFavoriteIds()).toEqual([2]);
    expect(isFavorite(2)).toBe(true);

    hydrateFavorites([5, 6]);
    expect(getFavoriteIds()).toEqual([5, 6]);

    await expect(toggleFavorite(7, null)).resolves.toBe(true);
    expect(getFavoriteIds()).toEqual([5, 6, 7]);
    await expect(toggleFavorite(7, null)).resolves.toBe(false);
    expect(getFavoriteIds()).toEqual([5, 6]);
  });

  it('loads user favorites by merging guest and remote data, then clears guest scope', async () => {
    localStorage.setItem(
      'swapcampus-favorites',
      JSON.stringify({
        guest: [1, 2],
        '9': [3]
      })
    );

    mocks.fetchFavoriteList
      .mockResolvedValueOnce({
        items: [{ id: 3, title: '远端商品', favoriteCount: 2, isFavorited: true, favoritedAt: '2026-06-15T00:00:00Z' }]
      })
      .mockResolvedValueOnce({
        items: [
          { id: 3, title: '远端商品', favoriteCount: 2, isFavorited: true, favoritedAt: '2026-06-15T00:00:00Z' },
          { id: 1, title: '同步商品', favoriteCount: 3, isFavorited: true, favoritedAt: '2026-06-15T00:00:00Z' }
        ]
      });
    mocks.addFavorite
      .mockResolvedValueOnce({ isFavorited: true })
      .mockResolvedValueOnce({ isFavorited: true });
    mocks.fetchProducts.mockResolvedValue({
      items: [
        {
          id: 2,
          title: '兜底商品',
          description: 'fallback',
          price: 12,
          category: '教材资料',
          condition: '九成新',
          tags: [],
          status: 'OFFLINE',
          sellerName: '卖家A'
        }
      ]
    });

    const result = await loadFavorites({
      id: 9,
      displayName: '用户',
      email: 'user@example.com',
      role: 'USER'
    } as any);

    expect(mocks.addFavorite).toHaveBeenNthCalledWith(1, 1);
    expect(mocks.addFavorite).toHaveBeenNthCalledWith(2, 2);
    expect(mocks.fetchProducts).toHaveBeenCalledWith({
      ids: [2],
      status: 'ALL',
      page: 1,
      pageSize: 1
    });
    expect(result.items.map((item: any) => item.id)).toEqual([3, 1, 2]);

    const stored = JSON.parse(localStorage.getItem('swapcampus-favorites') || '{}');
    expect(stored.guest).toBeUndefined();
    expect(stored['9']).toEqual([3, 1, 2]);
  });

  it('toggles user favorites through remote api', async () => {
    hydrateFavorites([10], { id: 2, role: 'USER' } as any);
    mocks.removeFavorite.mockResolvedValueOnce({ isFavorited: false });
    mocks.addFavorite.mockResolvedValueOnce({ isFavorited: true });

    await expect(toggleFavorite(10, { id: 2, role: 'USER' } as any)).resolves.toBe(false);
    expect(getFavoriteIds({ id: 2, role: 'USER' } as any)).toEqual([]);

    await expect(toggleFavorite(11, { id: 2, role: 'USER' } as any)).resolves.toBe(true);
    expect(getFavoriteIds({ id: 2, role: 'USER' } as any)).toEqual([11]);
  });

  it('subscribes to local favorite change events', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFavorites(listener);

    setFavorite(88, true);
    expect(listener).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new StorageEvent('storage', { key: 'swapcampus-favorites' }));
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setFavorite(89, true);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
