import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, CampusServiceStatus, OrderStatus, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAdminUser, requireAuthenticatedUser } from '../auth/auth.utils';
import { SearchService } from '../search/search.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SearchService)
    private readonly searchService: SearchService
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
    if (!payload.productId && !payload.targetUserId) {
      throw new BadRequestException('举报对象不能为空');
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
        targetType: payload.productId ? 'PRODUCT' : 'USER',
        targetId: payload.productId ?? payload.targetUserId!,
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
    const result = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId }
      });

      if (!report) {
        throw new NotFoundException('举报不存在');
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
        await Promise.all([
          tx.product.update({
            where: { id: report.productId },
            data: { status: ProductStatus.OFFLINE }
          }),
          tx.order.updateMany({
            where: {
              productId: report.productId,
              status: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS, OrderStatus.WAITING_REVIEW] }
            },
            data: { status: OrderStatus.CANCELED }
          })
        ]);
      }

      if (payload.nextStatus === 'BAN_USER' && report.targetUserId) {
        await Promise.all([
          tx.user.update({
            where: { id: report.targetUserId },
            data: { accountStatus: AccountStatus.BANNED }
          }),
          tx.product.updateMany({
            where: {
              sellerId: report.targetUserId,
              status: { in: [ProductStatus.PENDING, ProductStatus.ON_SALE] }
            },
            data: { status: ProductStatus.OFFLINE }
          }),
          tx.order.updateMany({
            where: {
              OR: [{ buyerId: report.targetUserId }, { sellerId: report.targetUserId }],
              status: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS, OrderStatus.WAITING_REVIEW] }
            },
            data: { status: OrderStatus.CANCELED }
          }),
          tx.campusServiceTask.updateMany({
            where: {
              OR: [{ publisherId: report.targetUserId }, { accepterId: report.targetUserId }],
              status: { in: [CampusServiceStatus.OPEN, CampusServiceStatus.MATCHED] }
            },
            data: { status: CampusServiceStatus.CANCELED }
          })
        ]);
      }

      if (payload.nextStatus === 'UNBAN_USER' && report.targetUserId) {
        await tx.user.update({
          where: { id: report.targetUserId },
          data: { accountStatus: AccountStatus.ACTIVE }
        });
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
          detail: payload.resolutionNote
        }
      });

      return {
        id: updated.id,
        status: updated.status,
        resolutionNote: updated.resolutionNote
      };
    });

    const resolvedReport = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { productId: true, targetUserId: true }
    });
    if (resolvedReport?.productId) {
      await this.searchService.syncProduct(resolvedReport.productId);
    }
    if (resolvedReport?.targetUserId) {
      await this.searchService.syncSellerProducts(resolvedReport.targetUserId);
    }
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
