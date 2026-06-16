import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductStatus, VerificationStatus } from '@prisma/client';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  function createService() {
    const prisma = {
      favorite: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn()
      },
      product: {
        findUnique: jest.fn()
      },
      user: {
        findMany: jest.fn()
      },
      productImage: {
        findMany: jest.fn()
      },
      $transaction: jest.fn(async (callback: any) => callback(prisma))
    } as any;

    const outboxService = {
      publishRecommendationEvent: jest.fn().mockResolvedValue(undefined)
    } as any;

    return { service: new FavoritesService(prisma, outboxService), prisma, outboxService };
  }

  it('lists favorites with seller and image mapping', async () => {
    const { service, prisma } = createService();
    prisma.favorite.findMany.mockResolvedValue([
      {
        productId: 1,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        product: {
          id: 1,
          sellerId: 3,
          title: '台灯',
          category: '宿舍生活',
          price: 30,
          condition: '九成新',
          tags: ['宿舍', '护眼'],
          status: ProductStatus.ON_SALE,
          description: '可自提'
        }
      }
    ]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 3,
        displayName: '卖家',
        creditScore: 86,
        verificationStatus: VerificationStatus.APPROVED
      }
    ]);
    prisma.productImage.findMany.mockResolvedValue([{ productId: 1, imageUrl: '/a.jpg' }]);
    prisma.favorite.groupBy.mockResolvedValue([{ productId: 1, _count: { _all: 2 } }]);

    const result = await service.listFavorites({ id: 5 } as any);
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(expect.objectContaining({
      id: 1,
      sellerName: '卖家',
      sellerVerified: true,
      favoriteCount: 2,
      isFavorited: true
    }));
  });

  it('adds and removes favorites with validation', async () => {
    const { service, prisma, outboxService } = createService();
    prisma.product.findUnique.mockResolvedValue({ id: 1, sellerId: 3, status: ProductStatus.ON_SALE });
    prisma.favorite.upsert.mockResolvedValue({ createdAt: new Date('2026-01-02T00:00:00Z') });
    prisma.favorite.count.mockResolvedValue(6);

    await expect(service.addFavorite(1, { id: 8 } as any)).resolves.toEqual(expect.objectContaining({
      productId: 1,
      isFavorited: true,
      favoriteCount: 6
    }));
    expect(outboxService.publishRecommendationEvent).toHaveBeenCalledWith({
      userId: 8,
      productId: 1,
      eventType: 'FavoriteChanged',
      action: 'FAVORITE'
    }, expect.anything());

    prisma.favorite.deleteMany.mockResolvedValue({ count: 1 });
    prisma.favorite.count.mockResolvedValue(5);
    await expect(service.removeFavorite(1, { id: 8 } as any)).resolves.toEqual({
      productId: 1,
      isFavorited: false,
      favoriteCount: 5
    });
    expect(outboxService.publishRecommendationEvent).toHaveBeenCalledWith({
      userId: 8,
      productId: 1,
      eventType: 'FavoriteChanged',
      action: 'UNFAVORITE'
    }, expect.anything());

    prisma.product.findUnique.mockResolvedValueOnce(null);
    await expect(service.addFavorite(2, { id: 8 } as any)).rejects.toBeInstanceOf(NotFoundException);

    prisma.product.findUnique.mockResolvedValueOnce({ id: 2, sellerId: 3, status: ProductStatus.OFFLINE });
    await expect(service.addFavorite(2, { id: 8 } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
