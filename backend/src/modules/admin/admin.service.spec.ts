import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CampusServiceIntent,
  CampusServiceListingEndReason,
  CampusServiceListingStatus,
  CampusServiceOrderStatus,
  OrderStatus,
  ProductOfflineReason,
  ProductStatus,
  UserRole
} from '@prisma/client';
import { AdminService } from './admin.service';
import { AdminCampusServiceAction } from './dto/update-admin-campus-service-status.dto';

describe('AdminService', () => {
  const adminUser = {
    id: 7,
    studentId: '2026000007',
    email: 'admin@example.com',
    role: UserRole.ADMIN
  } as any;

  function createListing(overrides: Record<string, unknown> = {}) {
    return {
      id: 18,
      ownerId: 21,
      intent: CampusServiceIntent.REQUEST,
      title: '东门代取快递',
      category: 'ERRAND',
      amount: 6,
      routeFrom: '东门',
      routeTo: '13号公寓',
      locationNote: null,
      validUntilAt: new Date('2026-06-12T10:00:00.000Z'),
      status: CampusServiceListingStatus.OPEN,
      endReason: null,
      endedAt: null,
      createdAt: new Date('2026-06-12T08:00:00.000Z'),
      updatedAt: new Date('2026-06-12T08:30:00.000Z'),
      ...overrides
    };
  }

  function createOrder(overrides: Record<string, unknown> = {}) {
    return {
      id: 301,
      listingId: 18,
      requesterId: 21,
      providerId: 32,
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      finalAmount: 8,
      confirmedAt: null,
      completedAt: null,
      createdAt: new Date('2026-06-12T08:20:00.000Z'),
      updatedAt: new Date('2026-06-12T08:20:00.000Z'),
      ...overrides
    };
  }

  function createPrisma(overrides: Record<string, unknown> = {}) {
    const tx = {
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn()
      },
      product: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      orderAppeal: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      campusServiceListing: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([])
      },
      campusServiceOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([])
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined)
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn()
      }
    } as any;

    const prisma = {
      ...tx,
      $transaction: jest.fn((callback) => callback(tx))
    } as any;

    Object.assign(prisma, overrides);
    return { prisma, tx };
  }

  function createService(prisma: any) {
    return new AdminService(prisma, {
      syncProduct: jest.fn(),
      syncSellerProducts: jest.fn()
    } as any, {
      syncProduct: jest.fn(),
      syncSellerProducts: jest.fn()
    } as any, {
      syncListing: jest.fn(),
      syncOrder: jest.fn()
    } as any);
  }

  it('should cancel active order and reopen product when no other active order exists', async () => {
    const { prisma, tx } = createPrisma();
    tx.order.findUnique.mockResolvedValue({
      id: 91,
      productId: 18,
      status: OrderStatus.PENDING
    });
    tx.product.findUnique.mockResolvedValue({
      id: 18,
      sellerId: 21,
      status: ProductStatus.OFFLINE,
      offlineReason: ProductOfflineReason.ORDER_RESERVED
    });
    tx.order.update.mockResolvedValue({
      id: 91,
      productId: 18,
      status: OrderStatus.CANCELED
    });
    tx.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    tx.user.findUnique.mockResolvedValue({
      accountStatus: 'ACTIVE'
    });

    const service = createService(prisma);
    const result = await service.updateOrderStatus(91, {
      status: OrderStatus.CANCELED,
      reason: '管理员取消'
    }, adminUser);

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 91 },
      data: { status: OrderStatus.CANCELED, canceledAt: expect.any(Date) }
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 18 },
      data: { status: ProductStatus.ON_SALE, offlineReason: null }
    });
    expect(tx.auditLog.create).toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 91,
      productId: 18,
      status: OrderStatus.CANCELED
    });
  });

  it('should reject duplicate product offline action', async () => {
    const { prisma, tx } = createPrisma();
    tx.product.findUnique.mockResolvedValue({
      id: 18,
      title: '二手教材',
      sellerId: 21,
      status: ProductStatus.OFFLINE
    });

    const service = createService(prisma);

    await expect(service.updateProductStatus(18, {
      status: ProductStatus.OFFLINE
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject duplicate product restore action', async () => {
    const { prisma, tx } = createPrisma();
    tx.product.findUnique.mockResolvedValue({
      id: 18,
      title: '二手教材',
      sellerId: 21,
      status: ProductStatus.ON_SALE
    });

    const service = createService(prisma);

    await expect(service.updateProductStatus(18, {
      status: ProductStatus.ON_SALE
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject product restore when active order exists', async () => {
    const { prisma, tx } = createPrisma();
    tx.product.findUnique.mockResolvedValue({
      id: 18,
      title: '二手教材',
      sellerId: 21,
      status: ProductStatus.OFFLINE
    });
    tx.user.findUnique.mockResolvedValue({
      accountStatus: 'ACTIVE'
    });
    tx.order.findFirst.mockResolvedValue({
      id: 91
    });

    const service = createService(prisma);

    await expect(service.updateProductStatus(18, {
      status: ProductStatus.ON_SALE
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject non-cancel admin order status updates', async () => {
    const { prisma } = createPrisma();
    const service = createService(prisma);

    await expect(service.updateOrderStatus(91, {
      status: 'COMPLETED' as any
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject archived order admin updates', async () => {
    const { prisma, tx } = createPrisma();
    tx.order.findUnique.mockResolvedValue({
      id: 91,
      productId: 18,
      status: OrderStatus.COMPLETED
    });
    tx.product.findUnique.mockResolvedValue({
      id: 18,
      sellerId: 21,
      status: ProductStatus.SOLD
    });

    const service = createService(prisma);

    await expect(service.updateOrderStatus(91, {
      status: OrderStatus.CANCELED
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should resolve appeal by canceling active order once', async () => {
    const { prisma, tx } = createPrisma();
    tx.orderAppeal.findUnique.mockResolvedValue({
      id: 51,
      orderId: 91,
      respondentId: 32,
      status: 'OPEN'
    });
    tx.order.findUnique.mockResolvedValue({
      id: 91,
      productId: 18,
      status: OrderStatus.PENDING
    });
    tx.product.findUnique.mockResolvedValue({
      id: 18,
      sellerId: 21,
      status: ProductStatus.OFFLINE,
      offlineReason: ProductOfflineReason.ORDER_RESERVED
    });
    tx.order.update.mockResolvedValue({
      id: 91,
      productId: 18,
      status: OrderStatus.CANCELED
    });
    tx.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    tx.orderAppeal.update.mockResolvedValue({
      id: 51,
      status: 'RESOLVED',
      resolutionNote: '申诉成立'
    });
    tx.user.findUnique.mockResolvedValue({
      accountStatus: 'ACTIVE'
    });
    tx.user.update.mockResolvedValue({
      id: 32,
      creditScore: 54
    });

    const service = createService(prisma);
    const result = await service.resolveOrderAppeal(51, {
      nextStatus: 'CANCELED_ORDER',
      resolutionNote: '申诉成立'
    }, adminUser);

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 91 },
      data: { status: OrderStatus.CANCELED, canceledAt: expect.any(Date) }
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 18 },
      data: { status: ProductStatus.ON_SALE, offlineReason: null }
    });
    expect(tx.orderAppeal.update).toHaveBeenCalledWith({
      where: { id: 51 },
      data: {
        status: 'RESOLVED',
        resolutionNote: '申诉成立',
        handledBy: adminUser.id
      }
    });
    expect(result).toEqual({
      id: 51,
      status: 'RESOLVED',
      resolutionNote: '申诉成立'
    });
  });

  it('should reject repeated appeal resolution', async () => {
    const { prisma, tx } = createPrisma();
    tx.orderAppeal.findUnique.mockResolvedValue({
      id: 51,
      orderId: 91,
      respondentId: 32,
      status: 'RESOLVED'
    });

    const service = createService(prisma);

    await expect(service.resolveOrderAppeal(51, {
      nextStatus: 'RESOLVED'
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.orderAppeal.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject appeal cancel when linked order is archived', async () => {
    const { prisma, tx } = createPrisma();
    tx.orderAppeal.findUnique.mockResolvedValue({
      id: 51,
      orderId: 91,
      respondentId: 32,
      status: 'OPEN'
    });
    tx.order.findUnique.mockResolvedValue({
      id: 91,
      productId: 18,
      status: OrderStatus.COMPLETED
    });
    tx.product.findUnique.mockResolvedValue({
      id: 18,
      sellerId: 21,
      status: ProductStatus.SOLD
    });

    const service = createService(prisma);

    await expect(service.resolveOrderAppeal(51, {
      nextStatus: 'CANCELED_ORDER'
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.orderAppeal.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject BAN_RESPONDENT when respondent is already banned', async () => {
    const { prisma, tx } = createPrisma();
    tx.orderAppeal.findUnique.mockResolvedValue({
      id: 52,
      orderId: 91,
      respondentId: 32,
      status: 'OPEN'
    });
    tx.user.findUnique.mockResolvedValue({
      id: 32,
      accountStatus: 'BANNED'
    });

    const service = createService(prisma);

    await expect(service.resolveOrderAppeal(52, {
      nextStatus: 'BAN_RESPONDENT'
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.orderAppeal.update).not.toHaveBeenCalled();
  });

  it('should reject UNBAN_RESPONDENT when respondent is already active', async () => {
    const { prisma, tx } = createPrisma();
    tx.orderAppeal.findUnique.mockResolvedValue({
      id: 53,
      orderId: 91,
      respondentId: 32,
      status: 'OPEN'
    });
    tx.user.findUnique.mockResolvedValue({
      id: 32,
      accountStatus: 'ACTIVE'
    });

    const service = createService(prisma);

    await expect(service.resolveOrderAppeal(53, {
      nextStatus: 'UNBAN_RESPONDENT'
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.orderAppeal.update).not.toHaveBeenCalled();
  });

  it('should ban respondent with the same cascading effects as admin ban', async () => {
    const { prisma, tx } = createPrisma();
    tx.orderAppeal.findUnique.mockResolvedValue({
      id: 54,
      orderId: 91,
      respondentId: 32,
      status: 'OPEN'
    });
    tx.user.findUnique.mockResolvedValue({
      id: 32,
      accountStatus: 'ACTIVE',
      creditScore: 60
    });
    tx.orderAppeal.update.mockResolvedValue({
      id: 54,
      status: 'RESOLVED',
      resolutionNote: '申诉封禁'
    });
    tx.user.update.mockResolvedValue({
      id: 32,
      accountStatus: 'BANNED'
    });
    tx.order.findMany.mockResolvedValue([
      { id: 91, productId: 18 }
    ]);
    tx.product.findUnique.mockResolvedValue({
      id: 18,
      sellerId: 45,
      status: ProductStatus.OFFLINE
    });
    tx.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const service = createService(prisma);
    const result = await service.resolveOrderAppeal(54, {
      nextStatus: 'BAN_RESPONDENT',
      resolutionNote: '申诉封禁'
    }, adminUser);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 32 },
      data: { accountStatus: 'BANNED' }
    });
    expect(tx.product.updateMany).toHaveBeenCalled();
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [91] } },
      data: { status: OrderStatus.CANCELED, canceledAt: expect.any(Date) }
    });
    expect(tx.campusServiceListing.updateMany).toHaveBeenCalled();
    expect(result).toEqual({
      id: 54,
      status: 'RESOLVED',
      resolutionNote: '申诉封禁'
    });
  });

  it('should reject removed reopen action', async () => {
    const { prisma, tx } = createPrisma();
    tx.campusServiceListing.findUnique.mockResolvedValue(createListing({
      status: CampusServiceListingStatus.PAUSED,
      endReason: CampusServiceListingEndReason.ADMIN_CLOSE,
      endedAt: new Date('2026-06-12T09:00:00.000Z')
    }));

    const service = createService(prisma);

    await expect(service.updateCampusServiceStatus(18, {
      action: 'REOPEN' as AdminCampusServiceAction,
      reason: '重新开放'
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.campusServiceListing.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should cancel listing and all active orders', async () => {
    const { prisma, tx } = createPrisma();
    const confirmedOrder = createOrder({
      status: CampusServiceOrderStatus.CONFIRMED
    });
    tx.campusServiceListing.findUnique.mockResolvedValue(createListing());

    const service = createService(prisma);
    const result = await service.updateCampusServiceStatus(18, {
      action: AdminCampusServiceAction.CANCEL,
      reason: '管理员关闭'
    }, adminUser);

    expect(tx.campusServiceListing.update).toHaveBeenCalledWith({
      where: { id: 18 },
      data: {
        status: CampusServiceListingStatus.CANCELED,
        endReason: CampusServiceListingEndReason.ADMIN_CLOSE,
        endedAt: expect.any(Date)
      }
    });
    expect(tx.campusServiceOrder.updateMany).toHaveBeenCalledWith({
      where: {
        listingId: 18,
        status: {
          in: [
            CampusServiceOrderStatus.PENDING_CONFIRMATION,
            CampusServiceOrderStatus.CONFIRMED,
            CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
          ]
        }
      },
      data: {
        status: CampusServiceOrderStatus.CANCELED,
        canceledAt: expect.any(Date),
        cancelReason: '管理员关闭'
      }
    });
    expect(result).toEqual({
      id: 18,
      action: AdminCampusServiceAction.CANCEL
    });
  });

  it('should reject removed force match action', async () => {
    const { prisma, tx } = createPrisma();
    tx.campusServiceListing.findUnique.mockResolvedValue(createListing({
      status: CampusServiceListingStatus.OPEN
    }));

    const service = createService(prisma);

    await expect(service.updateCampusServiceStatus(18, {
      action: 'FORCE_MATCH' as AdminCampusServiceAction
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.campusServiceListing.update).not.toHaveBeenCalled();
    expect(tx.campusServiceOrder.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject archived campus service admin updates', async () => {
    const { prisma, tx } = createPrisma();
    tx.campusServiceListing.findUnique.mockResolvedValue(createListing({
      status: CampusServiceListingStatus.ENDED,
      endReason: CampusServiceListingEndReason.MANUAL_END,
      endedAt: new Date('2026-06-12T09:00:00.000Z')
    }));

    const service = createService(prisma);

    await expect(service.updateCampusServiceStatus(18, {
      action: AdminCampusServiceAction.CANCEL
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.campusServiceListing.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject removed force complete action', async () => {
    const { prisma, tx } = createPrisma();
    tx.campusServiceListing.findUnique.mockResolvedValue(createListing());

    const service = createService(prisma);

    await expect(service.updateCampusServiceStatus(18, {
      action: 'FORCE_COMPLETE' as AdminCampusServiceAction
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.campusServiceOrder.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should throw when campus service listing does not exist', async () => {
    const { prisma, tx } = createPrisma();
    tx.campusServiceListing.findUnique.mockResolvedValue(null);

    const service = createService(prisma);

    await expect(service.updateCampusServiceStatus(404, {
      action: AdminCampusServiceAction.CANCEL
    }, adminUser)).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.campusServiceOrder.findFirst).not.toHaveBeenCalled();
  });

  it('should keep reusable open listings visible as OPEN even if latest order is completed', async () => {
    const listings = [
      createListing({
        id: 18,
        status: CampusServiceListingStatus.OPEN,
        intent: CampusServiceIntent.OFFER
      }),
      createListing({
        id: 19,
        status: CampusServiceListingStatus.CANCELED,
        endReason: CampusServiceListingEndReason.ADMIN_CLOSE,
        endedAt: new Date('2026-06-12T09:30:00.000Z')
      }),
      createListing({
        id: 20,
        status: CampusServiceListingStatus.ENDED,
        endReason: CampusServiceListingEndReason.MANUAL_END,
        endedAt: new Date('2026-06-12T09:40:00.000Z')
      })
    ];
    const orders = [
      createOrder({
        id: 401,
        listingId: 18,
        status: CampusServiceOrderStatus.COMPLETED,
        requesterId: 81,
        providerId: 21,
        finalAmount: 12
      }),
      createOrder({
        id: 402,
        listingId: 19,
        status: CampusServiceOrderStatus.CANCELED,
        requesterId: 82,
        providerId: 21,
        finalAmount: 9
      }),
      createOrder({
        id: 403,
        listingId: 20,
        status: CampusServiceOrderStatus.COMPLETED,
        requesterId: 83,
        providerId: 21,
        finalAmount: 15
      })
    ];
    const prisma = {
      campusServiceListing: {
        findMany: jest.fn().mockResolvedValue(listings)
      },
      campusServiceOrder: {
        findMany: jest.fn().mockResolvedValue(orders)
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 21, displayName: '何栖' },
          { id: 81, displayName: '陈远' },
          { id: 82, displayName: '林澈' },
          { id: 83, displayName: '高宁' }
        ])
      }
    } as any;

    const service = createService(prisma);
    const result = await service.listCampusServices(adminUser);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      id: 18,
      intent: CampusServiceIntent.OFFER,
      intentLabel: '我要接单挣钱',
      status: CampusServiceListingStatus.OPEN,
      participantId: 81,
      participantName: '陈远',
      reward: 12
    });
    expect(result[1]).toMatchObject({
      id: 19,
      status: 'CANCELED'
    });
    expect(result[2]).toMatchObject({
      id: 20,
      status: 'DONE'
    });
  });

  it('should prefer active order over newer completed history when listing admin status and participant', async () => {
    const listing = createListing({
      id: 28,
      intent: CampusServiceIntent.REQUEST,
      status: CampusServiceListingStatus.BUSY
    });
    const orders = [
      createOrder({
        id: 502,
        listingId: 28,
        createdAt: new Date('2026-06-12T09:30:00.000Z'),
        updatedAt: new Date('2026-06-12T09:40:00.000Z'),
        status: CampusServiceOrderStatus.COMPLETED,
        requesterId: 21,
        providerId: 45,
        finalAmount: 10
      }),
      createOrder({
        id: 501,
        listingId: 28,
        createdAt: new Date('2026-06-12T08:20:00.000Z'),
        updatedAt: new Date('2026-06-12T08:25:00.000Z'),
        status: CampusServiceOrderStatus.CONFIRMED,
        requesterId: 21,
        providerId: 32,
        finalAmount: 8
      })
    ];
    const prisma = {
      campusServiceListing: {
        findMany: jest.fn().mockResolvedValue([listing])
      },
      campusServiceOrder: {
        findMany: jest.fn().mockResolvedValue(orders)
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 21, displayName: '何栖' },
          { id: 32, displayName: '陈远' },
          { id: 45, displayName: '林澈' }
        ])
      }
    } as any;

    const service = createService(prisma);
    const [result] = await service.listCampusServices(adminUser);

    expect(result).toMatchObject({
      id: 28,
      status: 'MATCHED',
      participantId: 32,
      participantName: '陈远',
      reward: 8
    });
  });
});
