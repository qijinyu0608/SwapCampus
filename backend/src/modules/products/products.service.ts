import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { CreateProductDto } from './dto/create-product.dto';

const TARGET_SEED_COUNT = 360;

const fallbackProducts = [
  {
    id: 1,
    title: '高等数学同济版上下册',
    category: '教材',
    price: 28,
    condition: '9成新',
    tags: ['教材', '期末', '低价'],
    status: 'ON_SALE',
    description: '少量重点标记，在北林图书馆或学研中心A座面交更方便。',
    sellerName: '林舟',
    sellerCreditScore: 92,
    sellerVerified: true,
    recommendationReason: '同校',
    imageUrl: '/images/products/books-1.jpg'
  },
  {
    id: 2,
    title: '罗技机械键盘 K 系列',
    category: '数码',
    price: 118,
    condition: '95新',
    tags: ['数码', '键盘', '可验货'],
    status: 'PENDING',
    description: '轴体和接口都正常，13号公寓或信息楼附近可直接试。',
    sellerName: '周砚',
    sellerCreditScore: 86,
    sellerVerified: true,
    recommendationReason: '新上',
    imageUrl: '/images/products/keyboard.jpg'
  },
  {
    id: 3,
    title: '护眼宿舍台灯',
    category: '宿舍好物',
    price: 43,
    condition: '8成新',
    tags: ['台灯', '宿舍', '护眼'],
    status: 'ON_SALE',
    description: '期末周自习一直在用，亮度稳定，今晚可在学一食堂附近面交。',
    sellerName: '唐悦',
    sellerCreditScore: 84,
    sellerVerified: true,
    recommendationReason: '信用好',
    imageUrl: '/images/products/lamp.jpg'
  },
  {
    id: 4,
    title: '宿舍三层收纳架',
    category: '生活用品',
    price: 27,
    condition: '9成新',
    tags: ['生活用品', '收纳', '宿舍'],
    status: 'ON_SALE',
    description: '搬寝室整理出来的，放零食和洗漱用品都方便，学二食堂可面交。',
    sellerName: '许晴',
    sellerCreditScore: 88,
    sellerVerified: true,
    recommendationReason: '同校',
    imageUrl: '/images/products/storage-shelf.jpg'
  },
  {
    id: 5,
    title: '羽毛球拍双拍套装',
    category: '运动器材',
    price: 58,
    condition: '9成新',
    tags: ['运动器材', '羽毛球', '社团'],
    status: 'ON_SALE',
    description: '社团活动后闲置，拍线状态正常，田家炳体育馆附近可试看。',
    sellerName: '陈诺',
    sellerCreditScore: 82,
    sellerVerified: true,
    recommendationReason: '同校',
    imageUrl: '/images/products/badminton.jpg'
  },
  {
    id: 6,
    title: '校园骑行头盔',
    category: '自行车',
    price: 48,
    condition: '9成新',
    tags: ['自行车', '头盔', '通勤'],
    status: 'ON_SALE',
    description: '平时骑车去教学楼戴过，没有磕碰，内衬干净。',
    sellerName: '沈一',
    sellerCreditScore: 79,
    sellerVerified: true,
    recommendationReason: '信用好',
    imageUrl: '/images/products/badminton.jpg'
  },
  {
    id: 7,
    title: '卡西欧函数计算器',
    category: '文具',
    price: 55,
    condition: '95新',
    tags: ['文具', '计算器', '考试'],
    status: 'ON_SALE',
    description: '按键和显示都正常，考试周和课程作业都能继续用。',
    sellerName: '吴嘉',
    sellerCreditScore: 90,
    sellerVerified: true,
    recommendationReason: '信用好',
    imageUrl: '/images/products/books-1.jpg'
  },
  {
    id: 8,
    title: '20000mAh 以下充电宝',
    category: '小家电',
    price: 30,
    condition: '9成新',
    tags: ['小家电', '充电宝', '宿舍白名单'],
    status: 'ON_SALE',
    description: '容量 10000mAh，接口和充电状态正常，支持当面试用。',
    sellerName: '赵川',
    sellerCreditScore: 76,
    sellerVerified: true,
    recommendationReason: '同校',
    imageUrl: '/images/products/powerbank.png'
  },
  {
    id: 9,
    title: '运动外套 M 码',
    category: '鞋服',
    price: 36,
    condition: '9成新',
    tags: ['鞋服', '外套', 'M码'],
    status: 'ON_SALE',
    description: '秋季上课穿过几次，洗净后一直放柜子里。',
    sellerName: '郑宁',
    sellerCreditScore: 83,
    sellerVerified: true,
    recommendationReason: '同校',
    imageUrl: '/images/products/clothing-rack.jpg'
  },
  {
    id: 10,
    title: '考研政治冲刺资料',
    category: '考研资料',
    price: 26,
    condition: '9成新',
    tags: ['考研资料', '政治', '冲刺'],
    status: 'ON_SALE',
    description: '重点内容完整，后期背诵和刷题都还能继续用，图书馆可面交。',
    sellerName: '宋禾',
    sellerCreditScore: 87,
    sellerVerified: true,
    recommendationReason: '同校',
    imageUrl: '/images/products/books-2.jpg'
  }
];

