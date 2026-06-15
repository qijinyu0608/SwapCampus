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

    await this.prisma.auditLog.create({
      data: {
        actorId: reporterUser.id,
        actorName: `用户#${reporterUser.id}`,
        action: 'CREATE_REPORT',
        targetType: payload.productId ? 'PRODUCT' : payload.campusServiceListingId ? 'CAMPUS_SERVICE' : 'USER',
        targetId: payload.productId ?? payload.campusServiceListingId ?? payload.targetUserId!,
        detail: payload.reason
      }
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
    let affectedUserId: number | null = null;
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

      if (payload.nextStatus === 'OFFLINE_PRODUCT' && !report.productId) {
        throw new BadRequestException('当前举报没有关联商品');
      }

      if ((payload.nextStatus === 'BAN_USER' || payload.nextStatus === 'UNBAN_USER') && !report.targetUserId) {
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
      }

      if (payload.nextStatus === 'BAN_USER' && report.targetUserId) {
        const operationAt = new Date();
        const targetUser = await tx.user.findUnique({
          where: { id: report.targetUserId },
          select: { id: true, accountStatus: true, creditScore: true }
        });

        if (!targetUser) {
          throw new NotFoundException('举报关联用户不存在');
        }

        if (targetUser.accountStatus === AccountStatus.BANNED) {
          throw new BadRequestException('举报关联用户已处于封禁状态');
        }

        await tx.user.update({
          where: { id: report.targetUserId },
          data: { accountStatus: AccountStatus.BANNED }
        });

        const onSaleProductIds = (
          await tx.product.findMany({
            where: {
              sellerId: report.targetUserId,
              status: ProductStatus.ON_SALE
            },
            select: { id: true }
          })
        ).map((product: { id: number }) => product.id);

        const reconciledProductIds = await Promise.all([
          cancelOrdersForUserAndReconcileProducts(tx, report.targetUserId, operationAt),
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
          cancelCampusServicesForUser(tx, report.targetUserId, payload.resolutionNote?.trim() || '举报封禁处理'),
          applyCreditScoreDelta(tx, report.targetUserId, REPORT_BAN_CREDIT_PENALTY)
        ]);

        reconciledProductIds[0].forEach((id) => affectedProductIds.add(id));
        onSaleProductIds.forEach((id) => affectedProductIds.add(id));
        affectedUserId = report.targetUserId;

        await this.outboxService.publishSellerSearchEvent({
          sellerId: report.targetUserId,
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
        }
      }

      if (
        (payload.nextStatus === 'RESOLVED' || payload.nextStatus === 'OFFLINE_PRODUCT')
        && report.targetUserId
      ) {
        await applyCreditScoreDelta(tx, report.targetUserId, REPORT_RESOLVED_CREDIT_PENALTY);
      }

      if (payload.nextStatus === 'UNBAN_USER' && report.targetUserId) {
        const targetUser = await tx.user.findUnique({
          where: { id: report.targetUserId },
          select: { id: true, accountStatus: true }
        });

        if (!targetUser) {
          throw new NotFoundException('举报关联用户不存在');
        }

        if (targetUser.accountStatus === AccountStatus.ACTIVE) {
          throw new BadRequestException('举报关联用户当前未被封禁');
        }

        await tx.user.update({
          where: { id: report.targetUserId },
          data: { accountStatus: AccountStatus.ACTIVE }
        });
        affectedUserId = report.targetUserId;

        await this.outboxService.publishSellerSearchEvent({
          sellerId: report.targetUserId,
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

      await tx.auditLog.create({
        data: {
          actorId: adminUser.id,
          actorName: `管理员#${adminUser.id}`,
          action: payload.nextStatus,
          targetType: report.productId ? 'REPORT_PRODUCT' : 'REPORT_USER',
          targetId: report.productId ?? report.targetUserId ?? report.id,
          detail: payload.resolutionNote?.trim() || `举报处理结果：${payload.nextStatus}`
        }
      });

      return {
        id: updated.id,
        status: updated.status,
        resolutionNote: updated.resolutionNote,
        affectedProductIds: Array.from(affectedProductIds),
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
