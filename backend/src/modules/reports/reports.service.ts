import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, OrderStatus, ProductOfflineReason, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAdminUser, requireAuthenticatedUser } from '../auth/auth.utils';
import { cancelCampusServicesForUser } from '../campus-services/campus-service-moderation';
import { OutboxService } from '../outbox/outbox.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { cancelOrdersForUserAndReconcileProducts } from '../orders/order-cancel-reconciliation';
import {
  applyCreditScoreDelta,
  REPORT_BAN_CREDIT_PENALTY,
  REPORT_RESOLVED_CREDIT_PENALTY
} from '../users/user-credit.utils';
import {
  normalizeGovernancePenaltyLevel,
  requiresBanForPenalty
} from '../moderation/governance-penalty.utils';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(OutboxService)
    private readonly outboxService: OutboxService
  ) {}

  async listReports(currentUser: AuthenticatedUser) {
    requireAdminUser(currentUser);
    const reports = await this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    return reports.map((report) => ({
      id: report.id,
      reporterId: report.reporterId,
      productId: report.productId,
      campusServiceListingId: report.campusServiceListingId,
      targetUserId: report.targetUserId,
      reason: report.reason,
      status: report.status,
      resolutionNote: report.resolutionNote,
      handledBy: report.handledBy,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    }));
  }

  async createReport(payload: CreateReportDto, currentUser: AuthenticatedUser) {
    const reporterUser = requireAuthenticatedUser(currentUser);
    const targetCount = [payload.productId, payload.campusServiceListingId, payload.targetUserId]
      .filter((value) => value !== undefined)
      .length;

    if (targetCount === 0) {
      throw new BadRequestException('举报对象不能为空');
    }

    if (targetCount > 1) {
      throw new BadRequestException('一次举报只能针对一个对象');
    }

    const reporter = await this.prisma.user.findUnique({
      where: { id: reporterUser.id },
      select: { id: true, accountStatus: true }
    });

    if (!reporter) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (reporter.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法发起举报');
    }

    if (payload.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: payload.productId },
        select: { id: true }
      });

      if (!product) {
        throw new NotFoundException('举报商品不存在');
      }
    }

    if (payload.campusServiceListingId) {
      const listing = await this.prisma.campusServiceListing.findUnique({
        where: { id: payload.campusServiceListingId },
        select: { id: true }
      });

      if (!listing) {
        throw new NotFoundException('举报校园服务不存在');
      }
    }

    if (payload.targetUserId) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: payload.targetUserId },
        select: { id: true }
      });

      if (!targetUser) {
        throw new NotFoundException('举报用户不存在');
      }
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId: reporterUser.id,
        productId: payload.productId,
        campusServiceListingId: payload.campusServiceListingId,
        targetUserId: payload.targetUserId,
        reason: payload.reason,
        status: 'OPEN'
      }
    });

    await this.outboxService.publishGovernanceEvent({
      actorId: reporterUser.id,
      actorName: `用户#${reporterUser.id}`,
      action: 'CREATE_REPORT',
      targetType: payload.productId ? 'PRODUCT' : payload.campusServiceListingId ? 'CAMPUS_SERVICE' : 'USER',
      targetId: payload.productId ?? payload.campusServiceListingId ?? payload.targetUserId!,
      detail: payload.reason,
      aggregateType: payload.productId
        ? 'PRODUCT' as any
        : payload.campusServiceListingId
          ? 'CAMPUS_SERVICE' as any
          : 'USER' as any,
      aggregateId: payload.productId ?? payload.campusServiceListingId ?? payload.targetUserId!
    });

    return {
      id: report.id,
      status: report.status,
      reason: report.reason
    };
  }

  async resolveReport(reportId: number, payload: ResolveReportDto, currentUser: AuthenticatedUser) {
    const adminUser = requireAdminUser(currentUser);
    const affectedProductIds = new Set<number>();
    const affectedCampusServiceListingIds = new Set<number>();
    let affectedUserId: number | null = null;
    const penaltyLevel = normalizeGovernancePenaltyLevel(payload.penaltyLevel);
    const result = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId }
      });

      if (!report) {
        throw new NotFoundException('举报不存在');
      }

      if (report.status !== 'OPEN') {
        throw new BadRequestException('举报已处理，不能重复操作');
      }

      const finalStatus = ['OFFLINE_PRODUCT', 'BAN_USER', 'UNBAN_USER'].includes(payload.nextStatus)
        ? 'RESOLVED'
        : payload.nextStatus;

      if (payload.nextStatus === 'OFFLINE_PRODUCT' && !report.productId && !report.campusServiceListingId) {
        throw new BadRequestException('当前举报没有关联可下架对象');
      }

      if ((payload.nextStatus === 'BAN_USER' || payload.nextStatus === 'UNBAN_USER') && !requiresBanForPenalty(penaltyLevel)) {
        throw new BadRequestException('仅严重违规举报才允许封号或解封');
      }

      let reportTargetUserId = report.targetUserId ?? null;
      if (!reportTargetUserId && report.productId) {
        const productOwner = await tx.product.findUnique({
          where: { id: report.productId },
          select: { sellerId: true }
        });
        reportTargetUserId = productOwner?.sellerId ?? null;
      }
      if (!reportTargetUserId && report.campusServiceListingId) {
        const listingOwner = await tx.campusServiceListing.findUnique({
          where: { id: report.campusServiceListingId },
          select: { ownerId: true }
        });
        reportTargetUserId = listingOwner?.ownerId ?? null;
      }

      if ((payload.nextStatus === 'BAN_USER' || payload.nextStatus === 'UNBAN_USER') && !reportTargetUserId) {
        throw new BadRequestException('当前举报没有关联用户');
      }

      if (payload.nextStatus === 'OFFLINE_PRODUCT' && report.productId) {
        const operationAt = new Date();
        const product = await tx.product.findUnique({
          where: { id: report.productId },
          select: { id: true, status: true, offlineReason: true }
        });

        if (!product) {
          throw new NotFoundException('举报关联商品不存在');
        }

        if (product.status === ProductStatus.SOLD) {
          throw new BadRequestException('已售商品不能通过举报处理改为下架');
        }

        if (product.status === ProductStatus.OFFLINE) {
          throw new BadRequestException('举报关联商品当前已下架');
        }

        await Promise.all([
          tx.product.update({
            where: { id: report.productId },
            data: {
              status: ProductStatus.OFFLINE,
              offlineReason: ProductOfflineReason.REPORT_OFFLINE
            }
          }),
          tx.order.updateMany({
            where: {
              productId: report.productId,
              status: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS, OrderStatus.WAITING_REVIEW] }
            },
            data: { status: OrderStatus.CANCELED, canceledAt: operationAt }
          })
        ]);
        affectedProductIds.add(report.productId);

        await this.outboxService.publishProductSearchEvent({
          productId: report.productId,
          eventType: 'ProductStatusChanged',
          changedBy: 'reports',
          reason: 'REPORT_PRODUCT_OFFLINE'
        }, tx);
        await this.outboxService.publishProductCommerceSyncEvent({
          productId: report.productId,
          eventType: 'ProductAvailabilityChanged'
        }, tx);
        await this.outboxService.publishProductCommerceSyncEvent({
          productId: report.productId,
          eventType: 'ProductInventoryChanged'
        }, tx);
      }

      if (payload.nextStatus === 'OFFLINE_PRODUCT' && report.campusServiceListingId) {
        const operationAt = new Date();
        const listing = await tx.campusServiceListing.findUnique({
          where: { id: report.campusServiceListingId },
          select: {
            id: true,
            status: true
          }
        });

        if (!listing) {
          throw new NotFoundException('举报关联校园服务不存在');
        }

        if (!['OPEN', 'BUSY', 'PAUSED'].includes(listing.status)) {
          throw new BadRequestException('举报关联校园服务当前已归档');
        }

        await tx.campusServiceListing.update({
          where: { id: listing.id },
          data: {
            status: 'CANCELED',
            endReason: 'ADMIN_CLOSE',
            endedAt: operationAt
          }
        });
        await tx.campusServiceOrder.updateMany({
          where: {
            listingId: listing.id,
            status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED', 'WAITING_COMPLETE_CONFIRM'] }
          },
          data: {
            status: 'CANCELED',
            canceledAt: operationAt,
            cancelReason: payload.resolutionNote?.trim() || '校园服务举报下架处理'
          }
        });
        affectedCampusServiceListingIds.add(listing.id);
      }

      if (payload.nextStatus === 'BAN_USER' && reportTargetUserId) {
        const operationAt = new Date();
        const targetUser = await tx.user.findUnique({
          where: { id: reportTargetUserId },
          select: { id: true, accountStatus: true, creditScore: true }
        });

        if (!targetUser) {
          throw new NotFoundException('举报关联用户不存在');
        }

        if (targetUser.accountStatus === AccountStatus.BANNED) {
          throw new BadRequestException('举报关联用户已处于封禁状态');
        }

        await tx.user.update({
          where: { id: reportTargetUserId },
          data: { accountStatus: AccountStatus.BANNED }
        });

        const onSaleProductIds = (
          await tx.product.findMany({
            where: {
              sellerId: reportTargetUserId,
              status: ProductStatus.ON_SALE
            },
            select: { id: true }
          })
        ).map((product: { id: number }) => product.id);

        const [{ canceledOrderIds, reconciledProductIds }] = await Promise.all([
          cancelOrdersForUserAndReconcileProducts(tx, reportTargetUserId, operationAt),
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
          cancelCampusServicesForUser(tx, reportTargetUserId, payload.resolutionNote?.trim() || '举报封禁处理'),
          applyCreditScoreDelta(tx, reportTargetUserId, REPORT_BAN_CREDIT_PENALTY)
        ]);

        reconciledProductIds.forEach((id) => affectedProductIds.add(id));
        onSaleProductIds.forEach((id) => affectedProductIds.add(id));
        affectedUserId = reportTargetUserId;

        for (const orderId of canceledOrderIds) {
          await this.outboxService.publishOrderCommerceSyncEvent({
            orderId,
            eventType: 'OrderCanceled'
          }, tx);
        }

        await this.outboxService.publishSellerSearchEvent({
          sellerId: reportTargetUserId,
          eventType: 'SellerStatusChanged',
          changedBy: 'reports',
          reason: 'REPORT_USER_BANNED'
        }, tx);

        for (const productId of Array.from(affectedProductIds)) {
          await this.outboxService.publishProductSearchEvent({
            productId,
            eventType: 'ProductStatusChanged',
            changedBy: 'reports',
            reason: 'REPORT_USER_BANNED'
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
      }

      if (
        (payload.nextStatus === 'RESOLVED' || payload.nextStatus === 'OFFLINE_PRODUCT')
        && reportTargetUserId
      ) {
        affectedUserId = affectedUserId ?? reportTargetUserId;
        await applyCreditScoreDelta(tx, reportTargetUserId, REPORT_RESOLVED_CREDIT_PENALTY);
      }

      if (payload.nextStatus === 'UNBAN_USER' && reportTargetUserId) {
        const targetUser = await tx.user.findUnique({
          where: { id: reportTargetUserId },
          select: { id: true, accountStatus: true }
        });

        if (!targetUser) {
          throw new NotFoundException('举报关联用户不存在');
        }

        if (targetUser.accountStatus === AccountStatus.ACTIVE) {
          throw new BadRequestException('举报关联用户当前未被封禁');
        }

        await tx.user.update({
          where: { id: reportTargetUserId },
          data: { accountStatus: AccountStatus.ACTIVE }
        });
        affectedUserId = reportTargetUserId;

        await this.outboxService.publishSellerSearchEvent({
          sellerId: reportTargetUserId,
          eventType: 'SellerStatusChanged',
          changedBy: 'reports',
          reason: 'REPORT_USER_UNBANNED'
        }, tx);
      }

      const updated = await tx.report.update({
        where: { id: reportId },
        data: {
          status: finalStatus,
          resolutionNote: payload.resolutionNote,
          handledBy: adminUser.id
        }
      });

      await this.outboxService.publishGovernanceEvent({
        actorId: adminUser.id,
        actorName: `管理员#${adminUser.id}`,
        action: payload.nextStatus,
        targetType: report.productId ? 'REPORT_PRODUCT' : report.campusServiceListingId ? 'REPORT_CAMPUS_SERVICE' : 'REPORT_USER',
        targetId: report.productId ?? report.campusServiceListingId ?? reportTargetUserId ?? report.id,
        detail: payload.resolutionNote?.trim() || `举报处理结果：${payload.nextStatus}（${penaltyLevel === 'SEVERE' ? '严重违规' : '普通违规'}）`,
        aggregateType: report.productId
          ? 'PRODUCT' as any
          : report.campusServiceListingId
            ? 'CAMPUS_SERVICE' as any
            : reportTargetUserId
              ? 'USER' as any
              : 'REPORT' as any,
        aggregateId: report.productId ?? report.campusServiceListingId ?? reportTargetUserId ?? report.id
      }, tx);

      return {
        id: updated.id,
        status: updated.status,
        resolutionNote: updated.resolutionNote,
        affectedProductIds: Array.from(affectedProductIds),
        affectedCampusServiceListingIds: Array.from(affectedCampusServiceListingIds),
        affectedUserId
      };
    });
    return result;
  }

  async listAuditLogs(currentUser: AuthenticatedUser) {
    requireAdminUser(currentUser);
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40
    });

    return logs.map((log) => ({
      id: log.id,
      actorName: log.actorName,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      detail: log.detail,
      createdAt: log.createdAt
    }));
  }
}
