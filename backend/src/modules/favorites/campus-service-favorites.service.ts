import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CampusServiceListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAuthenticatedUser } from '../auth/auth.utils';

function normalizeTags(tags: string[]) {
  return tags.filter(Boolean);
}

@Injectable()
export class CampusServiceFavoritesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  private ensureCanFavoriteListing(listing: {
    id: number;
    ownerId: number;
    status: CampusServiceListingStatus;
  }) {
    if (listing.status !== CampusServiceListingStatus.OPEN && listing.status !== CampusServiceListingStatus.BUSY) {
      throw new BadRequestException('当前校园服务不可收藏');
    }
  }

  async listFavorites(currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);

    const favorites = await this.prisma.campusServiceFavorite.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: {
          include: {
            owner: {
              select: {
                id: true,
                displayName: true,
                creditScore: true,
                verificationStatus: true,
                accountStatus: true
              }
            },
            images: {
              orderBy: [{ sortOrder: 'asc' }],
              select: { imageUrl: true }
            }
          }
        }
      }
    });

    const favoriteGroups = await this.prisma.campusServiceFavorite.groupBy({
      by: ['listingId'],
      where: {
        listingId: {
          in: favorites.map((item) => item.listingId)
        }
      },
      _count: { _all: true }
    });
    const favoriteCountMap = new Map(favoriteGroups.map((item) => [item.listingId, item._count._all]));

    return {
      items: favorites.map((favorite) => ({
        id: favorite.listing.id,
        title: favorite.listing.title,
        description: favorite.listing.description,
        price: Number(favorite.listing.amount ?? 0),
        imageUrl: favorite.listing.images[0]?.imageUrl ?? '',
        tags: normalizeTags([favorite.listing.intent, favorite.listing.category, favorite.listing.status]),
        status: favorite.listing.status,
        category: favorite.listing.category,
        intent: favorite.listing.intent,
        sellerName: favorite.listing.owner.displayName,
        favoriteCount: favoriteCountMap.get(favorite.listingId) ?? 0,
        isFavorited: true,
        favoritedAt: favorite.createdAt
      })),
      total: favorites.length
    };
  }

  async addFavorite(listingId: number, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);

    const listing = await this.prisma.campusServiceListing.findUnique({
      where: { id: listingId },
      select: { id: true, ownerId: true, status: true }
    });

    if (!listing) {
      throw new NotFoundException('校园服务不存在');
    }

    this.ensureCanFavoriteListing(listing);

    const favorite = await this.prisma.campusServiceFavorite.upsert({
      where: {
        userId_listingId: {
          userId: authUser.id,
          listingId
        }
      },
      update: {},
      create: {
        userId: authUser.id,
        listingId
      }
    });

    const favoriteCount = await this.prisma.campusServiceFavorite.count({
      where: { listingId }
    });

    return {
      listingId,
      isFavorited: true,
      favoritedAt: favorite.createdAt,
      favoriteCount
    };
  }

  async removeFavorite(listingId: number, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);

    await this.prisma.campusServiceFavorite.deleteMany({
      where: {
        userId: authUser.id,
        listingId
      }
    });

    const favoriteCount = await this.prisma.campusServiceFavorite.count({
      where: { listingId }
    });

    return {
      listingId,
      isFavorited: false,
      favoriteCount
    };
  }
}
