import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, BehaviorEventType, OrderStatus, Prisma, ProductStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAuthenticatedUser } from '../auth/auth.utils';
import { SearchService } from '../search/search.service';
import { isProductCategoryName, normalizeProductCategoryName, PRODUCT_CATEGORY_NAMES } from './product-categories';
import { isProductConditionValue, PRODUCT_CONDITION_VALUES } from './product-conditions';
import { CreateProductDto } from './dto/create-product.dto';
import { SearchProductsDto } from './dto/search-products.dto';

const DEMO_PRODUCT_IMAGE = '/images/products/demo-square.png';

const allowedCategories = [...PRODUCT_CATEGORY_NAMES];
const prohibitedKeywords = ['刀具', '代抢', '账号', '药品', '烟草', '酒精', '发票', '银行卡', '代写', '代考', '外挂', '校园贷'];
const dormElectricalWhitelist = ['电脑', '非充电台灯', '手机', '平板电脑', '20000mAh以下充电宝', '电动牙刷', '电动剃须刀', '相机'];
const dormElectricalKeywords = [
  '吹风机',
  '电吹风',
  '卷发棒',
  '直板夹',
  '电热水壶',
  '烧水壶',
  '热水壶',
  '养生壶',
  '电饭锅',
  '电煮锅',
  '电热杯',
  '电热饭盒',
  '暖手宝',
  '电热毯',
  '取暖器',
  '电暖器',
  '小太阳',
  '电磁炉',
  '煮蛋器',
  '咖啡机',
  '破壁机',
  '榨汁机',
  '空气炸锅',
  '加湿器',
  '小风扇'
];
const communityNotices = [
  '宿舍电器按白名单发布，未列入的新旧小家电不进入审核池，系统会直接驳回。',
  '交易建议优先选择图书馆、食堂、公寓楼下等校内公共区域，当面验货后再确认。',
  '教材资料、数码配件和生活用品请写清成色、配件、容量或版本，避免误导同学。',
  '平台禁止账号、代写代考、烟酒药品、刀具、校园贷等内容，违规账号会被限制发布。'
];
const productStatusLabelMap: Record<ProductStatus, string> = {
  ON_SALE: '在售',
  PENDING: '审核中',
  SOLD: '已售',
  OFFLINE: '已下架'
};
const ruleHighlights = [
  '禁售词自动审核命中后直接驳回',
  '宿舍电器仅允许白名单范围内发布',
  '充电宝需标明容量且不超过 20000mAh',
  '商品通过后仍保留人工巡检和举报下架'
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

function normalizeAuditContent(payload: Pick<CreateProductDto, 'title' | 'description' | 'category' | 'tags'>) {
  return `${payload.title} ${payload.description} ${payload.category} ${(payload.tags ?? []).join(' ')}`.toLowerCase();
}

function extractPowerBankCapacity(content: string) {
  const match = content.match(/(\d{4,5})\s*(?:mah|ma|毫安)/i);
  return match ? Number(match[1]) : null;
}

function matchesAllowedDormElectrical(content: string) {
  if (/(电脑|笔记本|台式机|手机|平板|ipad|电动牙刷|电动剃须刀|剃须刀|相机|单反|微单)/i.test(content)) {
    return true;
  }

  if (/(台灯|阅读灯|护眼灯)/.test(content)) {
    if (/(非充电|不充电|插电|有线)/.test(content)) {
      return true;
    }

    return !/(充电|无线|锂电|电池)/.test(content);
  }

  if (/(充电宝|移动电源|powerbank)/i.test(content)) {
    const capacity = extractPowerBankCapacity(content);
    return capacity !== null && capacity <= 20000;
  }

  return false;
}

function rejectReasonForDormElectrical(content: string) {
  const powerBankCapacity = /(充电宝|移动电源|powerbank)/i.test(content) ? extractPowerBankCapacity(content) : null;
  if (/(充电宝|移动电源|powerbank)/i.test(content) && (powerBankCapacity === null || powerBankCapacity > 20000)) {
    return '充电宝需标明容量且不超过 20000mAh';
  }

  if (/(台灯|阅读灯|护眼灯)/.test(content) && /(充电|无线|锂电|电池)/.test(content)) {
    return '宿舍台灯仅允许非充电款';
  }

  return '宿舍电器不在白名单内';
}

function getModerationRejectReason(payload: Pick<CreateProductDto, 'title' | 'description' | 'category' | 'tags'>) {
  const content = normalizeAuditContent(payload);
  const blockedKeyword = prohibitedKeywords.find((keyword) => content.includes(keyword.toLowerCase()));
  if (blockedKeyword) {
    return `包含禁售内容：${blockedKeyword}`;
  }

  const blockedDormElectrical = dormElectricalKeywords.find((keyword) => content.includes(keyword.toLowerCase()));
  if (blockedDormElectrical) {
    return '宿舍电器不在白名单内';
  }

  const normalizedCategory = normalizeProductCategoryName(payload.category);
  const mentionsDormElectrical = normalizedCategory === '宿舍生活' ||
    /(充电宝|移动电源|powerbank|台灯|阅读灯|护眼灯|电脑|笔记本|台式机|手机|平板|ipad|电动牙刷|电动剃须刀|剃须刀|相机|单反|微单)/i.test(content);
  if (mentionsDormElectrical && !matchesAllowedDormElectrical(content)) {
    return rejectReasonForDormElectrical(content);
  }

  return null;
}

@Injectable()
export class ProductsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SearchService)
    private readonly searchService: SearchService
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

    const [sellers, images, favoriteCounts, favoritedProductIds] = await Promise.all([
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
      reviewFlow: ['实名认证', '自动审核', '人工审核', '通过上架'],
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
      await this.prisma.userBehavior.create({
        data: {
          userId,
          productId: product.id,
          eventType: 'VIEW'
        }
      });
    }

    const [seller, images, relatedProducts, reportCount, favoriteCount, viewCount, sellerOrders, sellerMessages] = await Promise.all([
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
          eventType: BehaviorEventType.VIEW
        }
      }),
      this.prisma.order.findMany({
        where: { sellerId: product.sellerId },
        select: { id: true, status: true }
      }),
      this.prisma.message.count({
        where: { senderId: product.sellerId }
      })
    ]);

    const sellerOrderIds = sellerOrders.map((order) => order.id);
    const sellerReviews = sellerOrderIds.length
      ? await this.prisma.review.findMany({
          where: { orderId: { in: sellerOrderIds } },
          select: { rating: true }
        })
      : [];

    const relatedCards = await this.buildProductCards(relatedProducts, userId);
    const responseRate = Math.min(99, (seller?.verificationStatus === VerificationStatus.APPROVED ? 88 : 76) + Math.min(10, Math.floor(sellerMessages / 4)));
    const completedOrders = sellerOrders.filter((order) => order.status === OrderStatus.COMPLETED).length;
    const averageRating = sellerReviews.length
      ? Number((sellerReviews.reduce((sum, review) => sum + review.rating, 0) / sellerReviews.length).toFixed(1))
      : 4.8;

    const detailCard = (await this.buildProductCards([product], userId))[0];
    const sellerCreditScore = seller?.creditScore ?? detailCard.sellerCreditScore ?? 60;
    const sellerVerificationStatus = seller?.verificationStatus ?? VerificationStatus.PENDING;
    const sellerAccountStatus = seller?.accountStatus ?? AccountStatus.ACTIVE;

    return {
      ...detailCard,
      images: images.length
        ? images.map((image) => image.imageUrl)
        : [detailCard.imageUrl],
      publishedAt: product.createdAt,
      seller: {
        id: seller?.id ?? product.sellerId,
        displayName: seller?.displayName ?? detailCard.sellerName,
        creditScore: sellerCreditScore,
        creditLevel: getCreditLevel(sellerCreditScore),
        verificationStatus: sellerVerificationStatus,
        accountStatus: sellerAccountStatus,
        college: seller?.verification?.college ?? (sellerVerificationStatus === VerificationStatus.APPROVED ? '林学院' : '待认证'),
        responseRate,
        averageRating,
        completedOrders
      },
      stats: {
        favoriteCount: detailCard.favoriteCount ?? favoriteCount,
        reportCount,
        wantCount: detailCard.favoriteCount ?? favoriteCount,
        viewCount
      },
      compliance: {
        allowedCategory: allowedCategories.includes(normalizeProductCategoryName(product.category)),
        trustSignals: [sellerVerificationStatus === VerificationStatus.APPROVED ? '实名账号' : '待实名', `信用${sellerCreditScore}`, reportCount > 0 ? `近30天举报${reportCount}` : '近30天无举报'],
        reviewFlow: ['内容校验', '人工巡检', '异常下架']
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
          creditScore: sellerCreditScore,
          verificationStatus: sellerVerificationStatus,
          accountStatus: sellerAccountStatus
        },
        metaItems: [
          { key: 'category', label: '分类', value: detailCard.category },
          { key: 'condition', label: '成色', value: detailCard.condition },
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

  async getDashboardStats() {
    try {
      const [userCount, productCount, pendingCount] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.product.count(),
        this.prisma.product.count({ where: { status: ProductStatus.PENDING } })
      ]);

      return {
        userCount,
        productCount,
        pendingCount
      };
    } catch (error) {
      console.error('ProductsService.getDashboardStats fallback:', error);
      return {
        userCount: 3,
        productCount: 0,
        pendingCount: 1
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

    const rejectReason = getModerationRejectReason({
      ...payload,
      tags: normalizedTags
    });
    if (rejectReason) {
      throw new BadRequestException(`自动审核未通过：${rejectReason}`);
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
        status: ProductStatus.PENDING,
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

    await this.searchService.syncProduct(product.id);

    return {
      id: product.id,
      title: product.title,
      status: product.status
    };
  }
}
