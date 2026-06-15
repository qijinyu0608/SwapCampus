import { ProductStatus } from '@prisma/client';
import {
  backfillSearchOutbox,
  buildProductBackfillEventData,
  buildSellerBackfillEventData
} from './backfill-search-outbox';

describe('backfillSearchOutbox', () => {
  function createPrisma() {
    return {
      product: {
        findMany: jest.fn().mockResolvedValue([])
      },
      user: {
        findMany: jest.fn().mockResolvedValue([])
      },
      outboxEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;
  }

  it('builds product update events for on-sale products', () => {
    const now = new Date('2026-06-15T10:00:00.000Z');

    expect(buildProductBackfillEventData({
      id: 18,
      status: ProductStatus.ON_SALE,
      updatedAt: now
    }, now)).toEqual({
      topic: 'search.index',
      eventType: 'ProductUpdated',
      aggregateType: 'PRODUCT',
      aggregateId: 18,
      payload: {
        productId: 18,
        changedBy: 'backfill',
        reason: 'PRODUCT_UPDATED'
      },
      status: 'PENDING',
      availableAt: now
    });
  });

  it('builds seller profile events for seller backfill', () => {
    const now = new Date('2026-06-15T10:00:00.000Z');

    expect(buildSellerBackfillEventData({
      id: 22,
      updatedAt: now
    }, now)).toEqual({
      topic: 'search.index',
      eventType: 'SellerProfileChanged',
      aggregateType: 'USER',
      aggregateId: 22,
      payload: {
        sellerId: 22,
        changedBy: 'backfill',
        reason: 'USER_PROFILE_UPDATED'
      },
      status: 'PENDING',
      availableAt: now
    });
  });

  it('creates missing product and seller events', async () => {
    const prisma = createPrisma();
    const now = new Date('2026-06-15T10:00:00.000Z');
    prisma.product.findMany.mockResolvedValue([
      {
        id: 18,
        status: ProductStatus.OFFLINE,
        updatedAt: new Date('2026-06-14T09:00:00.000Z')
      }
    ]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 22,
        updatedAt: new Date('2026-06-14T09:00:00.000Z')
      }
    ]);

    const result = await backfillSearchOutbox(prisma, now);

    expect(result).toEqual({
      createdEvents: 2,
      createdProductEvents: 1,
      createdSellerEvents: 1
    });
    expect(prisma.outboxEvent.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        eventType: 'ProductStatusChanged',
        aggregateType: 'PRODUCT',
        aggregateId: 18
      })
    });
    expect(prisma.outboxEvent.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        eventType: 'SellerProfileChanged',
        aggregateType: 'USER',
        aggregateId: 22
      })
    });
  });

  it('skips aggregates that already have newer search events', async () => {
    const prisma = createPrisma();
    const updatedAt = new Date('2026-06-14T09:00:00.000Z');
    prisma.product.findMany.mockResolvedValue([
      {
        id: 18,
        status: ProductStatus.ON_SALE,
        updatedAt
      }
    ]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 22,
        updatedAt
      }
    ]);
    prisma.outboxEvent.findFirst
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2 });

    const result = await backfillSearchOutbox(prisma, new Date('2026-06-15T10:00:00.000Z'));

    expect(result).toEqual({
      createdEvents: 0,
      createdProductEvents: 0,
      createdSellerEvents: 0
    });
    expect(prisma.outboxEvent.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        topic: 'search.index',
        aggregateType: 'PRODUCT',
        aggregateId: 18,
        createdAt: {
          gte: updatedAt
        }
      },
      select: { id: true }
    });
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });
});
