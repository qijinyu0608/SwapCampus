import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CampusServiceListingStatus } from '@prisma/client';
import { CampusServiceFavoritesService } from './campus-service-favorites.service';

describe('CampusServiceFavoritesService', () => {
  function createService() {
    const prisma = {
      campusServiceFavorite: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn()
      },
      campusServiceListing: {
        findUnique: jest.fn()
      }
    } as any;
    return { service: new CampusServiceFavoritesService(prisma), prisma };
  }

  it('lists campus service favorites', async () => {
    const { service, prisma } = createService();
    prisma.campusServiceFavorite.findMany.mockResolvedValue([
      {
        listingId: 1,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        listing: {
          id: 1,
          title: '取快递',
          description: '帮忙拿',
          amount: 12,
          images: [{ imageUrl: '/a.jpg' }],
          intent: 'REQUEST',
          category: 'HELP',
          status: CampusServiceListingStatus.OPEN,
          owner: { displayName: '发布者' }
        }
      }
    ]);
    prisma.campusServiceFavorite.groupBy.mockResolvedValue([{ listingId: 1, _count: { _all: 3 } }]);
    const result = await service.listFavorites({ id: 9 } as any);
    expect(result.items[0]).toEqual(expect.objectContaining({
      title: '取快递',
      favoriteCount: 3
    }));
  });

  it('validates add and remove favorite operations', async () => {
    const { service, prisma } = createService();
    prisma.campusServiceListing.findUnique.mockResolvedValue({ id: 1, ownerId: 2, status: CampusServiceListingStatus.OPEN });
    prisma.campusServiceFavorite.upsert.mockResolvedValue({ createdAt: new Date('2026-01-02T00:00:00Z') });
    prisma.campusServiceFavorite.count.mockResolvedValue(4);
    await expect(service.addFavorite(1, { id: 10 } as any)).resolves.toEqual(expect.objectContaining({
      listingId: 1,
      favoriteCount: 4
    }));

    prisma.campusServiceFavorite.deleteMany.mockResolvedValue({ count: 1 });
    prisma.campusServiceFavorite.count.mockResolvedValue(2);
    await expect(service.removeFavorite(1, { id: 10 } as any)).resolves.toEqual({
      listingId: 1,
      isFavorited: false,
      favoriteCount: 2
    });

    prisma.campusServiceListing.findUnique.mockResolvedValueOnce(null);
    await expect(service.addFavorite(2, { id: 10 } as any)).rejects.toBeInstanceOf(NotFoundException);
    prisma.campusServiceListing.findUnique.mockResolvedValueOnce({ id: 2, ownerId: 2, status: CampusServiceListingStatus.ENDED });
    await expect(service.addFavorite(2, { id: 10 } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
