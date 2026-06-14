import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  AccountStatus,
  BehaviorEventType,
  CampusServiceCategory,
  CampusServiceIntent,
  CampusServiceListingStatus,
  CampusServicePriceMode,
  OrderStatus,
  Prisma,
  ProductStatus,
  UserRole,
  VerificationStatus
} from '@prisma/client';
import { convertToRecipeUserId } from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAdminUser, requireAuthenticatedUser } from '../auth/auth.utils';
import {
  cancelCampusServicesForUser,
  loadCampusServiceActivityStats
} from '../campus-services/campus-service-moderation';
import { SearchService } from '../search/search.service';
import { UpdateBanStatusDto } from './dto/update-ban-status.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

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

const collegeOptions = [
  '林学院',
  '水土保持学院',
  '生物科学与技术学院',
  '园林学院',
  '经济管理学院',
  '工学院',
  '材料科学与技术学院',
  '人文社会科学学院',
  '外语学院',
  '信息学院',
  '理学院',
  '生态与自然保护学院',
  '环境科学与工程学院',
  '艺术设计学院',
  '马克思主义学院',
  '草业与草原学院',
  '继续教育学院',
  '国际学院'
];

const campusServiceCategoryLabelMap: Record<CampusServiceCategory, string> = {
  ERRAND: '跑腿',
  AGENCY: '代办',
  GROUP_BUY: '拼单',
  MOVING: '搬运',
  TUTORING: '辅导',
  SKILL: '技能',
  REPAIR: '维修',
  EVENT: '活动协助',
  OTHER: '其他',
  HELP: '临时帮忙'
};

const campusServiceIntentLabelMap: Record<CampusServiceIntent, string> = {
  REQUEST: '找人帮我',
  OFFER: '我来提供'
};

const campusServiceListingStatusLabelMap: Record<CampusServiceListingStatus, string> = {
  OPEN: '可接单',
  BUSY: '名额已满',
  PAUSED: '已暂停',
  ENDED: '已结束',
  CANCELED: '已关闭'
};

function normalizePagination(page?: number, pageSize?: number) {
  const normalizedPage = Number.isFinite(page) && page && page > 0 ? Math.floor(page) : 1;
  const normalizedPageSize = Number.isFinite(pageSize) && pageSize && pageSize > 0
    ? Math.min(50, Math.max(5, Math.floor(pageSize)))
    : 8;

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    skip: (normalizedPage - 1) * normalizedPageSize
  };
}

function normalizeTags(tags: Prisma.JsonValue | null) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(Boolean);
}

function toNumber(value: unknown) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const next = Number(value);
    return Number.isFinite(next) ? next : 0;
  }

  if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber();
  }

  return 0;
}

function formatCurrency(amount: unknown) {
  return `¥${toNumber(amount).toFixed(2)}`;
}

function formatCampusServiceReward(priceMode: CampusServicePriceMode, amount: unknown) {
  if (priceMode === CampusServicePriceMode.NEGOTIABLE) {
    return '面议';
  }

  if (priceMode === CampusServicePriceMode.FREE) {
    return '免费';
  }

  return formatCurrency(amount);
}

type UserHistoryListParams = {
  page?: number;
  pageSize?: number;
  currentUser?: AuthenticatedUser;
};

type UserFollowingListParams = {
  page?: number;
  pageSize?: number;
  currentUser?: AuthenticatedUser;
};

