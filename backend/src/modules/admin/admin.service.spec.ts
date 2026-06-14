import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CampusServiceIntent,
  CampusServiceListingEndReason,
  CampusServiceListingStatus,
  CampusServiceOrderStatus,
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
      campusServiceListing: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      campusServiceOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn()
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined)
      },
      user: {
        findMany: jest.fn().mockResolvedValue([])
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
    } as any);
  }

  it('should reopen listing and clear end markers', async () => {
    const { prisma, tx } = createPrisma();
    const completedOrder = createOrder({
      status: CampusServiceOrderStatus.COMPLETED
    });
    tx.campusServiceListing.findUnique.mockResolvedValue(createListing({
      status: CampusServiceListingStatus.PAUSED,
      endReason: CampusServiceListingEndReason.ADMIN_CLOSE,
      endedAt: new Date('2026-06-12T09:00:00.000Z')
    }));
    tx.campusServiceOrder.findFirst
      .mockResolvedValueOnce(completedOrder)
      .mockResolvedValueOnce(null);
    tx.campusServiceListing.update.mockResolvedValue(createListing({
      status: CampusServiceListingStatus.OPEN
    }));

    const service = createService(prisma);
    const result = await service.updateCampusServiceStatus(18, {
      action: AdminCampusServiceAction.REOPEN,
      reason: '重新开放'
    }, adminUser);

    expect(tx.campusServiceListing.update).toHaveBeenCalledWith({
      where: { id: 18 },
      data: {
        status: CampusServiceListingStatus.OPEN,
        endReason: null,
        endedAt: null
      }
    });
    expect(tx.campusServiceOrder.update).not.toHaveBeenCalled();
    expect(tx.campusServiceOrder.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 18,
      action: AdminCampusServiceAction.REOPEN
    });
  });

  it('should cancel listing and all active orders', async () => {
    const { prisma, tx } = createPrisma();
    const confirmedOrder = createOrder({
      status: CampusServiceOrderStatus.CONFIRMED
    });
    tx.campusServiceListing.findUnique.mockResolvedValue(createListing());
    tx.campusServiceOrder.findFirst
      .mockResolvedValueOnce(confirmedOrder)
      .mockResolvedValueOnce(confirmedOrder);

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

  it('should force match listing and confirm pending order', async () => {
    const { prisma, tx } = createPrisma();
    const pendingOrder = createOrder({
      status: CampusServiceOrderStatus.PENDING_CONFIRMATION,
      confirmedAt: null
    });
    tx.campusServiceListing.findUnique.mockResolvedValue(createListing({
      status: CampusServiceListingStatus.OPEN
    }));
    tx.campusServiceOrder.findFirst
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce(pendingOrder);

    const service = createService(prisma);
    const result = await service.updateCampusServiceStatus(18, {
      action: AdminCampusServiceAction.FORCE_MATCH
    }, adminUser);

    expect(tx.campusServiceListing.update).toHaveBeenCalledWith({
      where: { id: 18 },
      data: {
        status: CampusServiceListingStatus.BUSY,
        endReason: null,
        endedAt: null
      }
    });
    expect(tx.campusServiceOrder.update).toHaveBeenCalledWith({
      where: { id: 301 },
      data: {
        status: CampusServiceOrderStatus.CONFIRMED,
        confirmedAt: expect.any(Date)
      }
    });
    expect(result).toEqual({
      id: 18,
      action: AdminCampusServiceAction.FORCE_MATCH
    });
  });

  it('should force complete latest order and close listing', async () => {
    const { prisma, tx } = createPrisma();
    const confirmedOrder = createOrder({
      status: CampusServiceOrderStatus.CONFIRMED,
      completedAt: null
    });
    tx.campusServiceListing.findUnique.mockResolvedValue(createListing({
      status: CampusServiceListingStatus.BUSY
    }));
    tx.campusServiceOrder.findFirst
      .mockResolvedValueOnce(confirmedOrder)
      .mockResolvedValueOnce(confirmedOrder);

    const service = createService(prisma);
    const result = await service.updateCampusServiceStatus(18, {
      action: AdminCampusServiceAction.FORCE_COMPLETE
    }, adminUser);

    expect(tx.campusServiceOrder.update).toHaveBeenCalledWith({
      where: { id: 301 },
      data: {
        status: CampusServiceOrderStatus.COMPLETED,
        completedAt: expect.any(Date)
      }
    });
    expect(tx.campusServiceListing.update).toHaveBeenCalledWith({
      where: { id: 18 },
      data: {
        status: CampusServiceListingStatus.ENDED,
        endReason: CampusServiceListingEndReason.MANUAL_END,
        endedAt: expect.any(Date)
      }
    });
    expect(result).toEqual({
      id: 18,
      action: AdminCampusServiceAction.FORCE_COMPLETE
    });
  });

  it('should reject force match when there is no active order', async () => {
    const { prisma, tx } = createPrisma();
    tx.campusServiceListing.findUnique.mockResolvedValue(createListing());
    tx.campusServiceOrder.findFirst
      .mockResolvedValueOnce(createOrder({
      status: CampusServiceOrderStatus.COMPLETED
    }))
      .mockResolvedValueOnce(null);

    const service = createService(prisma);

    await expect(service.updateCampusServiceStatus(18, {
      action: AdminCampusServiceAction.FORCE_MATCH
    }, adminUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.campusServiceListing.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject force complete when there is no order', async () => {
    const { prisma, tx } = createPrisma();
    tx.campusServiceListing.findUnique.mockResolvedValue(createListing());
    tx.campusServiceOrder.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const service = createService(prisma);

    await expect(service.updateCampusServiceStatus(18, {
      action: AdminCampusServiceAction.FORCE_COMPLETE
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
      intentLabel: '我来提供',
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
