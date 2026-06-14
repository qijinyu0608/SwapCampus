import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  CampusServiceIntent,
  CampusServiceListingEndReason,
  CampusServiceListingStatus,
  CampusServiceOrderStatus,
  OrderStatus,
  ProductStatus
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAdminUser } from '../auth/auth.utils';
import { SearchService } from '../search/search.service';
import {
  AdminCampusServiceAction,
  UpdateAdminCampusServiceStatusDto
} from './dto/update-admin-campus-service-status.dto';
import { UpdateAdminOrderStatusDto } from './dto/update-admin-order-status.dto';
import { UpdateAdminProductStatusDto } from './dto/update-admin-product-status.dto';

const activeOrderStatuses: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.IN_PROGRESS,
  OrderStatus.WAITING_REVIEW
];

const activeCampusListingStatuses: CampusServiceListingStatus[] = [
  CampusServiceListingStatus.OPEN,
  CampusServiceListingStatus.BUSY,
  CampusServiceListingStatus.PAUSED
];

const activeCampusOrderStatuses: CampusServiceOrderStatus[] = [
  CampusServiceOrderStatus.PENDING_CONFIRMATION,
  CampusServiceOrderStatus.CONFIRMED,
  CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
];

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SearchService)
    private readonly searchService: SearchService
  ) {}

  private getActorName(user: AuthenticatedUser) {
    return `管理员#${user.id}`;
  }

  private getDetail(reason: string | undefined, fallback: string) {
    return reason?.trim() || fallback;
  }

  async getOverview(currentUser: AuthenticatedUser) {
    requireAdminUser(currentUser);
    const [onSaleProducts, totalUsers, reportCount, activeOrders, activeCampusServices] = await Promise.all([
      this.prisma.product.count({ where: { status: ProductStatus.ON_SALE } }),
      this.prisma.user.count(),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.order.count({
        where: { status: { in: activeOrderStatuses } }
      }),
      this.prisma.campusServiceListing.count({
        where: { status: { in: activeCampusListingStatuses } }
      })
    ]);

    const recentProducts = await this.prisma.product.findMany({
      where: { status: ProductStatus.ON_SALE },
      orderBy: { createdAt: 'desc' },
      take: 6
    });

    const recentReports = await this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6
    });

    return {
      onSaleProducts,
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

  async updateProductStatus(productId: number, payload: UpdateAdminProductStatusDto, currentUser: AuthenticatedUser) {
    const adminUser = requireAdminUser(currentUser);
    const normalized = payload.status;

    if (normalized !== ProductStatus.ON_SALE && normalized !== ProductStatus.OFFLINE) {
      throw new BadRequestException('仅支持恢复上架或下架商品');
    }

    const result = await this.prisma.$transaction(async (tx) => {
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
          select: { accountStatus: true }
        });

        if (seller?.accountStatus === AccountStatus.BANNED) {
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
          actorId: adminUser.id,
          actorName: this.getActorName(adminUser),
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

    await this.searchService.syncProduct(productId);
    return result;
  }

  async listOrders(currentUser: AuthenticatedUser) {
    requireAdminUser(currentUser);
    const orders = await this.prisma.order.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 30
    });
    const userIds = [...new Set(orders.flatMap((order) => [order.buyerId, order.sellerId]))];
    const productIds = [...new Set(orders.map((order) => order.productId))];
    const [users, products] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true }
      }),
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, title: true, status: true }
      })
    ]);
    const userMap = new Map(users.map((user) => [user.id, user.displayName]));
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

  async updateOrderStatus(orderId: number, payload: UpdateAdminOrderStatusDto, currentUser: AuthenticatedUser) {
    const adminUser = requireAdminUser(currentUser);
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

    const result = await this.prisma.$transaction(async (tx) => {
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
            select: { accountStatus: true }
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
          seller?.accountStatus !== AccountStatus.BANNED &&
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
          actorId: adminUser.id,
          actorName: this.getActorName(adminUser),
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

    await this.searchService.syncProduct(result.productId);
    return result;
  }

  async listCampusServices(currentUser: AuthenticatedUser) {
    requireAdminUser(currentUser);
    const listings = await this.prisma.campusServiceListing.findMany({
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 30
    });
    const userIds = [...new Set(
      listings
        .flatMap((listing) => [listing.ownerId])
        .filter((id): id is number => typeof id === 'number')
    )];
    const listingIds = listings.map((listing) => listing.id);
    const orders = listingIds.length
      ? await this.prisma.campusServiceOrder.findMany({
          where: { listingId: { in: listingIds } },
          orderBy: [{ createdAt: 'desc' }]
        })
      : [];
    orders.forEach((order) => {
      userIds.push(order.requesterId, order.providerId);
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(userIds)] } },
      select: { id: true, displayName: true }
    });
    const userMap = new Map(users.map((user) => [user.id, user.displayName]));
    const latestOrderMap = new Map<number, (typeof orders)[number] | null>();
    const activeOrderMap = new Map<number, (typeof orders)[number] | null>();
    orders.forEach((order) => {
      if (!latestOrderMap.has(order.listingId)) {
        latestOrderMap.set(order.listingId, order);
      }
      if (!activeOrderMap.has(order.listingId) && activeCampusOrderStatuses.includes(order.status)) {
        activeOrderMap.set(order.listingId, order);
      }
    });

    const mapAdminStatus = (listingStatus: CampusServiceListingStatus, latestOrderStatus: CampusServiceOrderStatus | null) => {
      if (listingStatus === CampusServiceListingStatus.CANCELED) {
        return 'CANCELED' as const;
      }

      if (latestOrderStatus && activeCampusOrderStatuses.includes(latestOrderStatus)) {
        return 'MATCHED' as const;
      }

      if (
        listingStatus === CampusServiceListingStatus.OPEN
        || listingStatus === CampusServiceListingStatus.BUSY
        || listingStatus === CampusServiceListingStatus.PAUSED
      ) {
        return listingStatus;
      }

      if (latestOrderStatus === CampusServiceOrderStatus.COMPLETED) {
        return 'DONE' as const;
      }

      if (listingStatus === CampusServiceListingStatus.ENDED) {
        return 'ENDED' as const;
      }

      if (latestOrderStatus === CampusServiceOrderStatus.CANCELED || latestOrderStatus === CampusServiceOrderStatus.EXPIRED) {
        return 'CANCELED' as const;
      }

      return listingStatus;
    };

    return listings.map((listing) => {
      const latestOrder = latestOrderMap.get(listing.id) ?? null;
      const activeOrder = activeOrderMap.get(listing.id) ?? null;
      const primaryOrder = activeOrder ?? latestOrder;
      const requesterId = primaryOrder?.requesterId ?? null;
      const providerId = primaryOrder?.providerId ?? null;
      const publisherId = listing.ownerId;
      const participantId = primaryOrder
        ? (listing.intent === CampusServiceIntent.REQUEST ? providerId : requesterId)
        : null;
      const reward = primaryOrder?.finalAmount ?? listing.amount ?? 0;

      return {
        id: listing.id,
        title: listing.title,
        category: listing.category,
        intent: listing.intent,
        intentLabel: listing.intent === CampusServiceIntent.REQUEST ? '找人帮我' : '我来提供',
        reward: Number(reward),
        publisherId,
        publisherName: userMap.get(publisherId) ?? `用户#${publisherId}`,
        participantId,
        participantName: participantId ? userMap.get(participantId) ?? `用户#${participantId}` : null,
        status: mapAdminStatus(listing.status, activeOrder?.status ?? latestOrder?.status ?? null),
        locationFrom: listing.routeFrom ?? listing.locationNote ?? '待协商',
        locationTo: listing.routeTo ?? listing.locationNote ?? '待协商',
        deadlineLabel: listing.validUntilAt.toISOString().slice(0, 16).replace('T', ' '),
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt
      };
    });
  }

  async updateCampusServiceStatus(
    listingId: number,
    payload: UpdateAdminCampusServiceStatusDto,
    currentUser: AuthenticatedUser
  ) {
    const adminUser = requireAdminUser(currentUser);

    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.campusServiceListing.findUnique({
        where: { id: listingId }
      });

      if (!listing) {
        throw new NotFoundException('校园服务发布不存在');
      }

      const latestOrder = await tx.campusServiceOrder.findFirst({
        where: { listingId },
        orderBy: { createdAt: 'desc' }
      });
      const activeOrder = await tx.campusServiceOrder.findFirst({
        where: {
          listingId,
          status: {
            in: activeCampusOrderStatuses
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      const actionLabelMap: Record<AdminCampusServiceAction, string> = {
        [AdminCampusServiceAction.REOPEN]: '恢复开放',
        [AdminCampusServiceAction.FORCE_MATCH]: '强制设为进行中',
        [AdminCampusServiceAction.FORCE_COMPLETE]: '强制完成',
        [AdminCampusServiceAction.CANCEL]: '关闭发布'
      };

      if (
        payload.action === AdminCampusServiceAction.FORCE_MATCH
        && !activeOrder
      ) {
        throw new BadRequestException('没有可推进的服务单，不能强制设为进行中');
      }

      if (payload.action === AdminCampusServiceAction.FORCE_COMPLETE && !activeOrder) {
        throw new BadRequestException('没有服务单，不能直接强制完成');
      }

      if (payload.action === AdminCampusServiceAction.REOPEN) {
        await tx.campusServiceListing.update({
          where: { id: listingId },
          data: {
            status: CampusServiceListingStatus.OPEN,
            endReason: null,
            endedAt: null
          }
        });
      }

      if (payload.action === AdminCampusServiceAction.CANCEL) {
        await tx.campusServiceListing.update({
          where: { id: listingId },
          data: {
            status: CampusServiceListingStatus.CANCELED,
            endReason: CampusServiceListingEndReason.ADMIN_CLOSE,
            endedAt: new Date()
          }
        });
        await tx.campusServiceOrder.updateMany({
          where: {
            listingId,
            status: {
              in: activeCampusOrderStatuses
            }
          },
          data: {
            status: CampusServiceOrderStatus.CANCELED,
            canceledAt: new Date(),
            cancelReason: this.getDetail(payload.reason, '管理员关闭发布')
          }
        });
      }

      if (payload.action === AdminCampusServiceAction.FORCE_MATCH && activeOrder) {
        await tx.campusServiceListing.update({
          where: { id: listingId },
          data: {
            status: CampusServiceListingStatus.BUSY,
            endReason: null,
            endedAt: null
          }
        });
        if (activeOrder.status === CampusServiceOrderStatus.PENDING_CONFIRMATION) {
          await tx.campusServiceOrder.update({
            where: { id: activeOrder.id },
            data: {
              status: CampusServiceOrderStatus.CONFIRMED,
              confirmedAt: activeOrder.confirmedAt ?? new Date()
            }
          });
        }
      }

      if (payload.action === AdminCampusServiceAction.FORCE_COMPLETE && activeOrder) {
        await tx.campusServiceOrder.update({
          where: { id: activeOrder.id },
          data: {
            status: CampusServiceOrderStatus.COMPLETED,
            completedAt: activeOrder.completedAt ?? new Date()
          }
        });
        await tx.campusServiceListing.update({
          where: { id: listingId },
          data: {
            status: CampusServiceListingStatus.ENDED,
            endReason: CampusServiceListingEndReason.MANUAL_END,
            endedAt: new Date()
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: adminUser.id,
          actorName: this.getActorName(adminUser),
          action: 'UPDATE_CAMPUS_SERVICE_STATUS',
          targetType: 'CAMPUS_SERVICE',
          targetId: listingId,
          detail: this.getDetail(payload.reason, `校园服务${actionLabelMap[payload.action]}`)
        }
      });

      return {
        id: listingId,
        action: payload.action
      };
    });
  }
}
