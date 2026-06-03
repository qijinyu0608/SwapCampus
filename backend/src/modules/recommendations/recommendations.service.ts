import { BehaviorEventType } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordBehaviorDto } from './dto/record-behavior.dto';

type ProductPreferenceProfile = {
  activeFavoriteIds: Set<number>;
  viewedProductIds: Set<number>;
  preferredCategories: Set<string>;
  preferredTags: Set<string>;
  categoryWeights: Map<string, number>;
  tagWeights: Map<string, number>;
};

function normalizeTags(tags: string) {
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

@Injectable()
export class RecommendationsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async recordBehavior(payload: RecordBehaviorDto) {
    if (payload.eventType === BehaviorEventType.VIEW) {
      const lastView = await this.prisma.userBehavior.findFirst({
        where: {
          userId: payload.userId,
          productId: payload.productId,
          eventType: BehaviorEventType.VIEW
        },
        orderBy: { createdAt: 'desc' }
      });

      if (lastView && Date.now() - lastView.createdAt.getTime() < 1000 * 60 * 20) {
        return { accepted: true, deduplicated: true };
      }
    }

    await this.prisma.userBehavior.create({
      data: payload
    });

    return { accepted: true, deduplicated: false };
  }

  async getPreferenceProfile(userId?: number): Promise<ProductPreferenceProfile> {
    const profile: ProductPreferenceProfile = {
      activeFavoriteIds: new Set<number>(),
      viewedProductIds: new Set<number>(),
      preferredCategories: new Set<string>(),
      preferredTags: new Set<string>(),
      categoryWeights: new Map<string, number>(),
      tagWeights: new Map<string, number>()
    };

    if (!userId) {
      return profile;
    }

    const [behaviorEvents, orders, conversations] = await Promise.all([
      this.prisma.userBehavior.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 120
      }),
      this.prisma.order.findMany({
        where: { buyerId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { productId: true }
      }),
      this.prisma.conversation.findMany({
        where: {
          productId: { not: null },
          messages: {
            some: { senderId: userId }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { productId: true }
      })
    ]);

    const productIds = [
      ...new Set([
        ...behaviorEvents.map((item) => item.productId),
        ...orders.map((item) => item.productId),
        ...conversations.map((item) => item.productId).filter(Boolean) as number[]
      ])
    ];

    if (!productIds.length) {
      return profile;
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, category: true, tags: true }
    });

    const productMap = new Map(products.map((product) => [product.id, product]));
    const favoriteStates = new Map<number, boolean>();

    const addWeight = (category: string, tags: string[], categoryWeight: number, tagWeight: number) => {
      profile.preferredCategories.add(category);
      profile.categoryWeights.set(category, (profile.categoryWeights.get(category) ?? 0) + categoryWeight);
      tags.forEach((tag) => {
        profile.preferredTags.add(tag);
        profile.tagWeights.set(tag, (profile.tagWeights.get(tag) ?? 0) + tagWeight);
      });
    };

    behaviorEvents.forEach((event, index) => {
      const product = productMap.get(event.productId);
      if (!product) {
        return;
      }

      const tags = normalizeTags(product.tags);
      const recencyBoost = Math.max(1, 10 - index * 0.18);

      if (event.eventType === BehaviorEventType.FAVORITE || event.eventType === BehaviorEventType.UNFAVORITE) {
        if (!favoriteStates.has(event.productId)) {
          favoriteStates.set(event.productId, event.eventType === BehaviorEventType.FAVORITE);
        }
      }

      if (event.eventType === BehaviorEventType.VIEW) {
        profile.viewedProductIds.add(event.productId);
        addWeight(product.category, tags, 4 + recencyBoost, 3 + recencyBoost * 0.7);
      }

      if (event.eventType === BehaviorEventType.FAVORITE) {
        addWeight(product.category, tags, 18, 12);
      }

      if (event.eventType === BehaviorEventType.CONTACT) {
        addWeight(product.category, tags, 11, 8);
      }

      if (event.eventType === BehaviorEventType.ORDER) {
        addWeight(product.category, tags, 16, 10);
      }
    });

    favoriteStates.forEach((isFavorited, productId) => {
      if (isFavorited) {
        profile.activeFavoriteIds.add(productId);
      }
    });

    orders.forEach((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        return;
      }
      addWeight(product.category, normalizeTags(product.tags), 14, 9);
    });

    conversations.forEach((item) => {
      if (!item.productId) {
        return;
      }
      const product = productMap.get(item.productId);
      if (!product) {
        return;
      }
      addWeight(product.category, normalizeTags(product.tags), 9, 6);
    });

    return profile;
  }

  async getPopularityMap(productIds: number[]) {
    if (!productIds.length) {
      return new Map<number, { favoriteCount: number; orderCount: number; reportCount: number }>();
    }

    const [favorites, orders, reports] = await Promise.all([
      this.prisma.userBehavior.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          eventType: BehaviorEventType.FAVORITE
        },
        _count: { _all: true }
      }),
      this.prisma.order.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _count: { _all: true }
      }),
      this.prisma.report.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds }
        },
        _count: { _all: true }
      })
    ]);

    const popularityMap = new Map<number, { favoriteCount: number; orderCount: number; reportCount: number }>();

    productIds.forEach((productId) => {
      popularityMap.set(productId, { favoriteCount: 0, orderCount: 0, reportCount: 0 });
    });

    favorites.forEach((item) => {
      const current = popularityMap.get(item.productId);
      if (current) {
        current.favoriteCount = item._count._all;
      }
    });

    orders.forEach((item) => {
      const current = popularityMap.get(item.productId);
      if (current) {
        current.orderCount = item._count._all;
      }
    });

    reports.forEach((item) => {
      if (item.productId == null) {
        return;
      }
      const current = popularityMap.get(item.productId);
      if (current) {
        current.reportCount = item._count._all;
      }
    });

    return popularityMap;
  }
}
