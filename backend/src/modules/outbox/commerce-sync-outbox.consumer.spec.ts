import { OutboxEventStatus, ProductStatus, UserRole } from '@prisma/client';
import { CommerceSyncOutboxConsumer } from './commerce-sync-outbox.consumer';

describe('CommerceSyncOutboxConsumer', () => {
  function createPrisma() {
    const prisma: any = {
      outboxEvent: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(undefined)
      },
      product: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      $transaction: jest.fn(async (input: any) => {
        if (Array.isArray(input)) {
          return Promise.all(input);
        }

        return input(prisma);
      })
    };

    return prisma;
  }

  function createConsumer(prisma: any, vendureServiceOverrides: Record<string, any> = {}) {
    const vendureService = {
      ensureProductVariant: jest.fn().mockResolvedValue({
        id: 'vendure-product-1',
        variantId: 'vendure-variant-1'
      }),
      ensureCustomer: jest.fn().mockResolvedValue({
        id: 'vendure-customer-1'
      }),
      createPlacedOrder: jest.fn().mockResolvedValue({
        id: 'vendure-order-1',
        code: 'SC00000001'
      }),
      cancelOrder: jest.fn().mockResolvedValue(undefined),
      settleOrderPayment: jest.fn().mockResolvedValue(undefined),
      ...vendureServiceOverrides
    };

    return {
      consumer: new CommerceSyncOutboxConsumer(prisma, vendureService as any),
      vendureService
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COMMERCE_SYNC_ENABLED = 'false';
  });

  it('should sync published product and mark product synced', async () => {
    const prisma = createPrisma();
    prisma.product.findUnique.mockResolvedValue({
      id: 18,
      title: '二手教材',
      status: ProductStatus.ON_SALE
    });
    const { consumer, vendureService } = createConsumer(prisma);

    await consumer.handleEvent({
      id: 1,
      topic: 'commerce.sync',
      eventType: 'ProductPublished',
      aggregateType: 'PRODUCT' as any,
      aggregateId: 18,
      payload: { productId: 18 },
      status: OutboxEventStatus.PENDING,
      availableAt: new Date(),
      retryCount: 0,
      lastError: null,
      processingStartedAt: null,
      createdAt: new Date(),
      processedAt: null
    });

    expect(vendureService.ensureProductVariant).toHaveBeenCalledWith(expect.objectContaining({ id: 18 }));
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 18 },
      data: {
        vendureProductId: 'vendure-product-1',
        vendureVariantId: 'vendure-variant-1',
        commerceSyncStatus: 'SYNCED',
        commerceSyncError: null
      }
    });
  });

  it('should ensure vendure order before canceling and mark order synced', async () => {
    const prisma = createPrisma();
    prisma.order.findUnique.mockResolvedValue({
      id: 91,
      productId: 18,
      buyerId: 11,
      note: '线下面交',
      vendureOrderId: null,
      product: { id: 18 },
      buyer: { id: 11, role: UserRole.USER }
    });
    const { consumer, vendureService } = createConsumer(prisma);

    await consumer.handleEvent({
      id: 2,
      topic: 'commerce.sync',
      eventType: 'OrderCanceled',
      aggregateType: 'ORDER' as any,
      aggregateId: 91,
      payload: { orderId: 91 },
      status: OutboxEventStatus.PENDING,
      availableAt: new Date(),
      retryCount: 0,
      lastError: null,
      processingStartedAt: null,
      createdAt: new Date(),
      processedAt: null
    });

    expect(vendureService.ensureProductVariant).toHaveBeenCalled();
    expect(vendureService.ensureCustomer).toHaveBeenCalled();
    expect(vendureService.createPlacedOrder).toHaveBeenCalled();
    expect(vendureService.cancelOrder).toHaveBeenCalledWith('vendure-order-1');
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 91 },
      data: {
        commerceSyncStatus: 'SYNCED',
        commerceSyncError: null
      }
    });
  });

  it('should requeue failed user sync event and persist pending error state', async () => {
    const prisma = createPrisma();
    const now = new Date('2026-06-15T10:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      email: 'user@example.com'
    });
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 3,
        topic: 'commerce.sync',
        eventType: 'UserRegisteredForCommerce',
        aggregateType: 'USER',
        aggregateId: 7,
        payload: { userId: 7 },
        status: OutboxEventStatus.PENDING,
        availableAt: now,
        retryCount: 0,
        lastError: null,
        processingStartedAt: null,
        createdAt: now,
        processedAt: null
      }
    ]);
    const { consumer, vendureService } = createConsumer(prisma, {
      ensureCustomer: jest.fn().mockRejectedValue(new Error('vendure down'))
    });

    const handled = await consumer.pollOnce(now);

    expect(handled).toBe(1);
    expect(vendureService.ensureCustomer).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
    expect(prisma.user.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 7 },
      data: {
        commerceSyncStatus: 'PROCESSING',
        commerceSyncError: null
      }
    });
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: expect.objectContaining({
        status: OutboxEventStatus.PENDING,
        retryCount: 1,
        lastError: 'vendure down',
        processingStartedAt: null
      })
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        commerceSyncStatus: 'PENDING',
        commerceSyncError: 'vendure down'
      }
    });
  });
});
