import { OutboxAggregateType, OutboxEventStatus } from '@prisma/client';
import { SearchIndexOutboxConsumer } from './search-index-outbox.consumer';
import {
  SEARCH_INDEX_MAX_RETRIES,
  SEARCH_INDEX_OUTBOX_TOPIC,
  SEARCH_INDEX_PROCESSING_TIMEOUT_MS
} from './outbox.types';

describe('SearchIndexOutboxConsumer', () => {
  function createEvent(overrides: Record<string, any> = {}) {
    return {
      id: 1,
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
      availableAt: new Date('2026-06-15T10:00:00.000Z'),
      retryCount: 0,
      lastError: null,
      processingStartedAt: null,
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      processedAt: null,
      ...overrides
    };
  }

  function createPrisma() {
    return {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue(undefined)
      }
    } as any;
  }

  function createSearchService() {
    return {
      syncProduct: jest.fn().mockResolvedValue(undefined),
      deleteProduct: jest.fn().mockResolvedValue(undefined),
      syncSellerProducts: jest.fn().mockResolvedValue(undefined)
    } as any;
  }

  function createPrismaKnownRequestError(code: string, message = 'request failed') {
    const error = new Error(message);
    Object.setPrototypeOf(error, Error.prototype);
    Object.assign(error, {
      name: 'PrismaClientKnownRequestError',
      code,
      clientVersion: '5.17.0'
    });
    return error;
  }

  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalEnabled = process.env.SEARCH_INDEX_OUTBOX_ENABLED;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://local/test';
    process.env.SEARCH_INDEX_OUTBOX_ENABLED = 'false';
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.SEARCH_INDEX_OUTBOX_ENABLED = originalEnabled;
  });

  it('should map product upsert-like events to syncProduct', async () => {
    const prisma = createPrisma();
    const searchService = createSearchService();
    const consumer = new SearchIndexOutboxConsumer(prisma, searchService);

    await consumer.handleEvent(createEvent({ eventType: 'ProductCreated' }) as any);
    await consumer.handleEvent(createEvent({ eventType: 'ProductUpdated' }) as any);
    await consumer.handleEvent(createEvent({ eventType: 'ProductStatusChanged' }) as any);

    expect(searchService.syncProduct).toHaveBeenCalledTimes(3);
    expect(searchService.syncProduct).toHaveBeenNthCalledWith(1, 18);
    expect(searchService.syncProduct).toHaveBeenNthCalledWith(2, 18);
    expect(searchService.syncProduct).toHaveBeenNthCalledWith(3, 18);
  });

  it('should map product delete event to deleteProduct', async () => {
    const prisma = createPrisma();
    const searchService = createSearchService();
    const consumer = new SearchIndexOutboxConsumer(prisma, searchService);

    await consumer.handleEvent(createEvent({ eventType: 'ProductDeleted' }) as any);

    expect(searchService.deleteProduct).toHaveBeenCalledWith(18);
  });

  it('should map seller events to syncSellerProducts', async () => {
    const prisma = createPrisma();
    const searchService = createSearchService();
    const consumer = new SearchIndexOutboxConsumer(prisma, searchService);

    await consumer.handleEvent(createEvent({
      eventType: 'SellerStatusChanged',
      aggregateType: OutboxAggregateType.USER,
      aggregateId: 22,
      payload: {
        sellerId: 22,
        changedBy: 'users',
        reason: 'USER_BANNED'
      }
    }) as any);
    await consumer.handleEvent(createEvent({
      eventType: 'SellerProfileChanged',
      aggregateType: OutboxAggregateType.USER,
      aggregateId: 22,
      payload: {
        sellerId: 22,
        changedBy: 'users',
        reason: 'USER_PROFILE_UPDATED'
      }
    }) as any);

    expect(searchService.syncSellerProducts).toHaveBeenCalledTimes(2);
    expect(searchService.syncSellerProducts).toHaveBeenNthCalledWith(1, 22);
    expect(searchService.syncSellerProducts).toHaveBeenNthCalledWith(2, 22);
  });

  it('should claim pending events, process them, and mark them processed', async () => {
    const now = new Date('2026-06-15T10:10:00.000Z');
    const event = createEvent({ id: 7, availableAt: new Date('2026-06-15T10:00:00.000Z') });
    const prisma = createPrisma();
    prisma.outboxEvent.findMany.mockResolvedValue([event]);
    prisma.outboxEvent.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const searchService = createSearchService();
    const consumer = new SearchIndexOutboxConsumer(prisma, searchService);
    const processed = await consumer.pollOnce(now);

    expect(processed).toBe(1);
    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
      where: {
        topic: SEARCH_INDEX_OUTBOX_TOPIC,
        status: OutboxEventStatus.PENDING,
        availableAt: { lte: now }
      },
      orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
      take: 20
    });
    expect(prisma.outboxEvent.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        topic: SEARCH_INDEX_OUTBOX_TOPIC,
        status: OutboxEventStatus.PROCESSING,
        processingStartedAt: {
          lte: new Date(now.getTime() - SEARCH_INDEX_PROCESSING_TIMEOUT_MS)
        }
      },
      data: {
        status: OutboxEventStatus.PENDING,
        processingStartedAt: null,
        availableAt: now
      }
    });
    expect(prisma.outboxEvent.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: 7,
        status: OutboxEventStatus.PENDING
      },
      data: {
        status: OutboxEventStatus.PROCESSING,
        processingStartedAt: now,
        lastError: null
      }
    });
    expect(searchService.syncProduct).toHaveBeenCalledWith(18);
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        status: OutboxEventStatus.PROCESSED,
        processedAt: expect.any(Date),
        processingStartedAt: null,
        lastError: null
      }
    });
  });

  it('should reset expired processing events before polling', async () => {
    const now = new Date('2026-06-15T10:10:00.000Z');
    const prisma = createPrisma();
    prisma.outboxEvent.updateMany.mockResolvedValueOnce({ count: 2 });
    const searchService = createSearchService();
    const consumer = new SearchIndexOutboxConsumer(prisma, searchService);

    await consumer.pollOnce(now);

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: {
        topic: SEARCH_INDEX_OUTBOX_TOPIC,
        status: OutboxEventStatus.PROCESSING,
        processingStartedAt: {
          lte: new Date(now.getTime() - SEARCH_INDEX_PROCESSING_TIMEOUT_MS)
        }
      },
      data: {
        status: OutboxEventStatus.PENDING,
        processingStartedAt: null,
        availableAt: now
      }
    });
  });

  it('should requeue failed events with incremented retry count', async () => {
    const now = new Date('2026-06-15T10:10:00.000Z');
    const event = createEvent({ id: 9, retryCount: 1 });
    const prisma = createPrisma();
    const searchService = createSearchService();
    searchService.syncProduct.mockRejectedValue(new Error('meili down'));
    const consumer = new SearchIndexOutboxConsumer(prisma, searchService);

    await (consumer as any).handleClaimedEvent(event, now);

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: {
        status: OutboxEventStatus.PENDING,
        retryCount: 2,
        lastError: 'meili down',
        processingStartedAt: null,
        availableAt: expect.any(Date)
      }
    });
  });

  it('should tolerate schema-not-ready errors when recovering stale events', async () => {
    const now = new Date('2026-06-15T10:10:00.000Z');
    const prisma = createPrisma();
    prisma.outboxEvent.updateMany.mockRejectedValueOnce(createPrismaKnownRequestError('P2021', 'missing OutboxEvent table'));
    const searchService = createSearchService();
    const consumer = new SearchIndexOutboxConsumer(prisma, searchService);

    await expect(consumer.pollOnce(now)).resolves.toBe(0);
    expect(prisma.outboxEvent.findMany).not.toHaveBeenCalled();
  });

  it('should tolerate schema-not-ready errors when claiming pending events', async () => {
    const now = new Date('2026-06-15T10:10:00.000Z');
    const prisma = createPrisma();
    prisma.outboxEvent.findMany.mockRejectedValueOnce(createPrismaKnownRequestError('P2021', 'missing OutboxEvent table'));
    const searchService = createSearchService();
    const consumer = new SearchIndexOutboxConsumer(prisma, searchService);

    await expect(consumer.pollOnce(now)).resolves.toBe(0);
    expect(prisma.outboxEvent.update).not.toHaveBeenCalled();
  });

  it('should mark event failed after max retries exceeded', async () => {
    const now = new Date('2026-06-15T10:10:00.000Z');
    const event = createEvent({ id: 11, retryCount: SEARCH_INDEX_MAX_RETRIES });
    const prisma = createPrisma();
    const searchService = createSearchService();
    searchService.syncProduct.mockRejectedValue(new Error('meili down'));
    const consumer = new SearchIndexOutboxConsumer(prisma, searchService);

    await (consumer as any).handleClaimedEvent(event, now);

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        status: OutboxEventStatus.FAILED,
        retryCount: SEARCH_INDEX_MAX_RETRIES + 1,
        lastError: 'meili down',
        processingStartedAt: null,
        availableAt: now
      }
    });
  });
});
