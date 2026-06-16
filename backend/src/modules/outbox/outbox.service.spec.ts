import { OutboxAggregateType, OutboxEventStatus } from '@prisma/client';
import { OutboxService } from './outbox.service';
import {
  COMMERCE_SYNC_OUTBOX_TOPIC,
  GOVERNANCE_OUTBOX_TOPIC,
  MESSAGE_OUTBOX_TOPIC,
  RECOMMENDATION_OUTBOX_TOPIC,
  SEARCH_INDEX_OUTBOX_TOPIC
} from './outbox.types';

describe('OutboxService', () => {
  function createPrisma() {
    return {
      outboxEvent: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 1,
          ...data
        }))
      }
    } as any;
  }

  it('should publish product search event with search topic and product payload', async () => {
    const prisma = createPrisma();
    const service = new OutboxService(prisma);
    const availableAt = new Date('2026-06-15T10:00:00.000Z');

    await service.publishProductSearchEvent({
      productId: 18,
      eventType: 'ProductStatusChanged',
      changedBy: 'orders',
      reason: 'ORDER_RESERVED',
      availableAt
    });

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        topic: SEARCH_INDEX_OUTBOX_TOPIC,
        eventType: 'ProductStatusChanged',
        aggregateType: OutboxAggregateType.PRODUCT,
        aggregateId: 18,
        payload: {
          productId: 18,
          changedBy: 'orders',
          reason: 'ORDER_RESERVED'
        },
        status: OutboxEventStatus.PENDING,
        availableAt
      }
    });
  });

  it('should publish seller search event with user aggregate', async () => {
    const prisma = createPrisma();
    const service = new OutboxService(prisma);

    await service.publishSellerSearchEvent({
      sellerId: 22,
      eventType: 'SellerProfileChanged',
      changedBy: 'users',
      reason: 'USER_PROFILE_UPDATED'
    });

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        topic: SEARCH_INDEX_OUTBOX_TOPIC,
        eventType: 'SellerProfileChanged',
        aggregateType: OutboxAggregateType.USER,
        aggregateId: 22,
        payload: {
          sellerId: 22,
          changedBy: 'users',
          reason: 'USER_PROFILE_UPDATED'
        },
        status: OutboxEventStatus.PENDING,
        availableAt: expect.any(Date)
      })
    });
  });

  it('should publish product commerce sync event with product aggregate', async () => {
    const prisma = createPrisma();
    const service = new OutboxService(prisma);

    await service.publishProductCommerceSyncEvent({
      productId: 33,
      eventType: 'ProductPublished'
    });

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        topic: COMMERCE_SYNC_OUTBOX_TOPIC,
        eventType: 'ProductPublished',
        aggregateType: OutboxAggregateType.PRODUCT,
        aggregateId: 33,
        payload: {
          productId: 33
        },
        status: OutboxEventStatus.PENDING,
        availableAt: expect.any(Date)
      })
    });
  });

  it('should publish product availability sync event with product aggregate', async () => {
    const prisma = createPrisma();
    const service = new OutboxService(prisma);

    await service.publishProductCommerceSyncEvent({
      productId: 34,
      eventType: 'ProductAvailabilityChanged'
    });

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        topic: COMMERCE_SYNC_OUTBOX_TOPIC,
        eventType: 'ProductAvailabilityChanged',
        aggregateType: OutboxAggregateType.PRODUCT,
        aggregateId: 34,
        payload: {
          productId: 34
        },
        status: OutboxEventStatus.PENDING,
        availableAt: expect.any(Date)
      })
    });
  });

  it('should publish product inventory sync event with product aggregate', async () => {
    const prisma = createPrisma();
    const service = new OutboxService(prisma);

    await service.publishProductCommerceSyncEvent({
      productId: 35,
      eventType: 'ProductInventoryChanged'
    });

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        topic: COMMERCE_SYNC_OUTBOX_TOPIC,
        eventType: 'ProductInventoryChanged',
        aggregateType: OutboxAggregateType.PRODUCT,
        aggregateId: 35,
        payload: {
          productId: 35
        },
        status: OutboxEventStatus.PENDING,
        availableAt: expect.any(Date)
      })
    });
  });

  it('should publish order commerce sync event with order aggregate', async () => {
    const prisma = createPrisma();
    const service = new OutboxService(prisma);

    await service.publishOrderCommerceSyncEvent({
      orderId: 91,
      eventType: 'OrderCompleted'
    });

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        topic: COMMERCE_SYNC_OUTBOX_TOPIC,
        eventType: 'OrderCompleted',
        aggregateType: OutboxAggregateType.ORDER,
        aggregateId: 91,
        payload: {
          orderId: 91
        },
        status: OutboxEventStatus.PENDING,
        availableAt: expect.any(Date)
      })
    });
  });

  it('should use transaction client when provided', async () => {
    const prisma = createPrisma();
    const tx = createPrisma();
    const service = new OutboxService(prisma);

    await service.publishUserCommerceSyncEvent({
      userId: 7,
      eventType: 'UserRegisteredForCommerce'
    }, tx);

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        topic: COMMERCE_SYNC_OUTBOX_TOPIC,
        eventType: 'UserRegisteredForCommerce',
        aggregateType: OutboxAggregateType.USER,
        aggregateId: 7,
        payload: {
          userId: 7
        }
      })
    });
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('should publish dedicated order payment and fulfillment events', async () => {
    const prisma = createPrisma();
    const service = new OutboxService(prisma);

    await service.publishOrderPaymentSettledEvent({ orderId: 101 });
    await service.publishOrderFulfillmentCompletedEvent({ orderId: 101 });

    expect(prisma.outboxEvent.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        topic: COMMERCE_SYNC_OUTBOX_TOPIC,
        eventType: 'OrderPaymentSettled',
        aggregateType: OutboxAggregateType.ORDER,
        aggregateId: 101,
        payload: {
          orderId: 101
        }
      })
    });
    expect(prisma.outboxEvent.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        topic: COMMERCE_SYNC_OUTBOX_TOPIC,
        eventType: 'OrderFulfillmentCompleted',
        aggregateType: OutboxAggregateType.ORDER,
        aggregateId: 101,
        payload: {
          orderId: 101
        }
      })
    });
  });

  it('should publish message lifecycle event with conversation aggregate', async () => {
    const prisma = createPrisma();
    const service = new OutboxService(prisma);

    await service.publishMessageEvent({
      conversationId: 12,
      messageId: 99,
      senderId: 7,
      type: 'TEXT'
    });

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        topic: MESSAGE_OUTBOX_TOPIC,
        eventType: 'MessageSent',
        aggregateType: OutboxAggregateType.CONVERSATION,
        aggregateId: 12,
        payload: {
          conversationId: 12,
          messageId: 99,
          senderId: 7,
          type: 'TEXT'
        }
      })
    });
  });

  it('should publish recommendation event with user aggregate', async () => {
    const prisma = createPrisma();
    const service = new OutboxService(prisma);

    await service.publishRecommendationEvent({
      userId: 7,
      productId: 18,
      eventType: 'FavoriteChanged',
      action: 'FAVORITE',
      occurredAt: new Date('2026-06-15T10:00:00.000Z')
    });

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        topic: RECOMMENDATION_OUTBOX_TOPIC,
        eventType: 'FavoriteChanged',
        aggregateType: OutboxAggregateType.USER,
        aggregateId: 7,
        payload: {
          userId: 7,
          productId: 18,
          action: 'FAVORITE',
          occurredAt: '2026-06-15T10:00:00.000Z'
        }
      })
    });
  });

  it('should publish governance event with target aggregate', async () => {
    const prisma = createPrisma();
    const service = new OutboxService(prisma);

    await service.publishGovernanceEvent({
      actorId: 9,
      actorName: '管理员#9',
      action: 'BAN_USER',
      targetType: 'USER',
      targetId: 18,
      detail: '封禁测试',
      aggregateType: OutboxAggregateType.USER,
      aggregateId: 18
    });

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        topic: GOVERNANCE_OUTBOX_TOPIC,
        eventType: 'AuditLogRequested',
        aggregateType: OutboxAggregateType.USER,
        aggregateId: 18,
        payload: {
          actorId: 9,
          actorName: '管理员#9',
          action: 'BAN_USER',
          targetType: 'USER',
          targetId: 18,
          detail: '封禁测试'
        }
      })
    });
  });
});
