import { BadRequestException } from '@nestjs/common';
import { AccountStatus, OrderStatus, ProductOfflineReason, ProductStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService moderation safeguards', () => {
  const user = {
    id: 11,
    studentId: '2026000011',
    email: 'user@example.com',
    role: 'USER'
  } as any;

  it('should reject duplicated open appeal from same appellant on same order', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 8,
          buyerId: 11,
          sellerId: 22,
          status: OrderStatus.IN_PROGRESS
        })
      },
      orderAppeal: {
        findFirst: jest.fn().mockResolvedValue({ id: 3 }),
        create: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    } as any;

    const service = new OrdersService(prisma, {
      publishMessageEvent: jest.fn().mockResolvedValue(undefined),
      publishGovernanceEvent: jest.fn().mockResolvedValue(undefined)
    } as any);

    await expect(
      service.createAppeal(8, {
        issueType: '未按约定交付',
        reason: '对方没有按约定地点出现',
        expectedAction: '取消订单'
      }, user)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should not restore product on cancel when seller is banned', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 8,
          productId: 18,
          buyerId: 11,
          sellerId: 22,
          status: OrderStatus.PENDING,
          vendureOrderId: null
        }),
        update: jest.fn().mockResolvedValue({
          id: 8,
          productId: 18,
          status: OrderStatus.CANCELED
        }),
        findFirst: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 18,
          sellerId: 22,
          status: ProductStatus.OFFLINE,
          offlineReason: ProductOfflineReason.ORDER_RESERVED
        }),
        update: jest.fn()
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          accountStatus: AccountStatus.BANNED
        })
      },
      conversation: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      message: {
        create: jest.fn().mockResolvedValue(undefined)
      },
      $transaction: jest.fn(async (callback) => callback(prisma))
    } as any;

    const service = new OrdersService(prisma, {
      publishProductSearchEvent: jest.fn().mockResolvedValue(undefined),
      publishProductCommerceSyncEvent: jest.fn().mockResolvedValue(undefined),
      publishOrderCommerceSyncEvent: jest.fn().mockResolvedValue(undefined),
      publishMessageEvent: jest.fn().mockResolvedValue(undefined),
      publishGovernanceEvent: jest.fn().mockResolvedValue(undefined)
    } as any);

    await service.cancelOrder(8, { reason: '买家取消' }, user);

    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: {
        status: OrderStatus.CANCELED,
        canceledAt: expect.any(Date),
        commerceSyncStatus: 'PENDING',
        commerceSyncError: null
      }
    });
  });

  it('should not restore product on cancel when offline reason is not order reserved', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 9,
          productId: 28,
          buyerId: 11,
          sellerId: 22,
          status: OrderStatus.PENDING,
          vendureOrderId: null
        }),
        update: jest.fn().mockResolvedValue({
          id: 9,
          productId: 28,
          status: OrderStatus.CANCELED
        }),
        findFirst: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 28,
          sellerId: 22,
          status: ProductStatus.OFFLINE,
          offlineReason: ProductOfflineReason.REPORT_OFFLINE
        }),
        update: jest.fn()
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          accountStatus: AccountStatus.ACTIVE
        })
      },
      conversation: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      message: {
        create: jest.fn().mockResolvedValue(undefined)
      },
      $transaction: jest.fn(async (callback) => callback(prisma))
    } as any;

    const service = new OrdersService(prisma, {
      publishProductSearchEvent: jest.fn().mockResolvedValue(undefined),
      publishProductCommerceSyncEvent: jest.fn().mockResolvedValue(undefined),
      publishOrderCommerceSyncEvent: jest.fn().mockResolvedValue(undefined),
      publishMessageEvent: jest.fn().mockResolvedValue(undefined),
      publishGovernanceEvent: jest.fn().mockResolvedValue(undefined)
    } as any);

    await service.cancelOrder(9, { reason: '买家取消' }, user);

    expect(prisma.product.update).not.toHaveBeenCalled();
  });
});
