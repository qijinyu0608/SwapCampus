import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, BehaviorEventType, OrderStatus, Prisma, ProductStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hasAvatarFrameRewardUnlocked } from '../credit-center/credit-center.utils';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAuthenticatedUser } from '../auth/auth.utils';
import { SearchService } from '../search/search.service';
import { VendureService } from '../vendure/vendure.service';
import { isProductCategoryName, normalizeProductCategoryName, PRODUCT_CATEGORY_NAMES } from './product-categories';
import { isProductConditionValue, PRODUCT_CONDITION_VALUES } from './product-conditions';
import { CreateProductDto } from './dto/create-product.dto';
import { SearchProductsDto } from './dto/search-products.dto';

const DEMO_PRODUCT_IMAGE = '/images/products/demo-square.png';

const allowedCategories = [...PRODUCT_CATEGORY_NAMES];
const prohibitedKeywords = ['刀具', '代抢', '账号', '药品', '烟草', '酒精', '发票', '银行卡', '代写', '代考', '外挂', '校园贷'];
const dormElectricalWhitelist = ['电脑', '非充电台灯', '手机', '平板电脑', '20000mAh以下充电宝', '电动牙刷', '电动剃须刀', '相机'];
const communityNotices = [
  '宿舍电器请优先控制在校内允许使用和交易的范围内，发布前自行确认宿舍管理要求。',
  '交易建议优先选择图书馆、食堂、公寓楼下等校内公共区域，当面验货后再确认。',
  '教材资料、数码配件和生活用品请写清成色、配件、容量或版本，避免误导同学。',
  '平台禁止账号、代写代考、烟酒药品、刀具、校园贷等内容，违规账号会被限制发布。'
];
const productStatusLabelMap: Record<ProductStatus, string> = {
  ON_SALE: '在售',
  PENDING: '暂不可见',
  SOLD: '已售',
  OFFLINE: '已下架'
};
const ruleHighlights = [
  '商品提交后直接上架展示',
  '发布人需自行保证标题、描述和图片真实一致',
  '宿舍电器请按白名单和校内用电要求谨慎发布',
  '平台保留基于举报或运营巡检下架违规内容的权利'
];
const categoryImageMap: Record<string, string[]> = {
  教材资料: [DEMO_PRODUCT_IMAGE],
  数码电子: [DEMO_PRODUCT_IMAGE],
  宿舍生活: [DEMO_PRODUCT_IMAGE],
  运动出行: [DEMO_PRODUCT_IMAGE],
  鞋服箱包: [DEMO_PRODUCT_IMAGE],
  办公文具: [DEMO_PRODUCT_IMAGE],
  美妆个护: [DEMO_PRODUCT_IMAGE],
  卡券票务: [DEMO_PRODUCT_IMAGE],
  兴趣文娱: [DEMO_PRODUCT_IMAGE],
  其他: [DEMO_PRODUCT_IMAGE]
};

function resolveDefaultImagePool(category: string, title: string) {
  if (/(教材|真题|笔记|复习|英语|数学|专业课|活页本|荧光笔|计算器|资料)/.test(title)) {
    return [DEMO_PRODUCT_IMAGE];
  }

  if (/(键盘)/.test(title)) {
    return [DEMO_PRODUCT_IMAGE];
  }

  if (/(充电宝|电源)/.test(title)) {
    return [DEMO_PRODUCT_IMAGE];
  }

  if (/(台灯|阅读灯|夜灯)/.test(title)) {
    return [DEMO_PRODUCT_IMAGE];
  }

  if (/(风扇)/.test(title)) {
    return [DEMO_PRODUCT_IMAGE];
  }

  if (/(羽毛球|跳绳|护腕|头盔|骑行)/.test(title)) {
    return [DEMO_PRODUCT_IMAGE];
  }

  if (/(衣架|衣服|外套|卫衣|鞋|拖鞋|双肩包)/.test(title)) {
    return [DEMO_PRODUCT_IMAGE];
  }

  if (/(收纳|置物|推车|文件架|书桌)/.test(title)) {
    return [DEMO_PRODUCT_IMAGE];
  }

  if (/(靠垫|毛绒)/.test(title)) {
    return [DEMO_PRODUCT_IMAGE];
  }

  return categoryImageMap[normalizeProductCategoryName(category)] ?? categoryImageMap.其他;
}

