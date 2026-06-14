import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAuthenticatedUser } from '../auth/auth.utils';
import { normalizeProductConditionValue } from '../products/product-conditions';

type FavoriteProductCard = {
  id: number;
  title: string;
  category: string;
  price: number;
  condition: string;
  tags: string[];
  status: string;
  description: string;
  sellerName: string;
  sellerCreditScore: number;
  sellerVerified: boolean;
  imageUrl: string | null;
  sellerId: number;
};

type FavoriteListItem = FavoriteProductCard & {
  favoritedAt: Date;
  isFavorited: boolean;
  favoriteCount: number;
};

function normalizeTags(tags: Prisma.JsonValue | null) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(Boolean);
}

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  private async buildFavoriteProductCards(products: Array<{
    id: number;
    sellerId: number;
    title: string;
    category: string;
    price: unknown;
    condition: string;
    tags: Prisma.JsonValue | null;
    status: ProductStatus;
    description: string;
  }>): Promise<FavoriteProductCard[]> {
    const sellerIds = [...new Set(products.map((product) => product.sellerId))];
    const productIds = products.map((product) => product.id);

    const [sellers, images] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, displayName: true, creditScore: true, verificationStatus: true }
      }),
      this.prisma.productImage.findMany({
        where: { productId: { in: productIds } },
        orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }],
        select: { productId: true, imageUrl: true }
      })
    ]);

    const sellerMap = new Map(sellers.map((seller) => [seller.id, seller]));
    const imageMap = new Map<number, string>();

    images.forEach((image) => {
      if (!imageMap.has(image.productId)) {
        imageMap.set(image.productId, image.imageUrl);
      }
    });

    return products.map((product) => {
      const seller = sellerMap.get(product.sellerId);

      return {
        id: product.id,
        title: product.title,
        category: product.category,
        price: Number(product.price),
        condition: normalizeProductConditionValue(product.condition),
        tags: normalizeTags(product.tags),
        status: product.status,
        description: product.description,
        sellerId: product.sellerId,
        sellerName: seller?.displayName ?? `用户#${product.sellerId}`,
        sellerCreditScore: seller?.creditScore ?? 60,
        sellerVerified: seller?.verificationStatus === VerificationStatus.APPROVED,
        imageUrl: imageMap.get(product.id) ?? null
      };
    });
  }

  private async getFavoriteCountMap(productIds: number[]) {
    if (!productIds.length) {
      return new Map<number, number>();
    }

    const favoriteGroups = await this.prisma.favorite.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _count: { _all: true }
    });

    return new Map(favoriteGroups.map((item) => [item.productId, item._count._all]));
  }

  private ensureCanFavoriteProduct(product: {
    id: number;
    sellerId: number;
    status: ProductStatus;
  }, userId: number) {
    if (product.status !== ProductStatus.ON_SALE) {
      throw new BadRequestException('当前商品不可收藏');
    }
  }

  async listFavorites(currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);

    const favorites = await this.prisma.favorite.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: 'desc' },
      include: {
        product: true
      }
    });

    const productCards = await this.buildFavoriteProductCards(favorites.map((item) => item.product));
    const favoriteCountMap = await this.getFavoriteCountMap(productCards.map((item) => item.id));
    const productMap = new Map(productCards.map((item) => [item.id, item]));

    const items: FavoriteListItem[] = favorites
      .map((favorite) => {
        const product = productMap.get(favorite.productId);
        if (!product) {
          return null;
        }

        return {
          ...product,
          favoritedAt: favorite.createdAt,
          isFavorited: true,
          favoriteCount: favoriteCountMap.get(favorite.productId) ?? 0
        };
      })
      .filter((item): item is FavoriteListItem => item !== null);

    return {
      items,
      total: items.length
    };
  }

  async addFavorite(productId: number, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sellerId: true, status: true }
    });

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    this.ensureCanFavoriteProduct(product, authUser.id);

    const favorite = await this.prisma.favorite.upsert({
      where: {
        userId_productId: {
          userId: authUser.id,
          productId
        }
      },
      update: {},
      create: {
        userId: authUser.id,
        productId
      }
    });

    const favoriteCount = await this.prisma.favorite.count({
      where: { productId }
    });

    return {
      productId,
      isFavorited: true,
      favoritedAt: favorite.createdAt,
      favoriteCount
    };
  }

  async removeFavorite(productId: number, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);

    await this.prisma.favorite.deleteMany({
      where: {
        userId: authUser.id,
        productId
      }
    });

    const favoriteCount = await this.prisma.favorite.count({
      where: { productId }
    });

    return {
      productId,
      isFavorited: false,
      favoriteCount
    };
  }
}
