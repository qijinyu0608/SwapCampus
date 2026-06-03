import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CampusServiceStatus, OrderStatus, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAdminCampusServiceStatusDto } from './dto/update-admin-campus-service-status.dto';
import { UpdateAdminOrderStatusDto } from './dto/update-admin-order-status.dto';
import { UpdateAdminProductStatusDto } from './dto/update-admin-product-status.dto';

const activeOrderStatuses: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.IN_PROGRESS,
  OrderStatus.WAITING_REVIEW
];

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  private getActorName(handledBy?: number) {
    return handledBy ? `管理员#${handledBy}` : '管理员';
  }

  private getDetail(reason: string | undefined, fallback: string) {
    return reason?.trim() || fallback;
  }

  async getOverview() {
    const [pendingProducts, totalUsers, reportCount, activeOrders, activeCampusServices] = await Promise.all([
      this.prisma.product.count({ where: { status: ProductStatus.PENDING } }),
      this.prisma.user.count(),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.order.count({
        where: { status: { in: activeOrderStatuses } }
      }),
      this.prisma.campusServiceTask.count({
        where: { status: { in: [CampusServiceStatus.OPEN, CampusServiceStatus.MATCHED] } }
      })
    ]);

    const recentProducts = await this.prisma.product.findMany({
      where: { status: ProductStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      take: 6
    });

    const recentReports = await this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6
    });

    return {
      pendingProducts,
      totalUsers,
      reportCount,
      activeOrders,
      activeCampusServices,
      recentProducts: recentProducts.map((product) => ({
        id: product.id,
        title: product.title,
        status: product.status,
        sellerId: product.sellerId
      })),
      recentReports: recentReports.map((report) => ({
        id: report.id,
        productId: report.productId,
        targetUserId: report.targetUserId,
        reason: report.reason,
        status: report.status
      }))
    };
  }

  async updateProductStatus(productId: number, payload: UpdateAdminProductStatusDto) {
    const normalized = payload.status;

    if (normalized !== ProductStatus.ON_SALE && normalized !== ProductStatus.OFFLINE) {
      throw new BadRequestException('仅支持恢复上架或下架商品');
    }

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, title: true, sellerId: true, status: true }
      });

      if (!current) {
        throw new NotFoundException('商品不存在');
      }

      if (current.status === ProductStatus.SOLD) {
        throw new BadRequestException('已售商品不能通过审核操作改为上架或下架');
      }

      if (normalized === ProductStatus.ON_SALE) {
        const seller = await tx.user.findUnique({
          where: { id: current.sellerId },
          select: { isBanned: true }
        });

        if (seller?.isBanned) {
          throw new BadRequestException('卖家已被封禁，不能恢复商品展示');
        }
      }

      const product = await tx.product.update({
        where: { id: productId },
        data: { status: normalized }
      });

      if (normalized === ProductStatus.OFFLINE) {
        await tx.order.updateMany({
          where: {
            productId,
            status: { in: activeOrderStatuses }
          },
          data: { status: OrderStatus.CANCELED }
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: payload.handledBy,
          actorName: this.getActorName(payload.handledBy),
          action: normalized === ProductStatus.OFFLINE ? 'OFFLINE_PRODUCT' : 'RESTORE_PRODUCT',
          targetType: 'PRODUCT',
          targetId: productId,
          detail: this.getDetail(payload.reason, `商品状态改为 ${normalized}`)
        }
      });

      return {
        id: product.id,
        status: product.status,
        title: product.title
      };
    });
  }

  async listOrders() {
    const orders = await this.prisma.order.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 30
    });
    const userIds = [...new Set(orders.flatMap((order) => [order.buyerId, order.sellerId]))];
    const productIds = [...new Set(orders.map((order) => order.productId))];
    const [users, products] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true }
      }),
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, title: true, status: true }
      })
    ]);
    const userMap = new Map(users.map((user) => [user.id, user.name]));
    const productMap = new Map(products.map((product) => [product.id, product]));

    return orders.map((order) => ({
      id: order.id,
      productId: order.productId,
      productTitle: productMap.get(order.productId)?.title ?? `商品#${order.productId}`,
      productStatus: productMap.get(order.productId)?.status ?? null,
      buyerId: order.buyerId,
      buyerName: userMap.get(order.buyerId) ?? `用户#${order.buyerId}`,
      sellerId: order.sellerId,
      sellerName: userMap.get(order.sellerId) ?? `用户#${order.sellerId}`,
      status: order.status,
      meetupLocation: order.meetupLocation,
      note: order.note,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));
  }

  async updateOrderStatus(orderId: number, payload: UpdateAdminOrderStatusDto) {
    const supportedStatuses = [
      OrderStatus.PENDING,
      OrderStatus.IN_PROGRESS,
      OrderStatus.WAITING_REVIEW,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELED
    ];

    if (!supportedStatuses.includes(payload.status)) {
      throw new BadRequestException('订单状态不支持');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId }
      });

      if (!order) {
        throw new NotFoundException('订单不存在');
      }

      const product = await tx.product.findUnique({
        where: { id: order.productId },
        select: { id: true, sellerId: true, status: true }
      });

      if (!product) {
        throw new NotFoundException('订单关联商品不存在');
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: payload.status }
      });

      if (payload.status === OrderStatus.COMPLETED) {
        await tx.product.update({
          where: { id: order.productId },
          data: { status: ProductStatus.SOLD }
        });
      } else if (payload.status === OrderStatus.CANCELED) {
        const [otherFinishedOrder, otherActiveOrder, seller] = await Promise.all([
          tx.order.findFirst({
            where: {
              productId: order.productId,
              id: { not: orderId },
              status: OrderStatus.COMPLETED
            },
            select: { id: true }
          }),
          tx.order.findFirst({
            where: {
              productId: order.productId,
              id: { not: orderId },
              status: { in: activeOrderStatuses }
            },
            select: { id: true }
          }),
          tx.user.findUnique({
            where: { id: product.sellerId },
            select: { isBanned: true }
          })
        ]);

        if (otherFinishedOrder) {
          await tx.product.update({
            where: { id: order.productId },
            data: { status: ProductStatus.SOLD }
          });
        } else if (
          activeOrderStatuses.includes(order.status) &&
          !otherActiveOrder &&
          !seller?.isBanned &&
          product.status !== ProductStatus.PENDING &&
          product.status !== ProductStatus.SOLD
        ) {
          await tx.product.update({
            where: { id: order.productId },
            data: { status: ProductStatus.ON_SALE }
          });
        }
      } else {
        await tx.product.update({
          where: { id: order.productId },
          data: { status: ProductStatus.OFFLINE }
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: payload.handledBy,
          actorName: this.getActorName(payload.handledBy),
          action: 'UPDATE_ORDER_STATUS',
          targetType: 'ORDER',
          targetId: orderId,
          detail: this.getDetail(payload.reason, `订单状态改为 ${payload.status}`)
        }
      });

      return {
        id: updated.id,
        status: updated.status,
        productId: updated.productId
      };
    });
  }

  async listCampusServices() {
    const tasks = await this.prisma.campusServiceTask.findMany({
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 30
    });
    const userIds = [...new Set(
      tasks
        .flatMap((task) => [task.publisherId, task.accepterId])
        .filter((id): id is number => typeof id === 'number')
    )];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    });
    const userMap = new Map(users.map((user) => [user.id, user.name]));

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      category: task.category,
      reward: Number(task.reward),
      publisherId: task.publisherId,
      publisherName: userMap.get(task.publisherId) ?? `用户#${task.publisherId}`,
      accepterId: task.accepterId,
      accepterName: task.accepterId ? userMap.get(task.accepterId) ?? `用户#${task.accepterId}` : null,
      status: task.status,
      locationFrom: task.locationFrom,
      locationTo: task.locationTo,
      deadlineLabel: task.deadlineLabel,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }));
  }

  async updateCampusServiceStatus(taskId: number, payload: UpdateAdminCampusServiceStatusDto) {
    const supportedStatuses = [
      CampusServiceStatus.OPEN,
      CampusServiceStatus.MATCHED,
      CampusServiceStatus.DONE,
      CampusServiceStatus.CANCELED
    ];

    if (!supportedStatuses.includes(payload.status)) {
      throw new BadRequestException('校园服务状态不支持');
    }

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.campusServiceTask.findUnique({
        where: { id: taskId }
      });

      if (!task) {
        throw new NotFoundException('校园服务任务不存在');
      }

      if ((payload.status === CampusServiceStatus.MATCHED || payload.status === CampusServiceStatus.DONE) && !task.accepterId) {
        throw new BadRequestException('没有接单人的任务不能标记为进行中或已完成');
      }

      const updated = await tx.campusServiceTask.update({
        where: { id: taskId },
        data: {
          status: payload.status,
          accepterId: payload.status === CampusServiceStatus.OPEN ? null : undefined
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: payload.handledBy,
          actorName: this.getActorName(payload.handledBy),
          action: 'UPDATE_CAMPUS_SERVICE_STATUS',
          targetType: 'CAMPUS_SERVICE',
          targetId: taskId,
          detail: this.getDetail(payload.reason, `校园服务状态改为 ${payload.status}`)
        }
      });

      return {
        id: updated.id,
        status: updated.status
      };
    });
  }
}