type FollowUserSummary = {
  id: number;
  displayName: string;
  studentId: string | null;
  email: string;
  avatarUrl: string | null;
  avatarFrame: string | null;
  creditScore: number;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  verification: {
    college: string;
  } | null;
  activeProductCount: number;
  followerCount: number;
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SearchService)
    private readonly searchService: SearchService
  ) {}

  private mapSuperTokensError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('No SuperTokens core available to query')) {
      throw new ServiceUnavailableException('认证服务未就绪，请稍后重试');
    }

    throw error;
  }

  private async syncCredentialEmail(user: {
    supertokensUserId: string | null;
    email: string;
  }, nextEmail?: string) {
    const normalizedEmail = nextEmail?.trim().toLowerCase();
    if (!normalizedEmail || normalizedEmail === user.email || !user.supertokensUserId) {
      return;
    }

    let result: Awaited<ReturnType<typeof EmailPassword.updateEmailOrPassword>>;
    try {
      result = await EmailPassword.updateEmailOrPassword({
        recipeUserId: convertToRecipeUserId(user.supertokensUserId),
        email: normalizedEmail,
        userContext: {}
      });
    } catch (error) {
      this.mapSuperTokensError(error);
    }

    if (result.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
      throw new ConflictException('邮箱已被使用');
    }

    if (result.status === 'UNKNOWN_USER_ID_ERROR') {
      throw new BadRequestException('认证账号映射失效，请重新登录后再修改邮箱');
    }
  }

  private mapProfile(user: {
    id: number;
    displayName: string;
    studentId: string | null;
    email: string;
    avatarUrl: string | null;
    avatarFrame: string | null;
    role: UserRole;
    creditScore: number;
    verificationStatus: VerificationStatus;
    accountStatus: AccountStatus;
    verification: {
      realName: string;
      college: string;
      phone: string;
    } | null;
  }) {
    return {
      id: user.id,
      displayName: user.displayName,
      studentId: user.studentId,
      email: user.email,
      avatarUrl: user.avatarUrl,
      avatarFrame: user.avatarFrame,
      role: user.role,
      creditScore: user.creditScore,
      verificationStatus: user.verificationStatus,
      accountStatus: user.accountStatus,
      realName: user.verification?.realName ?? user.displayName,
      college: user.verification?.college ?? '待填写',
      phone: user.verification?.phone ?? '待填写'
    };
  }

  private async buildProductCards(
    products: Array<{
      id: number;
      sellerId: number;
      title: string;
      category: string;
      price: Prisma.Decimal | number;
      condition: string;
      tags: Prisma.JsonValue | null;
      status: ProductStatus;
      description: string;
    }>,
    currentUserId?: number
  ) {
    if (!products.length) {
      return [];
    }

    const sellerIds = [...new Set(products.map((product) => product.sellerId))];
    const productIds = products.map((product) => product.id);

    const [sellers, images, favoriteCounts, favoritedProducts] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, displayName: true, creditScore: true, verificationStatus: true }
      }),
      this.prisma.productImage.findMany({
        where: { productId: { in: productIds } },
        orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }],
        select: { productId: true, imageUrl: true }
      }),
      this.prisma.favorite.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _count: { _all: true }
      }),
      currentUserId
        ? this.prisma.favorite.findMany({
            where: {
              userId: currentUserId,
              productId: { in: productIds }
            },
            select: { productId: true, createdAt: true }
          })
        : Promise.resolve([])
    ]);

    const sellerMap = new Map(sellers.map((seller) => [seller.id, seller]));
    const favoriteCountMap = new Map(favoriteCounts.map((item) => [item.productId, item._count._all]));
    const favoritedMap = new Map(favoritedProducts.map((item) => [item.productId, item.createdAt]));
    const imageMap = new Map<number, string>();

    images.forEach((image) => {
      if (!imageMap.has(image.productId)) {
        imageMap.set(image.productId, image.imageUrl);
      }
    });

    return products.map((product) => {
      const seller = sellerMap.get(product.sellerId);
      const favoritedAt = favoritedMap.get(product.id);

      return {
        id: product.id,
        title: product.title,
        category: product.category,
        price: Number(product.price),
        condition: product.condition,
        tags: normalizeTags(product.tags),
        status: product.status,
        description: product.description,
        sellerId: product.sellerId,
        sellerName: seller?.displayName ?? `用户#${product.sellerId}`,
        sellerCreditScore: seller?.creditScore ?? 60,
        sellerVerified: seller?.verificationStatus === VerificationStatus.APPROVED,
        imageUrl: imageMap.get(product.id) ?? '/images/products/demo-square.png',
        favoriteCount: favoriteCountMap.get(product.id) ?? 0,
        isFavorited: Boolean(favoritedAt),
        favoritedAt: favoritedAt ?? null
      };
    });
  }

  private mapFollowUser(user: FollowUserSummary, followedAt?: Date) {
    return {
      id: user.id,
      displayName: user.displayName,
      studentId: user.studentId,
      email: user.email,
      avatarUrl: user.avatarUrl,
      avatarFrame: user.avatarFrame,
      creditScore: user.creditScore,
      verificationStatus: user.verificationStatus,
      accountStatus: user.accountStatus,
      college: user.verification?.college ?? '待填写',
      activeProductCount: user.activeProductCount,
      followerCount: user.followerCount,
      followedAt: followedAt?.toISOString() ?? null
    };
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { verification: true }
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return this.mapProfile(user);
  }

  async getTrustSummary(userId: number, currentUser?: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { verification: true }
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const [allOrders, reviews, reports, followerCount, isFollowing] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          OR: [{ buyerId: userId }, { sellerId: userId }]
        },
        select: { status: true }
      }),
      this.prisma.review.findMany({
        where: { reviewerId: userId },
        select: { rating: true }
      }),
      this.prisma.report.count({
        where: { targetUserId: userId }
      }),
      this.prisma.userFollow.count({
        where: { followingId: userId }
      }),
      currentUser
        ? this.prisma.userFollow.findUnique({
            where: {
              followerId_followingId: {
                followerId: currentUser.id,
                followingId: userId
              }
            },
            select: { id: true }
          })
        : Promise.resolve(null)
    ]);

    const completedOrders = allOrders.filter((order: { status: OrderStatus }) => order.status === OrderStatus.COMPLETED).length;
    const activeOrders = allOrders.filter((order: { status: OrderStatus }) => order.status === OrderStatus.IN_PROGRESS || order.status === OrderStatus.PENDING).length;
    const waitingReviews = allOrders.filter((order: { status: OrderStatus }) => order.status === OrderStatus.WAITING_REVIEW).length;
    const averageRating = reviews.length
      ? Number((reviews.reduce((sum: number, review: { rating: number }) => sum + review.rating, 0) / reviews.length).toFixed(1))
      : null;

    return {
      id: user.id,
      displayName: user.displayName,
      studentId: user.studentId,
      email: user.email,
      avatarUrl: user.avatarUrl,
      avatarFrame: user.avatarFrame,
      creditScore: user.creditScore,
      creditLevel: getCreditLevel(user.creditScore),
      verificationStatus: user.verificationStatus,
      accountStatus: user.accountStatus,
      college: user.verification?.college ?? (user.verificationStatus === VerificationStatus.APPROVED ? '信息学院' : '待填写'),
      completedOrders,
      activeOrders,
      waitingReviews,
      reportCount: reports,
      followerCount,
      isFollowing: Boolean(isFollowing),
      averageRating
    };
  }

  async listBrowsingHistory(params: UserHistoryListParams) {
    const authUser = requireAuthenticatedUser(params.currentUser);
    const { page, pageSize, skip } = normalizePagination(params.page, params.pageSize);

    const [productRows, serviceRows] = await Promise.all([
      this.prisma.userBehavior.findMany({
        where: {
          userId: authUser.id,
          eventType: BehaviorEventType.VIEW
        },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          productId: true,
          createdAt: true
        }
      }),
      this.prisma.campusServiceBehavior.findMany({
        where: {
          userId: authUser.id,
          eventType: BehaviorEventType.VIEW
        },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          listingId: true,
          createdAt: true
        }
      })
    ]);

    const latestByProduct = new Map<number, Date>();
    productRows.forEach((item) => {
      if (!latestByProduct.has(item.productId)) {
        latestByProduct.set(item.productId, item.createdAt);
      }
    });

    const latestByService = new Map<number, Date>();
    serviceRows.forEach((item) => {
      const current = latestByService.get(item.listingId);
      if (!current || item.createdAt > current) {
        latestByService.set(item.listingId, item.createdAt);
      }
    });

    const historyRefs = [
      ...[...latestByProduct.entries()].map(([id, viewedAt]) => ({ type: 'product' as const, id, viewedAt })),
      ...[...latestByService.entries()].map(([id, viewedAt]) => ({ type: 'campus-service' as const, id, viewedAt }))
    ].sort((left, right) => right.viewedAt.getTime() - left.viewedAt.getTime());

    const total = historyRefs.length;
    const pagedRefs = historyRefs.slice(skip, skip + pageSize);
    const pagedProductIds = pagedRefs.filter((item) => item.type === 'product').map((item) => item.id);
    const pagedServiceIds = pagedRefs.filter((item) => item.type === 'campus-service').map((item) => item.id);

    const [products, campusServices] = await Promise.all([
      pagedProductIds.length
        ? this.prisma.product.findMany({
            where: { id: { in: pagedProductIds } }
          })
        : Promise.resolve([]),
      pagedServiceIds.length
        ? this.prisma.campusServiceListing.findMany({
            where: { id: { in: pagedServiceIds } },
            include: {
              images: {
                orderBy: { sortOrder: 'asc' },
                select: { imageUrl: true }
              },
              owner: {
                select: {
                  id: true,
                  displayName: true
                }
              }
            }
          })
        : Promise.resolve([])
    ]);

    const cards = await this.buildProductCards(products, authUser.id);
    const productMap = new Map(cards.map((item) => [item.id, item]));
    const serviceMap = new Map(campusServices.map((item) => [item.id, item]));
    const items = pagedRefs
      .map((ref) => {
        if (ref.type === 'product') {
          const product = productMap.get(ref.id);
          if (!product) {
            return null;
          }

          return {
            ...product,
            type: 'product',
            viewedAt: ref.viewedAt.toISOString()
          };
        }

        const listing = serviceMap.get(ref.id);
        if (!listing) {
          return null;
        }

        const imageUrl = listing.images[0]?.imageUrl;
        const rewardLabel = formatCampusServiceReward(listing.priceMode, listing.amount);

        return {
          type: 'campus-service',
          id: listing.id,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          categoryLabel: campusServiceCategoryLabelMap[listing.category],
          intent: listing.intent,
          intentLabel: campusServiceIntentLabelMap[listing.intent],
          status: listing.status,
          statusLabel: campusServiceListingStatusLabelMap[listing.status],
          imageUrl,
          price: toNumber(listing.amount),
          rewardLabel,
          sellerName: listing.owner.displayName,
          publisher: {
            id: listing.owner.id,
            displayName: listing.owner.displayName
          },
          summaryTags: [
            campusServiceIntentLabelMap[listing.intent],
            campusServiceCategoryLabelMap[listing.category],
            rewardLabel
          ],
          viewedAt: ref.viewedAt.toISOString()
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async listFollowingUsers(params: UserFollowingListParams) {
    const authUser = requireAuthenticatedUser(params.currentUser);
    const { page, pageSize, skip } = normalizePagination(params.page, params.pageSize);

    const [total, follows] = await Promise.all([
      this.prisma.userFollow.count({
        where: { followerId: authUser.id }
      }),
      this.prisma.userFollow.findMany({
        where: { followerId: authUser.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          following: {
            include: {
              verification: {
                select: { college: true }
              }
            }
          }
        }
      })
    ]);

    const followingIds = follows.map((item) => item.followingId);
    const [productCounts, followerCounts] = followingIds.length
      ? await Promise.all([
          this.prisma.product.groupBy({
            by: ['sellerId'],
            where: {
              sellerId: { in: followingIds },
              status: ProductStatus.ON_SALE
            },
            _count: { _all: true }
          }),
          this.prisma.userFollow.groupBy({
            by: ['followingId'],
            where: {
              followingId: { in: followingIds }
            },
            _count: { _all: true }
          })
        ])
      : [[], []];

    const productCountMap = new Map(productCounts.map((item) => [item.sellerId, item._count._all]));
    const followerCountMap = new Map(followerCounts.map((item) => [item.followingId, item._count._all]));

    return {
      items: follows.map((item) => this.mapFollowUser({
        id: item.following.id,
        displayName: item.following.displayName,
        studentId: item.following.studentId,
        email: item.following.email,
        avatarUrl: item.following.avatarUrl,
        avatarFrame: item.following.avatarFrame,
        creditScore: item.following.creditScore,
        verificationStatus: item.following.verificationStatus,
        accountStatus: item.following.accountStatus,
        verification: item.following.verification,
        activeProductCount: productCountMap.get(item.followingId) ?? 0,
        followerCount: followerCountMap.get(item.followingId) ?? 0
      }, item.createdAt)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async followUser(targetUserId: number, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    if (authUser.id === targetUserId) {
      throw new BadRequestException('不能关注自己');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        displayName: true,
        studentId: true,
        email: true,
        avatarUrl: true,
        avatarFrame: true,
        creditScore: true,
        verificationStatus: true,
        accountStatus: true,
        verification: {
          select: { college: true }
        }
      }
    });

    if (!targetUser) {
      throw new NotFoundException('用户不存在');
    }

    const follow = await this.prisma.userFollow.upsert({
      where: {
        followerId_followingId: {
          followerId: authUser.id,
          followingId: targetUserId
        }
      },
      update: {},
      create: {
        followerId: authUser.id,
        followingId: targetUserId
      }
    });

    const followerCount = await this.prisma.userFollow.count({
      where: { followingId: targetUserId }
    });
    const activeProductCount = await this.prisma.product.count({
      where: {
        sellerId: targetUserId,
        status: ProductStatus.ON_SALE
      }
    });

    return {
      isFollowing: true,
      followedAt: follow.createdAt.toISOString(),
      followerCount,
      user: this.mapFollowUser({
        ...targetUser,
        avatarFrame: targetUser.avatarFrame,
        activeProductCount,
        followerCount
      }, follow.createdAt)
    };
  }

  async unfollowUser(targetUserId: number, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);

    await this.prisma.userFollow.deleteMany({
      where: {
        followerId: authUser.id,
        followingId: targetUserId
      }
    });

    const followerCount = await this.prisma.userFollow.count({
      where: { followingId: targetUserId }
    });

    return {
      isFollowing: false,
      followerCount
    };
  }

  async updateProfile(userId: number, payload: UpdateProfileDto, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    if (authUser.id !== userId && authUser.role !== UserRole.ADMIN) {
      throw new BadRequestException('只能修改自己的资料');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { verification: true }
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const nextDisplayName = payload.displayName?.trim();
    const nextStudentId = payload.studentId?.trim();
    const nextEmail = payload.email?.trim();
    const nextRealName = payload.realName?.trim();
    const nextCollege = payload.college?.trim();
    const nextPhone = payload.phone?.trim();
    const nextAvatarUrl = payload.avatarUrl?.trim();
    const nextAvatarFrame = payload.avatarFrame?.trim();

    if (payload.displayName !== undefined && !nextDisplayName) {
      throw new BadRequestException('展示名不能为空');
    }

    if (payload.studentId !== undefined && !nextStudentId) {
      throw new BadRequestException('学号不能为空');
    }

    if (payload.email !== undefined) {
      if (!nextEmail) {
        throw new BadRequestException('邮箱不能为空');
      }

      if (nextEmail !== user.email && !nextEmail.includes('@')) {
        throw new BadRequestException('请输入正确的邮箱地址');
      }
    }

    if (payload.realName !== undefined && !nextRealName) {
      throw new BadRequestException('真实姓名不能为空');
    }

    if (payload.college !== undefined && !nextCollege) {
      throw new BadRequestException('学院不能为空');
    }

    if (payload.phone !== undefined && !nextPhone) {
      throw new BadRequestException('手机号不能为空');
    }

    try {
      await this.syncCredentialEmail(user, nextEmail);
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          studentId: payload.studentId !== undefined ? nextStudentId : undefined,
          displayName: nextDisplayName ?? undefined,
          email: nextEmail ?? undefined,
          avatarUrl: payload.avatarUrl !== undefined ? (nextAvatarUrl || null) : undefined,
          avatarFrame: payload.avatarFrame !== undefined ? (nextAvatarFrame || null) : undefined,
          verification: {
            upsert: {
              update: {
                realName: nextRealName ?? undefined,
                college: nextCollege ?? undefined,
                phone: nextPhone ?? undefined
              },
              create: {
                realName: nextRealName ?? (nextDisplayName ?? user.displayName),
                college: nextCollege ?? '待填写',
                phone: nextPhone ?? '待填写'
              }
            }
          }
        },
        include: { verification: true }
      });

      await this.searchService.syncSellerProducts(userId);

      return this.mapProfile(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('邮箱已被使用');
      }

      throw error;
    }
  }

  async listModerationUsers(filters?: {
    page?: number;
    pageSize?: number;
    college?: string;
    keyword?: string;
    currentUser?: AuthenticatedUser;
  }) {
    requireAdminUser(filters?.currentUser);
    const { page, pageSize, skip } = normalizePagination(filters?.page, filters?.pageSize);
    const college = filters?.college?.trim();
    const keyword = filters?.keyword?.trim();
    const where: Prisma.UserWhereInput = {
      role: UserRole.USER,
      ...(college && college !== '全部学院'
        ? {
            verification: {
              is: { college }
            }
          }
        : {}),
      ...(keyword
        ? {
            OR: [
              { displayName: { contains: keyword } },
              { email: { contains: keyword } },
              { studentId: { contains: keyword } },
              {
                verification: {
                  is: {
                    OR: [
                      { realName: { contains: keyword } },
                      { college: { contains: keyword } }
                    ]
                  }
                }
              }
            ]
          }
        : {})
    };

    const [users, total, allUserColleges] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ accountStatus: 'desc' }, { creditScore: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: { verification: true }
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where: { role: UserRole.USER },
        select: { verification: { select: { college: true } } }
      })
    ]);

    const collegeCountMap = new Map<string, number>();
    allUserColleges.forEach((user) => {
      const key = user.verification?.college ?? '待填写';
      collegeCountMap.set(key, (collegeCountMap.get(key) ?? 0) + 1);
    });
    const collegeStats = collegeOptions.map((item) => ({
      college: item,
      count: collegeCountMap.get(item) ?? 0
    }));
    const otherCollegeCount = Array.from(collegeCountMap.entries())
      .filter(([item]) => !collegeOptions.includes(item))
      .reduce((sum, [, count]) => sum + count, 0);

    if (otherCollegeCount > 0) {
      collegeStats.push({ college: '其他/待填写', count: otherCollegeCount });
    }

    const userIds = users.map((user) => user.id);
    if (!userIds.length) {
      return {
        items: [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize))
        },
        collegeStats
      };
    }

    const [reports, activeProducts, allProducts, orders, campusServiceStats, messages] = await Promise.all([
      this.prisma.report.findMany({
        where: { targetUserId: { in: userIds } },
        select: { targetUserId: true, status: true }
      }),
      this.prisma.product.findMany({
        where: {
          sellerId: { in: userIds },
          status: ProductStatus.ON_SALE
        },
        select: { sellerId: true }
      }),
      this.prisma.product.findMany({
        where: { sellerId: { in: userIds } },
        select: { sellerId: true, status: true, updatedAt: true }
      }),
      this.prisma.order.findMany({
        where: {
          OR: [{ buyerId: { in: userIds } }, { sellerId: { in: userIds } }]
        },
        select: { buyerId: true, sellerId: true, status: true, updatedAt: true }
      }),
      loadCampusServiceActivityStats(this.prisma, userIds),
      this.prisma.message.findMany({
        where: { senderId: { in: userIds } },
        select: { senderId: true, createdAt: true }
      })
    ]);

    const reportStats = new Map<number, { total: number; open: number }>();
    reports.forEach((report) => {
      const key = report.targetUserId!;
      const current = reportStats.get(key) ?? { total: 0, open: 0 };
      current.total += 1;
      if (report.status === 'OPEN') {
        current.open += 1;
      }
      reportStats.set(key, current);
    });

    const activeProductMap = new Map<number, number>();
    activeProducts.forEach((product) => {
      activeProductMap.set(product.sellerId, (activeProductMap.get(product.sellerId) ?? 0) + 1);
    });

    const productStats = new Map<number, { total: number; offline: number; lastActiveAt: Date | null }>();
    allProducts.forEach((product) => {
      const current = productStats.get(product.sellerId) ?? { total: 0, offline: 0, lastActiveAt: null };
      current.total += 1;
      if (product.status === ProductStatus.OFFLINE) {
        current.offline += 1;
      }
      if (!current.lastActiveAt || product.updatedAt > current.lastActiveAt) {
        current.lastActiveAt = product.updatedAt;
      }
      productStats.set(product.sellerId, current);
    });

    const orderStats = new Map<number, { total: number; active: number; completed: number; canceled: number; lastActiveAt: Date | null }>();
    const addOrder = (userId: number, status: OrderStatus, updatedAt: Date) => {
      const current = orderStats.get(userId) ?? { total: 0, active: 0, completed: 0, canceled: 0, lastActiveAt: null };
      current.total += 1;
      if (status === OrderStatus.PENDING || status === OrderStatus.IN_PROGRESS || status === OrderStatus.WAITING_REVIEW) {
        current.active += 1;
      }
      if (status === OrderStatus.COMPLETED) {
        current.completed += 1;
      }
      if (status === OrderStatus.CANCELED) {
        current.canceled += 1;
      }
      if (!current.lastActiveAt || updatedAt > current.lastActiveAt) {
        current.lastActiveAt = updatedAt;
      }
      orderStats.set(userId, current);
    };
    orders.forEach((order) => {
      addOrder(order.buyerId, order.status, order.updatedAt);
      if (order.sellerId !== order.buyerId) {
        addOrder(order.sellerId, order.status, order.updatedAt);
      }
    });

    const messageStats = new Map<number, { total: number; lastActiveAt: Date | null }>();
    messages.forEach((item) => {
      const current = messageStats.get(item.senderId) ?? { total: 0, lastActiveAt: null };
      current.total += 1;
      if (!current.lastActiveAt || item.createdAt > current.lastActiveAt) {
        current.lastActiveAt = item.createdAt;
      }
      messageStats.set(item.senderId, current);
    });

    const items = users.map((user) => {
      const report = reportStats.get(user.id) ?? { total: 0, open: 0 };
      const product = productStats.get(user.id) ?? { total: 0, offline: 0, lastActiveAt: null };
      const order = orderStats.get(user.id) ?? { total: 0, active: 0, completed: 0, canceled: 0, lastActiveAt: null };
      const campusService = campusServiceStats.get(user.id) ?? { total: 0, active: 0, lastActiveAt: null };
      const message = messageStats.get(user.id) ?? { total: 0, lastActiveAt: null };
      const lastActiveAt = [product.lastActiveAt, order.lastActiveAt, campusService.lastActiveAt, message.lastActiveAt, user.updatedAt]
        .filter((item): item is Date => Boolean(item))
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? user.updatedAt;
      const riskScore =
        (user.accountStatus === AccountStatus.BANNED ? 100 : 0) +
        report.open * 35 +
        Math.max(0, 75 - user.creditScore) +
        product.offline * 6 +
        order.canceled * 4 +
        (user.verificationStatus === VerificationStatus.APPROVED ? 0 : 12);
      const riskLevel = user.accountStatus === AccountStatus.BANNED || riskScore >= 80
        ? 'HIGH'
        : riskScore >= 35
          ? 'MEDIUM'
          : 'LOW';
      const suggestedAction = user.accountStatus === AccountStatus.BANNED
        ? '复核封禁'
        : report.open > 0
          ? '优先处理举报'
          : riskLevel === 'MEDIUM'
            ? '观察信用'
            : '例行巡检';

      return {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        studentId: user.studentId,
        avatarUrl: user.avatarUrl,
        avatarFrame: user.avatarFrame,
        creditScore: user.creditScore,
        verificationStatus: user.verificationStatus,
        accountStatus: user.accountStatus,
        isBanned: user.accountStatus === AccountStatus.BANNED,
        college: user.verification?.college ?? '待填写',
        reportCount: report.total,
        openReportCount: report.open,
        activeProductCount: activeProductMap.get(user.id) ?? 0,
        totalProductCount: product.total,
        offlineProductCount: product.offline,
        orderCount: order.total,
        activeOrderCount: order.active,
        completedOrderCount: order.completed,
        canceledOrderCount: order.canceled,
        campusServiceCount: campusService.total,
        activeCampusServiceCount: campusService.active,
        messageCount: message.total,
        lastActiveAt,
        createdAt: user.createdAt,
        riskScore,
        riskLevel,
        suggestedAction
      };
    });

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      },
      collegeStats
    };
  }

  async updateBanStatus(userId: number, payload: UpdateBanStatusDto, currentUser: AuthenticatedUser) {
    const adminUser = requireAdminUser(currentUser);
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundException('用户不存在');
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { accountStatus: payload.banned ? AccountStatus.BANNED : AccountStatus.ACTIVE }
      });

      if (payload.banned) {
        await Promise.all([
          tx.product.updateMany({
            where: {
              sellerId: userId,
              status: ProductStatus.ON_SALE
            },
            data: { status: ProductStatus.OFFLINE }
          }),
          tx.order.updateMany({
            where: {
              OR: [{ buyerId: userId }, { sellerId: userId }],
              status: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS, OrderStatus.WAITING_REVIEW] }
            },
            data: { status: OrderStatus.CANCELED }
          }),
          cancelCampusServicesForUser(tx, userId, payload.reason?.trim() || '账号封禁处理')
        ]);
      }

      await tx.auditLog.create({
        data: {
          actorId: adminUser.id,
          actorName: `管理员#${adminUser.id}`,
          action: payload.banned ? 'BAN_USER' : 'UNBAN_USER',
          targetType: 'USER',
          targetId: userId,
          detail: payload.reason?.trim() || (payload.banned ? '账号封禁处理' : '账号恢复使用')
        }
      });

      return {
        id: updated.id,
        isBanned: updated.accountStatus === AccountStatus.BANNED
      };
    });

    await this.searchService.syncSellerProducts(userId);
    return result;
  }
}
