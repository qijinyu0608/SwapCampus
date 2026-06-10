import { BadRequestException } from '@nestjs/common';
import { CampusServiceStatus, OrderStatus, ProductStatus } from '@prisma/client';
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
          reason: '站外转账风险'
        }),
        update: jest.fn().mockResolvedValue({
          id: 6,
          status: 'RESOLVED',
          resolutionNote: '核查后封禁'
        })
      },
      user: {
        update: jest.fn().mockResolvedValue({
          id: 24,
          isBanned: true
        })
      },
      product: {
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 3 })
      },
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      campusServiceTask: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
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
        status: { in: [ProductStatus.PENDING, ProductStatus.ON_SALE] }
      },
      data: { status: ProductStatus.OFFLINE }
    });
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: {
        OR: [{ buyerId: 24 }, { sellerId: 24 }],
        status: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS, OrderStatus.WAITING_REVIEW] }
      },
      data: { status: OrderStatus.CANCELED }
    });
    expect(prisma.campusServiceTask.updateMany).toHaveBeenCalledWith({
      where: {
        OR: [{ publisherId: 24 }, { accepterId: 24 }],
        status: { in: [CampusServiceStatus.OPEN, CampusServiceStatus.MATCHED] }
      },
      data: { status: CampusServiceStatus.CANCELED }
    });
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
          reason: '商品争议'
        })
      },
      user: {
        update: jest.fn()
      },
      product: {
        update: jest.fn(),
        updateMany: jest.fn()
      },
      order: {
        updateMany: jest.fn()
      },
      campusServiceTask: {
        updateMany: jest.fn()
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
});