const allowedCategories = ['教材', '数码', '生活用品', '运动器材', '宿舍好物', '自行车', '文具', '小家电', '鞋服', '考研资料'];
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
const ruleHighlights = [
  '禁售词自动审核命中后直接驳回',
  '宿舍电器仅允许白名单范围内发布',
  '充电宝需标明容量且不超过 20000mAh',
  '商品通过后仍保留人工巡检和举报下架'
];
const categoryImageMap: Record<string, string[]> = {
  教材: ['/images/products/books-1.jpg', '/images/products/books-2.jpg'],
  数码: ['/images/products/keyboard.jpg', '/images/products/powerbank.png'],
  生活用品: ['/images/products/clothing-rack.jpg', '/images/products/storage-shelf.jpg', '/images/products/plush.jpg'],
  运动器材: ['/images/products/badminton.jpg'],
  宿舍好物: ['/images/products/lamp.jpg', '/images/products/fan.jpg', '/images/products/storage-shelf.jpg'],
  自行车: ['/images/products/badminton.jpg', '/images/products/storage-shelf.jpg'],
  文具: ['/images/products/books-1.jpg', '/images/products/books-2.jpg'],
  小家电: ['/images/products/fan.jpg', '/images/products/lamp.jpg'],
  鞋服: ['/images/products/clothing-rack.jpg', '/images/products/plush.jpg'],
  考研资料: ['/images/products/books-2.jpg', '/images/products/books-1.jpg']
};

function resolveDefaultImagePool(category: string, title: string) {
  if (/(教材|真题|笔记|复习|英语|数学|专业课|活页本|荧光笔|计算器|资料)/.test(title)) {
    return ['/images/products/books-1.jpg', '/images/products/books-2.jpg'];
  }

  if (/(键盘)/.test(title)) {
    return ['/images/products/keyboard.jpg'];
  }

  if (/(充电宝|电源)/.test(title)) {
    return ['/images/products/powerbank.png'];
  }

  if (/(台灯|阅读灯|夜灯)/.test(title)) {
    return ['/images/products/lamp.jpg'];
  }

  if (/(风扇)/.test(title)) {
    return ['/images/products/fan.jpg'];
  }

  if (/(羽毛球|跳绳|护腕|头盔|骑行)/.test(title)) {
    return ['/images/products/badminton.jpg'];
  }

  if (/(衣架|衣服|外套|卫衣|鞋|拖鞋|双肩包)/.test(title)) {
    return ['/images/products/clothing-rack.jpg'];
  }

  if (/(收纳|置物|推车|文件架|书桌)/.test(title)) {
    return ['/images/products/storage-shelf.jpg'];
  }

  if (/(靠垫|毛绒)/.test(title)) {
    return ['/images/products/plush.jpg'];
  }

  return categoryImageMap[category] ?? categoryImageMap.宿舍好物;
}

