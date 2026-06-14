import { BadRequestException } from '@nestjs/common';
import {
  CampusServiceListingStatus,
  OrderStatus,
  ProductOfflineReason,
  ProductStatus
} from '@prisma/client';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const adminUser = {
    id: 22,
    studentId: '2026000022',
    email: 'admin@example.com',
    role: 'ADMIN'
  } as any;

  it('should ban reported user and offline active products when resolving BAN_USER', async () => {
    const prisma = {
      report: {
        findUnique: jest.fn().mockResolvedValue({
          id: 6,
          productId: null,
          targetUserId: 24,
          reason: '站外转账风险',
          status: 'OPEN'
        }),
        update: jest.fn().mockResolvedValue({
          id: 6,
          status: 'RESOLVED',
          resolutionNote: '核查后封禁'
        })
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 24,
          accountStatus: 'ACTIVE',
          creditScore: 60
        }),
        update: jest.fn().mockResolvedValue({
          id: 24,
          isBanned: true
        })
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 201,
          sellerId: 51,
          status: ProductStatus.OFFLINE
        }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 3 })
      },
      order: {
        findMany: jest.fn().mockResolvedValue([{ id: 77, productId: 201 }]),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      campusServiceListing: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([])
      },
      campusServiceOrder: {
        findMany: jest.fn().mockResolvedValue([{
          id: 501,
          listingId: 41,
          listing: {
            id: 41,
            ownerId: 24,
            status: CampusServiceListingStatus.OPEN,
            endReason: null,
            endedAt: null,
            validUntilAt: new Date('2026-06-30T10:00:00.000Z'),
            maxTotalOrders: 1,
            maxConcurrentOrders: 1
          }
        }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        groupBy: jest.fn().mockResolvedValue([])
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;
    prisma.$transaction = jest.fn((callback) => callback(prisma));

    const searchService = {
      syncProduct: jest.fn().mockResolvedValue(undefined),
      syncSellerProducts: jest.fn().mockResolvedValue(undefined)
    } as any;

    const service = new ReportsService(prisma, searchService);
    const result = await service.resolveReport(6, {
      resolutionNote: '核查后封禁',
      nextStatus: 'BAN_USER'
    }, adminUser);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 24 },
      data: { accountStatus: 'BANNED' }
    });
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: {
        sellerId: 24,
        status: { in: [ProductStatus.ON_SALE] }
      },
      data: {
        status: ProductStatus.OFFLINE,
        offlineReason: ProductOfflineReason.USER_BANNED
      }
    });
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [77] } },
      data: { status: OrderStatus.CANCELED, canceledAt: expect.any(Date) }
    });
    expect(prisma.campusServiceListing.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.campusServiceOrder.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.campusServiceOrder.updateMany).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      id: 6,
      status: 'RESOLVED'
    });
    expect(searchService.syncSellerProducts).toHaveBeenCalledWith(24);
  });

  it('should reject BAN_USER when report has no target user', async () => {
    const prisma = {
      report: {
        findUnique: jest.fn().mockResolvedValue({
          id: 7,
          productId: 201,
          targetUserId: null,
          reason: '商品争议',
          status: 'OPEN'
        })
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 24,
          accountStatus: 'ACTIVE',
          creditScore: 60
        }),
        update: jest.fn()
      },
      product: {
        update: jest.fn(),
        updateMany: jest.fn()
      },
      order: {
        updateMany: jest.fn()
      },
      campusServiceListing: {
        updateMany: jest.fn(),
        findMany: jest.fn()
      },
      campusServiceOrder: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    } as any;
    prisma.$transaction = jest.fn((callback) => callback(prisma));

    const service = new ReportsService(prisma, {
      syncProduct: jest.fn(),
      syncSellerProducts: jest.fn()
    } as any);

    await expect(
      service.resolveReport(7, {
        resolutionNote: '无用户对象',
        nextStatus: 'BAN_USER'
      }, adminUser)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject repeated report resolution', async () => {
    const prisma = {
      report: {
        findUnique: jest.fn().mockResolvedValue({
          id: 8,
          productId: null,
          targetUserId: 24,
          reason: '重复处理测试',
          status: 'RESOLVED'
        }),
        update: jest.fn()
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      product: {
        update: jest.fn(),
        updateMany: jest.fn()
      },
      order: {
        updateMany: jest.fn()
      },
      campusServiceListing: {
        updateMany: jest.fn(),
        findMany: jest.fn()
      },
      campusServiceOrder: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    } as any;
    prisma.$transaction = jest.fn((callback) => callback(prisma));

    const service = new ReportsService(prisma, {
      syncProduct: jest.fn(),
      syncSellerProducts: jest.fn()
    } as any);

    await expect(
      service.resolveReport(8, {
        resolutionNote: '重复处理',
        nextStatus: 'RESOLVED'
      }, adminUser)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.report.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject BAN_USER when target user is already banned', async () => {
    const prisma = {
      report: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          productId: null,
          targetUserId: 24,
          reason: '重复封禁',
          status: 'OPEN'
        }),
        update: jest.fn()
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 24,
          accountStatus: 'BANNED',
          creditScore: 60
        }),
        update: jest.fn()
      },
      product: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      order: {
        updateMany: jest.fn()
      },
      campusServiceListing: {
        updateMany: jest.fn(),
        findMany: jest.fn()
      },
      campusServiceOrder: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    } as any;
    prisma.$transaction = jest.fn((callback) => callback(prisma));

    const service = new ReportsService(prisma, {
      syncProduct: jest.fn(),
      syncSellerProducts: jest.fn()
    } as any);

    await expect(
      service.resolveReport(11, {
        resolutionNote: '重复封禁',
        nextStatus: 'BAN_USER'
      }, adminUser)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.report.update).not.toHaveBeenCalled();
  });

  it('should reject UNBAN_USER when target user is already active', async () => {
    const prisma = {
      report: {
        findUnique: jest.fn().mockResolvedValue({
          id: 12,
          productId: null,
          targetUserId: 24,
          reason: '重复解封',
          status: 'OPEN'
        }),
        update: jest.fn()
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 24,
          accountStatus: 'ACTIVE'
        }),
        update: jest.fn()
      },
      product: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      order: {
        updateMany: jest.fn()
      },
      campusServiceListing: {
        updateMany: jest.fn(),
        findMany: jest.fn()
      },
      campusServiceOrder: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    } as any;
    prisma.$transaction = jest.fn((callback) => callback(prisma));

    const service = new ReportsService(prisma, {
      syncProduct: jest.fn(),
      syncSellerProducts: jest.fn()
    } as any);

    await expect(
      service.resolveReport(12, {
        resolutionNote: '重复解封',
        nextStatus: 'UNBAN_USER'
      }, adminUser)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.report.update).not.toHaveBeenCalled();
  });

  it('should reject OFFLINE_PRODUCT for sold product', async () => {
    const prisma = {
      report: {
        findUnique: jest.fn().mockResolvedValue({
          id: 9,
          productId: 201,
          targetUserId: null,
          reason: '已售商品举报',
          status: 'OPEN'
        }),
        update: jest.fn()
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 201,
          status: ProductStatus.SOLD
        }),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      order: {
        updateMany: jest.fn()
      },
      campusServiceListing: {
        updateMany: jest.fn(),
        findMany: jest.fn()
      },
      campusServiceOrder: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    } as any;
    prisma.$transaction = jest.fn((callback) => callback(prisma));

    const service = new ReportsService(prisma, {
      syncProduct: jest.fn(),
      syncSellerProducts: jest.fn()
    } as any);

    await expect(
      service.resolveReport(9, {
        resolutionNote: '已售商品',
        nextStatus: 'OFFLINE_PRODUCT'
      }, adminUser)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.report.update).not.toHaveBeenCalled();
  });

  it('should reject OFFLINE_PRODUCT for already offline product', async () => {
    const prisma = {
      report: {
        findUnique: jest.fn().mockResolvedValue({
          id: 10,
          productId: 202,
          targetUserId: null,
          reason: '重复下架',
          status: 'OPEN'
        }),
        update: jest.fn()
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 202,
          status: ProductStatus.OFFLINE
        }),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      order: {
        updateMany: jest.fn()
      },
      campusServiceListing: {
        updateMany: jest.fn(),
        findMany: jest.fn()
      },
      campusServiceOrder: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    } as any;
    prisma.$transaction = jest.fn((callback) => callback(prisma));

    const service = new ReportsService(prisma, {
      syncProduct: jest.fn(),
      syncSellerProducts: jest.fn()
    } as any);

    await expect(
      service.resolveReport(10, {
        resolutionNote: '已下架',
        nextStatus: 'OFFLINE_PRODUCT'
      }, adminUser)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.report.update).not.toHaveBeenCalled();
  });
});