function normalizeTags(tags: Prisma.JsonValue | null) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(Boolean);
}

function buildProductTags(payload: Pick<CreateProductDto, 'title' | 'category' | 'condition' | 'tags'>) {
  const manualTags = (payload.tags ?? [])
    .flatMap((tag) => tag.split(/[，,、/\s]+/))
    .map((tag) => tag.trim())
    .filter(Boolean);

  const filteredTags = manualTags.filter((tag, index, list) => {
    if (list.indexOf(tag) !== index) {
      return false;
    }

    if (PRODUCT_CATEGORY_NAMES.includes(tag as (typeof PRODUCT_CATEGORY_NAMES)[number])) {
      return false;
    }

    if (PRODUCT_CONDITION_VALUES.includes(tag as (typeof PRODUCT_CONDITION_VALUES)[number])) {
      return false;
    }

    return tag.length <= 16;
  });

  return filteredTags.slice(0, 6);
}

function getCreditLevel(score: number) {
  if (score >= 90) {
    return '优秀';
  }
  if (score >= 75) {
    return '稳定';
  }
  if (score >= 60) {
    return '正常';
  }
  return '待提升';
}

function getDefaultImageUrl(productId: number, category: string, title: string) {
  const imagePool = resolveDefaultImagePool(category, title);
  return imagePool[productId % imagePool.length];
}

function getSearchTotalHits(result: { totalHits?: number; estimatedTotalHits?: number }) {
  return result.totalHits ?? result.estimatedTotalHits ?? 0;
}

function getPriceBand(price: number) {
  if (price < 20) {
    return 'under_20';
  }
  if (price <= 50) {
    return '20_50';
  }
  if (price <= 100) {
    return '50_100';
  }
  return '100_plus';
}