function normalizeTags(tags: string) {
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildProductTags(payload: Pick<CreateProductDto, 'title' | 'category' | 'condition' | 'tags'>) {
  const manualTags = (payload.tags ?? '')
    .split(/[，,、/\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  const fallbackTitle = normalizeProductTitle(payload.title).slice(0, 12);
  const combinedTags = [
    ...manualTags,
    payload.category,
    payload.condition,
    fallbackTitle
  ].filter(Boolean);

  return combinedTags
    .filter((tag, index) => combinedTags.indexOf(tag) === index)
    .slice(0, 4)
    .join(',');
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

function normalizeProductTitle(title: string) {
  return title
    .replace(/\s+(95新|9成新|8成新)$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAuditContent(payload: Pick<CreateProductDto, 'title' | 'description' | 'category' | 'tags'>) {
  return `${payload.title} ${payload.description} ${payload.category} ${payload.tags ?? ''}`.toLowerCase();
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

  const mentionsDormElectrical = payload.category === '小家电' ||
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
    @Inject(RecommendationsService)
    private readonly recommendationsService?: RecommendationsService
  ) {}

  private async buildProductCards(products: Array<{
    id: number;
    sellerId: number;
    title: string;
    category: string;
    price: unknown;
    condition: string;
    tags: string;
    status: ProductStatus;
    description: string;
  }>) {
    const sellerIds = [...new Set(products.map((product) => product.sellerId))];
    const productIds = products.map((product) => product.id);

    const [sellers, images] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, name: true, creditScore: true, isVerified: true }
      }),
      this.prisma.productImage.findMany({
        where: { productId: { in: productIds } },
        orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }]
      })
    ]);

    const sellerMap = new Map(sellers.map((seller) => [seller.id, seller]));
    const imageMap = new Map<number, string>();

    images.forEach((image) => {
      if (!imageMap.has(image.productId)) {
        imageMap.set(image.productId, image.imageUrl);
      }
    });

    return products.map((product) => ({
      id: product.id,
      title: product.title,
      category: product.category,
      price: Number(product.price),
      condition: product.condition,
      tags: normalizeTags(product.tags),
      status: product.status,
      description: product.description,
      sellerId: product.sellerId,
      sellerName: sellerMap.get(product.sellerId)?.name ?? `用户#${product.sellerId}`,
      sellerCreditScore: sellerMap.get(product.sellerId)?.creditScore ?? 60,
      sellerVerified: sellerMap.get(product.sellerId)?.isVerified ?? false,
      recommendationReason: '同校',
      imageUrl: imageMap.get(product.id) ?? getDefaultImageUrl(product.id, product.category, product.title)
    }));
  }

  private async getPreferenceProfile(userId?: number) {
    if (this.recommendationsService) {
      return this.recommendationsService.getPreferenceProfile(userId);
    }

    const emptyProfile = {
      preferredCategories: new Set<string>(),
      preferredTags: new Set<string>(),
      activeFavoriteIds: new Set<number>(),
      viewedProductIds: new Set<number>(),
      categoryWeights: new Map<string, number>(),
      tagWeights: new Map<string, number>()
    };

    const preferredCategories = new Set<string>();
    const preferredTags = new Set<string>();

    if (!userId) {
      return emptyProfile;
    }

    const [orders, conversations] = await Promise.all([
      this.prisma.order.findMany({
        where: { buyerId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { productId: true }
      }),
      this.prisma.conversation.findMany({
        where: {
          messages: {
            some: { senderId: userId }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { productId: true }
      })
    ]);

    const productIds = [...new Set([...orders, ...conversations].map((item) => item.productId).filter(Boolean))] as number[];
    if (!productIds.length) {
      return emptyProfile;
    }

    const behaviorProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { category: true, tags: true }
    });

    behaviorProducts.forEach((product) => {
      preferredCategories.add(product.category);
      normalizeTags(product.tags).forEach((tag) => preferredTags.add(tag));
    });

    return {
      preferredCategories,
      preferredTags,
      activeFavoriteIds: new Set<number>(),
      viewedProductIds: new Set<number>(),
      categoryWeights: new Map(Array.from(preferredCategories).map((item) => [item, 18])),
      tagWeights: new Map(Array.from(preferredTags).map((item) => [item, 10]))
    };
  }

  private inferRecommendationReason(
    product: { id?: number; category: string; tags: string[]; sellerVerified: boolean },
    profile?: {
      preferredCategories?: Set<string>;
      preferredTags?: Set<string>;
      activeFavoriteIds?: Set<number>;
      categoryWeights?: Map<string, number>;
      tagWeights?: Map<string, number>;
    }
  ) {
    if (!profile) {
      return product.sellerVerified ? '信用好' : '同校';
    }

    if (product.id && profile.activeFavoriteIds?.has(product.id)) {
      return '想要过';
    }

    const categoryMatched =
      profile.preferredCategories?.has(product.category) ||
      (profile.categoryWeights?.get(product.category) ?? 0) >= 14;

    if (categoryMatched) {
      return '同类';
    }

    const tagMatched = product.tags.some((tag) =>
      profile.preferredTags?.has(tag) || (profile.tagWeights?.get(tag) ?? 0) >= 8
    );

    if (tagMatched) {
      return '常看';
    }

    return product.sellerVerified ? '信用好' : '同校';
  }

  private keepUniqueTitles<T extends { title: string }>(items: T[], limit?: number) {
    const seen = new Set<string>();
    const unique: T[] = [];

    for (const item of items) {
      const normalizedTitle = normalizeProductTitle(item.title);
      if (seen.has(normalizedTitle)) {
        continue;
      }
      seen.add(normalizedTitle);
      unique.push(item);
      if (limit && unique.length >= limit) {
        break;
      }
    }

    return unique;
  }

  async listProducts() {
    try {
      const products = await this.prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        take: 240
      });

      const cards = await this.buildProductCards(products);
      return this.keepUniqueTitles(cards, 60);
    } catch (error) {
      console.error('ProductsService.listProducts fallback:', error);
      return fallbackProducts;
    }
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

  async getRecommendations(userId?: number) {
    try {
      const candidateProducts = await this.prisma.product.findMany({
        where: { status: ProductStatus.ON_SALE },
        orderBy: { createdAt: 'desc' },
        take: 180
      });

      const [cards, profile] = await Promise.all([
        this.buildProductCards(candidateProducts),
        this.getPreferenceProfile(userId)
      ]);
      const popularityMap = this.recommendationsService
        ? await this.recommendationsService.getPopularityMap(cards.map((item) => item.id))
        : new Map<number, { favoriteCount: number; orderCount: number; reportCount: number }>();

      return this.keepUniqueTitles(
        cards
        .filter((product, index) => (userId ? product.sellerId !== userId : true))
        .map((product, index) => {
          const matchedTagCount = product.tags.filter((tag) =>
            profile.preferredTags?.has(tag) || (profile.tagWeights?.get(tag) ?? 0) >= 8
          ).length;
          const categoryMatched =
            profile.preferredCategories?.has(product.category) ||
            (profile.categoryWeights?.get(product.category) ?? 0) >= 14;
          const popularity = popularityMap.get(product.id) ?? { favoriteCount: 0, orderCount: 0, reportCount: 0 };
          const score =
            (categoryMatched ? 45 : 0) +
            matchedTagCount * 9 +
            (profile.activeFavoriteIds?.has(product.id) ? 24 : 0) +
            (profile.viewedProductIds?.has(product.id) ? 12 : 0) +
            Math.round(product.sellerCreditScore / 8) +
            (product.sellerVerified ? 10 : 0) +
            popularity.favoriteCount * 6 +
            popularity.orderCount * 10 -
            popularity.reportCount * 12 +
            Math.max(0, 18 - index / 3);

          return {
            ...product,
            recommendationReason: this.inferRecommendationReason(product, profile),
            score
          };
        })
        .sort((left, right) => right.score - left.score)
        .map(({ score, ...product }) => product),
        36
      );
    } catch (error) {
      console.error('ProductsService.getRecommendations fallback:', error);
      return this.listProducts();
    }
  }

  async getProductDetail(id: number, userId?: number) {
    const product = await this.prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    const [seller, images, relatedProducts, reportCount, favoriteCount, sellerOrders, sellerMessages] = await Promise.all([
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

    const relatedCards = await this.buildProductCards(relatedProducts);
    const profile = await this.getPreferenceProfile(userId);
    const responseRate = Math.min(99, (seller?.isVerified ? 88 : 76) + Math.min(10, Math.floor(sellerMessages / 4)));
    const completedOrders = sellerOrders.filter((order) => order.status === OrderStatus.COMPLETED).length;
    const averageRating = sellerReviews.length
      ? Number((sellerReviews.reduce((sum, review) => sum + review.rating, 0) / sellerReviews.length).toFixed(1))
      : 4.8;

    const detailCard = (await this.buildProductCards([product]))[0];

    return {
      ...detailCard,
      images: images.length
        ? images.map((image) => image.imageUrl)
        : [detailCard.imageUrl],
      publishedAt: product.createdAt,
      seller: {
        id: seller?.id ?? product.sellerId,
        name: seller?.name ?? detailCard.sellerName,
        creditScore: seller?.creditScore ?? detailCard.sellerCreditScore,
        creditLevel: getCreditLevel(seller?.creditScore ?? detailCard.sellerCreditScore),
        verified: seller?.isVerified ?? detailCard.sellerVerified,
        identityStatus: seller?.verification?.status ?? (seller?.isVerified ? 'APPROVED' : 'PENDING'),
        college: seller?.verification?.college ?? (seller?.isVerified ? '林学院' : '待认证'),
        responseRate,
        averageRating,
        completedOrders
      },
      stats: {
        favoriteCount,
        reportCount,
        wantCount: favoriteCount + 12,
        viewCount: favoriteCount * 7 + 126
      },
      compliance: {
        allowedCategory: allowedCategories.includes(product.category),
        trustSignals: [seller?.isVerified ? '实名账号' : '待实名', `信用${seller?.creditScore ?? detailCard.sellerCreditScore}`, reportCount > 0 ? `近30天举报${reportCount}` : '近30天无举报'],
        reviewFlow: ['内容校验', '人工巡检', '异常下架']
      },
      recommendationReason: this.inferRecommendationReason(detailCard, profile),
      relatedProducts: this.keepUniqueTitles(
        relatedCards.map((item) => ({
          ...item,
          recommendationReason: this.inferRecommendationReason(item, profile)
        })),
        4
      )
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
        pendingCount,
        targetSeedCount: TARGET_SEED_COUNT
      };
    } catch (error) {
      console.error('ProductsService.getDashboardStats fallback:', error);
      return {
        userCount: 3,
        productCount: fallbackProducts.length,
        pendingCount: 1,
        targetSeedCount: TARGET_SEED_COUNT
      };
    }
  }

  async createProduct(payload: CreateProductDto) {
    if (!allowedCategories.includes(payload.category)) {
      throw new BadRequestException('当前分类不支持发布');
    }

    const normalizedTags = buildProductTags(payload);

    const seller = await this.prisma.user.findUnique({
      where: { id: payload.sellerId },
      select: { id: true, isBanned: true }
    });

    if (!seller) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (seller.isBanned) {
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
        sellerId: payload.sellerId,
        title: payload.title,
        description: payload.description,
        price: payload.price,
        category: payload.category,
        condition: payload.condition,
        tags: normalizedTags,
        status: ProductStatus.PENDING
      }
    });

    return {
      id: product.id,
      title: product.title,
      status: product.status
    };
  }
}
