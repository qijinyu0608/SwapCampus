import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  CampusServiceIntent,
  CampusServiceListingEndReason,
  CampusServiceListingStatus,
  CampusServiceOrderStatus,
  OrderStatus,
  ProductOfflineReason,
  PrismaClient,
  ProductStatus
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAdminUser } from '../auth/auth.utils';
import { OutboxService } from '../outbox/outbox.service';
import {
  AdminCampusServiceAction,
  UpdateAdminCampusServiceStatusDto
  } from './dto/update-admin-campus-service-status.dto';
import { UpdateAdminOrderStatusDto } from './dto/update-admin-order-status.dto';
import { UpdateAdminProductStatusDto } from './dto/update-admin-product-status.dto';
import { ProductsService } from '../products/products.service';
import { CampusServicesService } from '../campus-services/campus-services.service';
import { cancelCampusServicesForUser } from '../campus-services/campus-service-moderation';
import { cancelOrdersForUserAndReconcileProducts } from '../orders/order-cancel-reconciliation';
import { ResolveOrderAppealDto } from '../orders/dto/resolve-order-appeal.dto';
import {
  applyCreditScoreDelta,
  ORDER_APPEAL_BAN_CREDIT_PENALTY,
  ORDER_APPEAL_RESOLVED_CREDIT_PENALTY
} from '../users/user-credit.utils';

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
    @Inject(OutboxService)
    private readonly outboxService: OutboxService,
    @Inject(ProductsService)
    private readonly productsService: ProductsService,
    @Inject(CampusServicesService)
    private readonly campusServicesService: CampusServicesService
  ) {}

  private getActorName(user: AuthenticatedUser) {
    return `管理员#${user.id}`;
  }

  private getDetail(reason: string | undefined, fallback: string) {
    return reason?.trim() || fallback;
  }

  private get orderAppealClient() {
    return this.prisma as PrismaService & Pick<PrismaClient, 'orderAppeal'>;
  }

  private async cancelOrderAsAdmin(
    tx: any,
    orderId: number
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    const product = await tx.product.findUnique({
      where: { id: order.productId },
      select: { id: true, sellerId: true, status: true, offlineReason: true }
    });

    if (!product) {
      throw new NotFoundException('订单关联商品不存在');
    }

    if (!activeOrderStatuses.includes(order.status)) {
      throw new BadRequestException('当前订单已归档，不能再由后台修改');
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELED, canceledAt: new Date() }
    });

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

    let productStatusChanged = false;
    if (otherFinishedOrder) {
      await tx.product.update({
        where: { id: order.productId },
        data: { status: ProductStatus.SOLD, offlineReason: null }
      });
      productStatusChanged = true;
    } else if (
      !otherActiveOrder
      && seller?.accountStatus !== AccountStatus.BANNED
      && product.offlineReason === ProductOfflineReason.ORDER_RESERVED
      && product.status !== ProductStatus.SOLD
    ) {
      await tx.product.update({
        where: { id: order.productId },
        data: { status: ProductStatus.ON_SALE, offlineReason: null }
      });
      productStatusChanged = true;
    }

    return {
      ...updated,
      productStatusChanged
    };
  }

  private async banUserForAdmin(
    tx: any,
    userId: number,
    reason: string,
    creditPenalty: number
  ) {
    const operationAt = new Date();

    await tx.user.update({
      where: { id: userId },
      data: { accountStatus: AccountStatus.BANNED }
    });

    const onSaleProductIds = (
      await tx.product.findMany({
        where: {
          sellerId: userId,
          status: ProductStatus.ON_SALE
        },
        select: { id: true }
      })
    ).map((product: { id: number }) => product.id);

    const [{ canceledOrderIds, reconciledProductIds }] = await Promise.all([
      cancelOrdersForUserAndReconcileProducts(tx, userId, operationAt),
      onSaleProductIds.length
        ? tx.product.updateMany({
            where: {
              id: { in: onSaleProductIds }
            },
            data: {
              status: ProductStatus.OFFLINE,
              offlineReason: ProductOfflineReason.USER_BANNED
            }
          })
        : Promise.resolve({ count: 0 }),
      cancelCampusServicesForUser(tx, userId, reason),
      applyCreditScoreDelta(tx, userId, creditPenalty)
    ]);

    return {
      canceledOrderIds,
      affectedProductIds: [...new Set([...reconciledProductIds, ...onSaleProductIds])]
    };
  }

  async getOverview(currentUser: AuthenticatedUser) {
    requireAdminUser(currentUser);
    const [onSaleProducts, totalUsers, reportCount, appealCount, activeOrders, activeCampusServices] = await Promise.all([
      this.prisma.product.count({ where: { status: ProductStatus.ON_SALE } }),
      this.prisma.user.count(),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.orderAppealClient.orderAppeal.count({ where: { status: 'OPEN' } }),
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
      appealCount,
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

  async getProductPreview(productId: number, currentUser: AuthenticatedUser) {
    requireAdminUser(currentUser);
    return this.productsService.getProductDetail(productId);
  }

  async getCampusServicePreview(listingId: number, currentUser: AuthenticatedUser) {
    requireAdminUser(currentUser);
    return this.campusServicesService.getCampusServiceDetail(listingId);
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
        select: { id: true, title: true, sellerId: true, status: true, offlineReason: true }
      });

      if (!current) {
        throw new NotFoundException('商品不存在');
      }

      if (current.status === ProductStatus.SOLD) {
        throw new BadRequestException('已售商品不能通过审核操作改为上架或下架');
      }

      if (current.status === normalized) {
        throw new BadRequestException(normalized === ProductStatus.ON_SALE ? '商品当前已在上架状态' : '商品当前已下架');
      }

      if (normalized === ProductStatus.ON_SALE) {
        const [seller, activeOrder] = await Promise.all([
          tx.user.findUnique({
            where: { id: current.sellerId },
            select: { accountStatus: true }
          }),
          tx.order.findFirst({
            where: {
              productId,
              status: { in: activeOrderStatuses }
            },
            select: { id: true }
          })
        ]);

        if (seller?.accountStatus === AccountStatus.BANNED) {
          throw new BadRequestException('卖家已被封禁，不能恢复商品展示');
        }

        if (activeOrder) {
          throw new BadRequestException('商品存在进行中的订单，不能恢复上架');
        }
      }

      const product = await tx.product.update({
        where: { id: productId },
        data: {
          status: normalized,
          offlineReason: normalized === ProductStatus.OFFLINE ? ProductOfflineReason.ADMIN_OFFLINE : null
        }
      });

      if (normalized === ProductStatus.OFFLINE) {
        const operationAt = new Date();
        await tx.order.updateMany({
          where: {
            productId,
            status: { in: activeOrderStatuses }
          },
          data: { status: OrderStatus.CANCELED, canceledAt: operationAt }
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

      await this.outboxService.publishProductSearchEvent({
        productId,
        eventType: 'ProductStatusChanged',
        changedBy: 'admin',
        reason: 'ADMIN_PRODUCT_STATUS_CHANGED'
      }, tx);
      await this.outboxService.publishProductCommerceSyncEvent({
        productId,
        eventType: 'ProductAvailabilityChanged'
      }, tx);
      await this.outboxService.publishProductCommerceSyncEvent({
        productId,
        eventType: 'ProductInventoryChanged'
      }, tx);

      return {
        id: product.id,
        status: product.status,
        title: product.title
      };
    });
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
    if (payload.status !== OrderStatus.CANCELED) {
      throw new BadRequestException('后台仅支持取消订单');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await this.cancelOrderAsAdmin(tx, orderId);

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

      if (updated.productStatusChanged) {
        await this.outboxService.publishProductSearchEvent({
          productId: updated.productId,
          eventType: 'ProductStatusChanged',
          changedBy: 'admin',
          reason: 'ADMIN_ORDER_CANCELED'
        }, tx);
        await this.outboxService.publishProductCommerceSyncEvent({
          productId: updated.productId,
          eventType: 'ProductAvailabilityChanged'
        }, tx);
        await this.outboxService.publishProductCommerceSyncEvent({
          productId: updated.productId,
          eventType: 'ProductInventoryChanged'
        }, tx);
      }
      await this.outboxService.publishOrderCommerceSyncEvent({
        orderId,
        eventType: 'OrderCanceled'
      }, tx);

      return {
        id: updated.id,
        status: updated.status,
        productId: updated.productId,
        productStatusChanged: updated.productStatusChanged
      };
    });
    return result;
  }

  async listOrderAppeals(currentUser: AuthenticatedUser) {
    requireAdminUser(currentUser);
    const appeals = await this.orderAppealClient.orderAppeal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    }) as Array<{
      id: number;
      orderId: number;
      appellantId: number;
      respondentId: number;
      issueType: string;
      reason: string;
      expectedAction: string | null;
      status: string;
      resolutionNote: string | null;
      handledBy: number | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    const userIds = [...new Set<number>(appeals.flatMap((appeal) => [appeal.appellantId, appeal.respondentId]))];
    const orderIds = [...new Set<number>(appeals.map((appeal) => appeal.orderId))];
    const [users, orders] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true }
      }),
      this.prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, status: true, productId: true }
      })
    ]);
    const userMap = new Map(users.map((user) => [user.id, user.displayName]));
    const orderMap = new Map(orders.map((order) => [order.id, order]));

    return appeals.map((appeal) => ({
      id: appeal.id,
      orderId: appeal.orderId,
      orderStatus: orderMap.get(appeal.orderId)?.status ?? null,
      productId: orderMap.get(appeal.orderId)?.productId ?? null,
      appellantId: appeal.appellantId,
      appellantName: userMap.get(appeal.appellantId) ?? `用户#${appeal.appellantId}`,
      respondentId: appeal.respondentId,
      respondentName: userMap.get(appeal.respondentId) ?? `用户#${appeal.respondentId}`,
      issueType: appeal.issueType,
      reason: appeal.reason,
      expectedAction: appeal.expectedAction,
      status: appeal.status,
      resolutionNote: appeal.resolutionNote,
      handledBy: appeal.handledBy,
      createdAt: appeal.createdAt,
      updatedAt: appeal.updatedAt
    }));
  }

  async resolveOrderAppeal(appealId: number, payload: ResolveOrderAppealDto, currentUser: AuthenticatedUser) {
    const adminUser = requireAdminUser(currentUser);
    const affectedProductIds = new Set<number>();
    let affectedUserId: number | null = null;

    return this.prisma.$transaction(async (tx) => {
      const appealClient = tx as typeof tx & Pick<PrismaClient, 'orderAppeal'>;
      const appeal = await appealClient.orderAppeal.findUnique({
        where: { id: appealId }
      });

      if (!appeal) {
        throw new NotFoundException('申诉不存在');
      }

      if (appeal.status !== 'OPEN') {
        throw new BadRequestException('申诉已处理，不能重复操作');
      }

      if (payload.nextStatus === 'BAN_RESPONDENT') {
        const respondent = await tx.user.findUnique({
          where: { id: appeal.respondentId },
          select: { id: true, accountStatus: true }
        });

        if (!respondent) {
          throw new NotFoundException('申诉关联用户不存在');
        }

        if (respondent.accountStatus === AccountStatus.BANNED) {
          throw new BadRequestException('申诉关联用户已处于封禁状态');
        }

        const result = await this.banUserForAdmin(
          tx,
          appeal.respondentId,
          payload.resolutionNote?.trim() || '申诉封禁处理',
          ORDER_APPEAL_BAN_CREDIT_PENALTY
        );
        affectedUserId = appeal.respondentId;
        result.affectedProductIds.forEach((id: number) => affectedProductIds.add(id));
        for (const canceledOrderId of result.canceledOrderIds) {
          await this.outboxService.publishOrderCommerceSyncEvent({
            orderId: canceledOrderId,
            eventType: 'OrderCanceled'
          }, tx);
        }
      }

      if (payload.nextStatus === 'UNBAN_RESPONDENT') {
        const respondent = await tx.user.findUnique({
          where: { id: appeal.respondentId },
          select: { id: true, accountStatus: true }
        });

        if (!respondent) {
          throw new NotFoundException('申诉关联用户不存在');
        }

        if (respondent.accountStatus === AccountStatus.ACTIVE) {
          throw new BadRequestException('申诉关联用户当前未被封禁');
        }

        await tx.user.update({
          where: { id: appeal.respondentId },
          data: { accountStatus: AccountStatus.ACTIVE }
        });
        affectedUserId = appeal.respondentId;
      }

      if (payload.nextStatus === 'CANCELED_ORDER') {
        const updatedOrder = await this.cancelOrderAsAdmin(tx, appeal.orderId);
        affectedProductIds.add(updatedOrder.productId);
        await applyCreditScoreDelta(tx, appeal.respondentId, ORDER_APPEAL_RESOLVED_CREDIT_PENALTY);
      }

      if (payload.nextStatus === 'RESOLVED') {
        await applyCreditScoreDelta(tx, appeal.respondentId, ORDER_APPEAL_RESOLVED_CREDIT_PENALTY);
      }

      const finalStatus = ['CANCELED_ORDER', 'BAN_RESPONDENT', 'UNBAN_RESPONDENT'].includes(payload.nextStatus)
        ? 'RESOLVED'
        : payload.nextStatus;

      const updated = await appealClient.orderAppeal.update({
        where: { id: appealId },
        data: {
          status: finalStatus,
          resolutionNote: payload.resolutionNote?.trim() || null,
          handledBy: adminUser.id
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: adminUser.id,
          actorName: this.getActorName(adminUser),
          action: payload.nextStatus,
          targetType: 'ORDER_APPEAL',
          targetId: appealId,
          detail: this.getDetail(payload.resolutionNote, `订单申诉处理：${payload.nextStatus}`)
        }
      });

      for (const productId of Array.from(affectedProductIds)) {
        await this.outboxService.publishProductSearchEvent({
          productId,
          eventType: 'ProductStatusChanged',
          changedBy: 'admin',
          reason: payload.nextStatus === 'CANCELED_ORDER'
            ? 'ORDER_APPEAL_RESOLVED'
            : payload.nextStatus === 'BAN_RESPONDENT'
              ? 'ORDER_APPEAL_BANNED'
              : 'ORDER_APPEAL_UNBANNED'
        }, tx);
        await this.outboxService.publishProductCommerceSyncEvent({
          productId,
          eventType: 'ProductAvailabilityChanged'
        }, tx);
        await this.outboxService.publishProductCommerceSyncEvent({
          productId,
          eventType: 'ProductInventoryChanged'
        }, tx);
      }

      if (payload.nextStatus === 'CANCELED_ORDER') {
        await this.outboxService.publishOrderCommerceSyncEvent({
          orderId: appeal.orderId,
          eventType: 'OrderCanceled'
        }, tx);
      }

      if (affectedUserId) {
        await this.outboxService.publishSellerSearchEvent({
          sellerId: affectedUserId,
          eventType: 'SellerStatusChanged',
          changedBy: 'admin',
          reason: payload.nextStatus === 'BAN_RESPONDENT'
            ? 'ORDER_APPEAL_BANNED'
            : 'ORDER_APPEAL_UNBANNED'
        }, tx);
      }

      return {
        id: updated.id,
        status: updated.status,
        resolutionNote: updated.resolutionNote,
        affectedProductIds: Array.from(affectedProductIds),
        affectedUserId
      };
    });
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
        intentLabel: listing.intent === CampusServiceIntent.REQUEST ? '我要购买服务' : '我要接单挣钱',
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

      const actionLabelMap: Record<AdminCampusServiceAction, string> = {
        [AdminCampusServiceAction.CANCEL]: '关闭发布'
      };

      if (!(payload.action in actionLabelMap)) {
        throw new BadRequestException('不支持的校园服务后台操作');
      }

      if (!activeCampusListingStatuses.includes(listing.status)) {
        throw new BadRequestException('当前校园服务已归档，不能再由后台修改');
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
