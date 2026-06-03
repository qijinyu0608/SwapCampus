import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CampusServiceStatus, OrderStatus, Prisma, ProductStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  private mapProfile(user: {
    id: number;
    name: string;
    studentId: string;
    email: string;
    role: UserRole;
    creditScore: number;
    isVerified: boolean;
    verification: {
      realName: string;
      college: string;
      phone: string;
      status: string;
    } | null;
  }) {
    return {
      id: user.id,
      name: user.name,
      studentId: user.studentId,
      email: user.email,
      role: user.role,
      creditScore: user.creditScore,
      verified: user.isVerified,
      identityStatus: user.verification?.status ?? (user.isVerified ? 'APPROVED' : 'PENDING'),
      realName: user.verification?.realName ?? user.name,
      college: user.verification?.college ?? '待填写',
      phone: user.verification?.phone ?? '待填写'
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

  async getTrustSummary(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { verification: true }
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const [allOrders, reviews, reports, sentMessages] = await Promise.all([
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
      this.prisma.message.count({
        where: { senderId: userId }
      })
    ]);

    const completedOrders = allOrders.filter((order) => order.status === OrderStatus.COMPLETED).length;
    const activeOrders = allOrders.filter((order) => order.status === OrderStatus.IN_PROGRESS || order.status === OrderStatus.PENDING).length;
    const waitingReviews = allOrders.filter((order) => order.status === OrderStatus.WAITING_REVIEW).length;
    const averageRating = reviews.length
      ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1))
      : 4.8;
    const responseRate = Math.min(99, user.isVerified ? 88 + Math.min(10, Math.floor(sentMessages / 4)) : 72 + Math.min(12, Math.floor(sentMessages / 5)));

    return {
      id: user.id,
      name: user.name,
      studentId: user.studentId,
      email: user.email,
      creditScore: user.creditScore,
      creditLevel: getCreditLevel(user.creditScore),
      verified: user.isVerified,
      identityStatus: user.verification?.status ?? (user.isVerified ? 'APPROVED' : 'PENDING'),
      college: user.verification?.college ?? (user.isVerified ? '信息学院' : '待填写'),
      completedOrders,
      activeOrders,
      waitingReviews,
      reportCount: reports,
      responseRate,
      averageRating
    };
  }

  async updateProfile(userId: number, payload: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { verification: true }
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const nextName = payload.name?.trim();
    const nextEmail = payload.email?.trim();
    const nextRealName = payload.realName?.trim();
    const nextCollege = payload.college?.trim();
    const nextPhone = payload.phone?.trim();

    if (payload.name !== undefined && !nextName) {
      throw new BadRequestException('姓名不能为空');
    }

    if (payload.email !== undefined) {
      if (!nextEmail) {
        throw new BadRequestException('邮箱不能为空');
      }

      if (!nextEmail.includes('@')) {
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
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: nextName ?? undefined,
          email: nextEmail ?? undefined,
          verification: {
            upsert: {
              update: {
                realName: nextRealName ?? undefined,
                college: nextCollege ?? undefined,
                phone: nextPhone ?? undefined
              },
              create: {
                realName: nextRealName ?? user.name,
                college: nextCollege ?? '待填写',
                phone: nextPhone ?? '待填写',
                status: user.isVerified ? 'APPROVED' : 'PENDING'
              }
            }
          }
        },
        include: { verification: true }
      });

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
  }) {
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
              { name: { contains: keyword } },
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
        orderBy: [{ isBanned: 'desc' }, { creditScore: 'asc' }, { createdAt: 'desc' }],
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

    const [reports, activeProducts, allProducts, orders, campusServices, messages] = await Promise.all([
      this.prisma.report.findMany({
        where: { targetUserId: { in: userIds } },
        select: { targetUserId: true, status: true }
      }),
      this.prisma.product.findMany({
        where: {
          sellerId: { in: userIds },
          status: { in: [ProductStatus.PENDING, ProductStatus.ON_SALE] }
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
      this.prisma.campusServiceTask.findMany({
        where: {
          OR: [{ publisherId: { in: userIds } }, { accepterId: { in: userIds } }]
        },
        select: { publisherId: true, accepterId: true, status: true, updatedAt: true }
      }),
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

    const productStats = new Map<number, { total: number; pending: number; offline: number; lastActiveAt: Date | null }>();
    allProducts.forEach((product) => {
      const current = productStats.get(product.sellerId) ?? { total: 0, pending: 0, offline: 0, lastActiveAt: null };
      current.total += 1;
      if (product.status === ProductStatus.PENDING) {
        current.pending += 1;
      }
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

    const campusServiceStats = new Map<number, { total: number; active: number; lastActiveAt: Date | null }>();
    const addCampusService = (userId: number | null, status: CampusServiceStatus, updatedAt: Date) => {
      if (!userId) {
        return;
      }

      const current = campusServiceStats.get(userId) ?? { total: 0, active: 0, lastActiveAt: null };
      current.total += 1;
      if (status === CampusServiceStatus.OPEN || status === CampusServiceStatus.MATCHED) {
        current.active += 1;
      }
      if (!current.lastActiveAt || updatedAt > current.lastActiveAt) {
        current.lastActiveAt = updatedAt;
      }
      campusServiceStats.set(userId, current);
    };
    campusServices.forEach((task) => {
      addCampusService(task.publisherId, task.status, task.updatedAt);
      addCampusService(task.accepterId, task.status, task.updatedAt);
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
      const product = productStats.get(user.id) ?? { total: 0, pending: 0, offline: 0, lastActiveAt: null };
      const order = orderStats.get(user.id) ?? { total: 0, active: 0, completed: 0, canceled: 0, lastActiveAt: null };
      const campusService = campusServiceStats.get(user.id) ?? { total: 0, active: 0, lastActiveAt: null };
      const message = messageStats.get(user.id) ?? { total: 0, lastActiveAt: null };
      const lastActiveAt = [product.lastActiveAt, order.lastActiveAt, campusService.lastActiveAt, message.lastActiveAt, user.updatedAt]
        .filter((item): item is Date => Boolean(item))
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? user.updatedAt;
      const riskScore =
        (user.isBanned ? 100 : 0) +
        report.open * 35 +
        Math.max(0, 75 - user.creditScore) +
        product.offline * 6 +
        order.canceled * 4 +
        (user.isVerified ? 0 : 12);
      const riskLevel = user.isBanned || riskScore >= 80
        ? 'HIGH'
        : riskScore >= 35
          ? 'MEDIUM'
          : 'LOW';
      const suggestedAction = user.isBanned
        ? '复核封禁'
        : report.open > 0
          ? '优先处理举报'
          : riskLevel === 'MEDIUM'
            ? '观察信用'
            : '例行巡检';

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        studentId: user.studentId,
        creditScore: user.creditScore,
        verified: user.isVerified,
        isBanned: user.isBanned,
        college: user.verification?.college ?? '待填写',
        reportCount: report.total,
        openReportCount: report.open,
        activeProductCount: activeProductMap.get(user.id) ?? 0,
        totalProductCount: product.total,
        pendingProductCount: product.pending,
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

  async updateBanStatus(userId: number, payload: UpdateBanStatusDto) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundException('用户不存在');
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { isBanned: payload.banned }
      });

      if (payload.banned) {
        await Promise.all([
          tx.product.updateMany({
            where: {
              sellerId: userId,
              status: { in: [ProductStatus.PENDING, ProductStatus.ON_SALE] }
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
          tx.campusServiceTask.updateMany({
            where: {
              OR: [{ publisherId: userId }, { accepterId: userId }],
              status: { in: [CampusServiceStatus.OPEN, CampusServiceStatus.MATCHED] }
            },
            data: { status: CampusServiceStatus.CANCELED }
          })
        ]);
      }

      await tx.auditLog.create({
        data: {
          actorId: payload.handledBy,
          actorName: payload.handledBy ? `管理员#${payload.handledBy}` : '管理员',
          action: payload.banned ? 'BAN_USER' : 'UNBAN_USER',
          targetType: 'USER',
          targetId: userId,
          detail: payload.reason?.trim() || (payload.banned ? '账号封禁处理' : '账号恢复使用')
        }
      });

      return {
        id: updated.id,
        isBanned: updated.isBanned
      };
    });
  }
}