@Injectable()
export class ProductsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SearchService)
    private readonly searchService: SearchService,
    @Inject(VendureService)
    private readonly vendureService: VendureService
  ) {}

  private async buildProductCards(products: Array<{
    id: number;
    sellerId: number;
    title: string;
    category: string;
    price: unknown;
    condition: string;
    tags: Prisma.JsonValue | null;
    status: ProductStatus;
    description: string;
  }>, userId?: number) {
    const sellerIds = [...new Set(products.map((product) => product.sellerId))];
    const productIds = products.map((product) => product.id);

    const [sellers, images, favoriteCounts, wantCounts, favoritedProductIds] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, displayName: true, creditScore: true, verificationStatus: true }
      }),
      this.prisma.productImage.findMany({
        where: { productId: { in: productIds } },
        orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }]
      }),
      this.prisma.favorite.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _count: { _all: true }
      }),
      this.prisma.userBehavior.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          eventType: BehaviorEventType.CONTACT
        },
        _count: { _all: true }
      }),
      userId
        ? this.prisma.favorite.findMany({
            where: {
              userId,
              productId: { in: productIds }
            },
            select: { productId: true, createdAt: true }
          })
        : Promise.resolve([])
    ]);

    const favoriteCountMap = new Map(favoriteCounts.map((item) => [item.productId, item._count._all]));
    const wantCountMap = new Map(wantCounts.map((item) => [item.productId, item._count._all]));
    const userFavoriteMap = new Map(favoritedProductIds.map((item) => [item.productId, item.createdAt]));
    const sellerMap = new Map(sellers.map((seller) => [seller.id, seller]));
    const imageMap = new Map<number, string>();

    images.forEach((image) => {
      if (!imageMap.has(image.productId)) {
        imageMap.set(image.productId, image.imageUrl);
      }
    });

    return products.map((product) => {
      const userFavoritedAt = userFavoriteMap.get(product.id);
      const normalizedCategory = normalizeProductCategoryName(product.category);

      return {
        id: product.id,
        title: product.title,
        category: normalizedCategory,
        price: Number(product.price),
        condition: product.condition,
        tags: normalizeTags(product.tags),
        status: product.status,
        description: product.description,
        sellerId: product.sellerId,
        sellerName: sellerMap.get(product.sellerId)?.displayName ?? `用户#${product.sellerId}`,
        sellerCreditScore: sellerMap.get(product.sellerId)?.creditScore ?? 60,
        sellerVerified: sellerMap.get(product.sellerId)?.verificationStatus === VerificationStatus.APPROVED,
        imageUrl: imageMap.get(product.id) ?? getDefaultImageUrl(product.id, normalizedCategory, product.title),
        favoriteCount: favoriteCountMap.get(product.id) ?? 0,
        wantCount: wantCountMap.get(product.id) ?? 0,
        isFavorited: Boolean(userFavoritedAt),
        favoritedAt: userFavoritedAt ?? null
      };
    });
  }

  private async getCandidateProductsForRecommendation(excludeProductIds: number[], excludeSellerId?: number) {
    return this.prisma.product.findMany({
      where: {
        status: ProductStatus.ON_SALE,
        ...(excludeProductIds.length ? { id: { notIn: excludeProductIds } } : {}),
        ...(excludeSellerId ? { sellerId: { not: excludeSellerId } } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 180
    });
  }

  async getHomeRecommendations(userId?: number) {
    const seedCategories = new Map<string, number>();
    const seedTags = new Map<string, number>();
    const seedPriceBands = new Map<string, number>();
    const excludedProductIds = new Set<number>();

    if (userId) {
      const [favorites, orders] = await Promise.all([
        this.prisma.favorite.findMany({
          where: { userId },
          include: {
            product: {
              select: {
                id: true,
                category: true,
                tags: true,
                price: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 24
        }),
        this.prisma.order.findMany({
          where: {
            OR: [{ buyerId: userId }, { sellerId: userId }]
          },
          include: {
            product: {
              select: {
                id: true,
                category: true,
                tags: true,
                price: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 24
        })
      ]);

      favorites.forEach((favorite, index) => {
        const product = favorite.product;
        if (!product) {
          return;
        }

        excludedProductIds.add(product.id);
        const weight = Math.max(2, 8 - Math.floor(index / 4));
        seedCategories.set(product.category, (seedCategories.get(product.category) ?? 0) + weight);
        normalizeTags(product.tags).slice(0, 6).forEach((tag) => {
          seedTags.set(tag, (seedTags.get(tag) ?? 0) + weight);
        });
        const priceBand = getPriceBand(Number(product.price));
        seedPriceBands.set(priceBand, (seedPriceBands.get(priceBand) ?? 0) + weight);
      });

      orders.forEach((order, index) => {
        const product = order.product;
        if (!product) {
          return;
        }

        excludedProductIds.add(product.id);
        const weight = Math.max(1, 6 - Math.floor(index / 4));
        seedCategories.set(product.category, (seedCategories.get(product.category) ?? 0) + weight);
        normalizeTags(product.tags).slice(0, 6).forEach((tag) => {
          seedTags.set(tag, (seedTags.get(tag) ?? 0) + weight);
        });
        const priceBand = getPriceBand(Number(product.price));
        seedPriceBands.set(priceBand, (seedPriceBands.get(priceBand) ?? 0) + weight);
      });
    }

    const candidateProducts = await this.getCandidateProductsForRecommendation(
      [...excludedProductIds],
      userId
    );

    const favoriteStats = await this.prisma.favorite.groupBy({
      by: ['productId'],
      where: {
        productId: {
          in: candidateProducts.map((item) => item.id)
        }
      },
      _count: { _all: true }
    });
    const favoriteCountMap = new Map(favoriteStats.map((item) => [item.productId, item._count._all]));

    const scoredProducts = candidateProducts.map((product, index) => {
      const price = Number(product.price);
      const priceBand = getPriceBand(price);
      const tags = normalizeTags(product.tags);
      const categoryScore = seedCategories.get(product.category) ?? 0;
      const tagScore = tags.reduce((sum, tag) => sum + (seedTags.get(tag) ?? 0), 0);
      const priceBandScore = seedPriceBands.get(priceBand) ?? 0;
      const favoriteScore = Math.min(10, favoriteCountMap.get(product.id) ?? 0);
      const freshnessScore = Math.max(0, 12 - Math.floor(index / 12));
      const diversityPenalty = categoryScore > 0 ? 0 : Math.floor(index / 18);
      const score = categoryScore * 4 + tagScore * 2 + priceBandScore * 2 + favoriteScore + freshnessScore - diversityPenalty;

      return {
        product,
        score
      };
    });

    scoredProducts.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.product.createdAt.getTime() - left.product.createdAt.getTime();
    });

    const selected: typeof candidateProducts = [];
    const categoryCount = new Map<string, number>();

    for (const item of scoredProducts) {
      const currentCategoryCount = categoryCount.get(item.product.category) ?? 0;
      if (selected.length >= 24) {
        break;
      }

      if (currentCategoryCount >= 4 && scoredProducts.length > 24) {
        continue;
      }

      selected.push(item.product);
      categoryCount.set(item.product.category, currentCategoryCount + 1);
    }

    if (selected.length < 24) {
      scoredProducts.forEach((item) => {
        if (selected.length >= 24) {
          return;
        }

        if (selected.some((selectedItem) => selectedItem.id === item.product.id)) {
          return;
        }

        selected.push(item.product);
      });
    }

    return this.buildProductCards(selected, userId);
  }

  async searchProducts(query: SearchProductsDto) {
    const ids = query.ids
      ?.split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item > 0);

    const result = await this.searchService.searchProducts({
      q: query.q,
      category: query.category,
      condition: query.condition,
      sellerId: query.sellerId,
      ids,
      status: query.status,
      trade: query.trade,
      sort: query.sort,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      page: query.page,
      pageSize: query.pageSize
    });

    const hits = result.hits as Array<{ id: number }>;
    const productIds = hits.map((item) => item.id);
    const page = result.page ?? query.page ?? 1;
    const pageSize = result.hitsPerPage ?? query.pageSize ?? 24;
    const total = getSearchTotalHits(result);
    const totalPages = result.totalPages ?? Math.ceil(total / pageSize);

    if (!productIds.length) {
      return {
        items: [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        }
      };
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds }
      }
    });
    const cards = await this.buildProductCards(products);
    const cardMap = new Map(cards.map((item) => [item.id, item]));

    return {
      items: productIds.map((id) => cardMap.get(id)).filter((item): item is (typeof cards)[number] => Boolean(item)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    };
  }

  getPublishingRules() {
    return {
      allowedCategories,
      prohibitedKeywords,
      dormElectricalWhitelist,
      communityNotices,
      ruleHighlights,
      reviewFlow: ['实名认证', '填写商品信息', '直接上架'],
      trustSignals: ['实名账号', '信用分', '举报下架', '审核留痕']
    };
  }

  async getProductDetail(id: number, userId?: number) {
    const product = await this.prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    if (userId) {
      await this.prisma.userBehavior.upsert({
        where: {
          userId_productId_eventType: {
            userId,
            productId: product.id,
            eventType: BehaviorEventType.VIEW
          }
        },
        update: {
          createdAt: new Date()
        },
        create: {
          userId,
          productId: product.id,
          eventType: BehaviorEventType.VIEW
        }
      });
    }

    const [seller, images, relatedProducts, reportCount, favoriteCount, wantCount, viewCount, sellerOrders] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: product.sellerId },
        include: { verification: true }
      }),
      this.prisma.productImage.findMany({
        where: { productId: product.id },
        orderBy: { sortOrder: 'asc' }
      }),
      this.prisma.product.findMany({
        where: {
          category: product.category,
          status: ProductStatus.ON_SALE,
          id: { not: product.id }
        },
        orderBy: { createdAt: 'desc' },
        take: 4
      }),
      this.prisma.report.count({
        where: { productId: product.id }
      }),
      this.prisma.favorite.count({
        where: { productId: product.id }
      }),
      this.prisma.userBehavior.count({
        where: {
          productId: product.id,
          eventType: BehaviorEventType.CONTACT
        }
      }),
      this.prisma.userBehavior.count({
        where: {
          productId: product.id,
          eventType: BehaviorEventType.VIEW
        }
      }),
      this.prisma.order.findMany({
        where: { sellerId: product.sellerId },
        select: { id: true, status: true }
      }),
    ]);

    const sellerOrderIds = sellerOrders.map((order) => order.id);
    const sellerReviews = sellerOrderIds.length
      ? await this.prisma.review.findMany({
          where: { orderId: { in: sellerOrderIds } },
          select: { rating: true }
        })
      : [];

    const relatedCards = await this.buildProductCards(relatedProducts, userId);
    const completedOrders = sellerOrders.filter((order) => order.status === OrderStatus.COMPLETED).length;
    const averageRating = sellerReviews.length
      ? Number((sellerReviews.reduce((sum, review) => sum + review.rating, 0) / sellerReviews.length).toFixed(1))
      : null;

    const detailCard = (await this.buildProductCards([product], userId))[0];
    const sellerCreditScore = seller?.creditScore ?? detailCard.sellerCreditScore ?? 60;
    const sellerVerificationStatus = seller?.verificationStatus ?? VerificationStatus.PENDING;
    const sellerAccountStatus = seller?.accountStatus ?? AccountStatus.ACTIVE;
    const avatarFrameUnlocked = seller ? await hasAvatarFrameRewardUnlocked(this.prisma, seller.id) : false;

    return {
      ...detailCard,
      images: images.length
        ? images.map((image) => image.imageUrl)
        : [detailCard.imageUrl],
      publishedAt: product.createdAt,
      seller: {
        id: seller?.id ?? product.sellerId,
        displayName: seller?.displayName ?? detailCard.sellerName,
        studentId: seller?.studentId ?? null,
        avatarUrl: seller?.avatarUrl ?? null,
        avatarFrame: avatarFrameUnlocked ? (seller?.avatarFrame ?? null) : null,
        creditScore: sellerCreditScore,
        creditLevel: getCreditLevel(sellerCreditScore),
        verificationStatus: sellerVerificationStatus,
        accountStatus: sellerAccountStatus,
        college: seller?.verification?.college ?? (sellerVerificationStatus === VerificationStatus.APPROVED ? '林学院' : '待认证'),
        averageRating,
        completedOrders
      },
      stats: {
        favoriteCount: detailCard.favoriteCount ?? favoriteCount,
        reportCount,
        wantCount,
        viewCount
      },
      compliance: {
        allowedCategory: allowedCategories.includes(normalizeProductCategoryName(product.category)),
        trustSignals: [sellerVerificationStatus === VerificationStatus.APPROVED ? '实名账号' : '待实名', `信用${sellerCreditScore}`, reportCount > 0 ? `近30天举报${reportCount}` : '近30天无举报'],
        reviewFlow: ['信息填写', '直接上架', '举报处置']
      },
      relatedProducts: relatedCards,
      detailBase: {
        id: detailCard.id,
        type: 'PRODUCT',
        title: detailCard.title,
        description: detailCard.description,
        price: detailCard.price,
        amountLabel: `¥${detailCard.price}`,
        imageUrl: detailCard.imageUrl,
        tags: detailCard.tags,
        summaryTags: detailCard.tags,
        status: detailCard.status,
        statusLabel: productStatusLabelMap[detailCard.status],
        publisher: {
          id: seller?.id ?? product.sellerId,
          displayName: seller?.displayName ?? detailCard.sellerName,
          studentId: seller?.studentId ?? null,
          avatarUrl: seller?.avatarUrl ?? null,
          avatarFrame: avatarFrameUnlocked ? (seller?.avatarFrame ?? null) : null,
          creditScore: sellerCreditScore,
          verificationStatus: sellerVerificationStatus,
          accountStatus: sellerAccountStatus
        },
        metaItems: [
          { key: 'category', label: '分类', value: detailCard.category },
          { key: 'seller-status', label: '卖家状态', value: sellerVerificationStatus === VerificationStatus.APPROVED ? '实名认证' : '普通账号' },
          { key: 'credit-level', label: '信用等级', value: getCreditLevel(sellerCreditScore) },
          { key: 'published-at', label: '发布时间', value: product.createdAt.toISOString() }
        ],
        timeline: [
          { key: 'published', label: '发布时间', value: product.createdAt.toISOString() },
          { key: 'updated', label: '最近变更', value: product.updatedAt.toISOString() }
        ]
      }
    };
  }

  async recordProductContact(id: number, currentUser: AuthenticatedUser) {
    const user = requireAuthenticatedUser(currentUser);
    const [product, account] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id },
        select: { id: true, sellerId: true }
      }),
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, accountStatus: true }
      })
    ]);

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    if (!account) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (account.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法联系卖家');
    }

    if (account.id === product.sellerId) {
      throw new BadRequestException('不能联系自己发布的商品');
    }

    await this.prisma.userBehavior.upsert({
      where: {
        userId_productId_eventType: {
          userId: account.id,
          productId: product.id,
          eventType: BehaviorEventType.CONTACT
        }
      },
      update: {},
      create: {
        userId: account.id,
        productId: product.id,
        eventType: BehaviorEventType.CONTACT
      }
    });

    return {
      productId: product.id,
      recorded: true
    };
  }


  async getDashboardStats() {
    try {
      const [userCount, productCount, onSaleCount] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.product.count(),
        this.prisma.product.count({ where: { status: ProductStatus.ON_SALE } })
      ]);

      return {
        userCount,
        productCount,
        onSaleCount
      };
    } catch (error) {
      console.error('ProductsService.getDashboardStats fallback:', error);
      return {
        userCount: 3,
        productCount: 0,
        onSaleCount: 0
      };
    }
  }

  async createProduct(payload: CreateProductDto, currentUser: AuthenticatedUser) {
    const sellerUser = requireAuthenticatedUser(currentUser);
    if (!isProductCategoryName(payload.category) || !allowedCategories.includes(payload.category)) {
      throw new BadRequestException('当前分类不支持发布');
    }
    if (!isProductConditionValue(payload.condition)) {
      throw new BadRequestException('当前成色不支持发布');
    }

    const normalizedTags = buildProductTags(payload);
    const normalizedImageUrls = (payload.imageUrls ?? [])
      .map((url) => url.trim())
      .filter(Boolean)
      .filter((url, index, list) => list.indexOf(url) === index)
      .slice(0, 6);

    if (!normalizedImageUrls.length) {
      throw new BadRequestException('请至少上传 1 张商品图片');
    }

    const seller = await this.prisma.user.findUnique({
      where: { id: sellerUser.id },
      select: { id: true, accountStatus: true }
    });

    if (!seller) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (seller.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法发布商品');
    }

    const product = await this.prisma.product.create({
      data: {
        sellerId: sellerUser.id,
        title: payload.title,
        description: payload.description,
        price: payload.price,
        category: payload.category,
        condition: payload.condition,
        tags: normalizedTags,
        status: ProductStatus.ON_SALE,
        images: normalizedImageUrls.length
          ? {
              create: normalizedImageUrls.map((imageUrl, index) => ({
                imageUrl,
                sortOrder: index
              }))
            }
          : undefined
      }
    });

    const vendureProduct = await this.vendureService.ensureProductVariant(product);
    const syncedProduct = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        vendureProductId: vendureProduct.id,
        vendureVariantId: vendureProduct.variantId
      }
    });

    await this.searchService.syncProduct(product.id);

    return {
      id: syncedProduct.id,
      title: syncedProduct.title,
      status: syncedProduct.status
    };
  }
}
