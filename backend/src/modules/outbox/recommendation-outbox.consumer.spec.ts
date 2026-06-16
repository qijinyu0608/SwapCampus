import { OutboxAggregateType, OutboxEventStatus } from '@prisma/client';
import { RecommendationOutboxConsumer } from './recommendation-outbox.consumer';
import {
  RECOMMENDATION_MAX_RETRIES,
  RECOMMENDATION_OUTBOX_TOPIC,
  RECOMMENDATION_PROCESSING_TIMEOUT_MS
} from './outbox.types';

describe('RecommendationOutboxConsumer', () => {
  function createEvent(overrides: Record<string, any> = {}) {
    return {
      id: 1,
      topic: RECOMMENDATION_OUTBOX_TOPIC,
      eventType: 'BehaviorTracked',
      aggregateType: OutboxAggregateType.USER,
      aggregateId: 7,
      payload: {
        userId: 7,
        productId: 18,
        action: 'VIEW',
        occurredAt: '2026-06-16T12:00:00.000Z'
      },
      status: OutboxEventStatus.PENDING,
      availableAt: new Date('2026-06-16T12:00:00.000Z'),
      retryCount: 0,
      lastError: null,
      processingStartedAt: null,
      createdAt: new Date('2026-06-16T12:00:00.000Z'),
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
      },
      recommendationProfile: {
        upsert: jest.fn().mockResolvedValue(undefined)
      }
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
  const originalEnabled = process.env.RECOMMENDATION_OUTBOX_ENABLED;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://local/test';
    process.env.RECOMMENDATION_OUTBOX_ENABLED = 'false';
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.RECOMMENDATION_OUTBOX_ENABLED = originalEnabled;
  });

  it('should upsert recommendation profile for view action', async () => {
    const prisma = createPrisma();
    const consumer = new RecommendationOutboxConsumer(prisma);

    await consumer.handleEvent(createEvent() as any);

    expect(prisma.recommendationProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 7 },
      create: {
        userId: 7,
        lastBehaviorAt: new Date('2026-06-16T12:00:00.000Z'),
        viewCount: 1
      },
      update: {
        lastBehaviorAt: new Date('2026-06-16T12:00:00.000Z'),
        viewCount: { increment: 1 }
      }
    });
  });

  it('should map favorite and unfavorite actions to favorite counter updates', async () => {
    const prisma = createPrisma();
    const consumer = new RecommendationOutboxConsumer(prisma);

    await consumer.handleEvent(createEvent({
      eventType: 'FavoriteChanged',
      payload: {
        userId: 7,
        productId: 18,
        action: 'FAVORITE',
        occurredAt: '2026-06-16T12:00:00.000Z'
      }
    }) as any);
    await consumer.handleEvent(createEvent({
      eventType: 'FavoriteChanged',
      payload: {
        userId: 7,
        productId: 18,
        action: 'UNFAVORITE',
        occurredAt: '2026-06-16T12:00:00.000Z'
      }
    }) as any);

    expect(prisma.recommendationProfile.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      update: expect.objectContaining({
        favoriteCount: { increment: 1 }
      }),
      create: expect.objectContaining({
        favoriteCount: 1
      })
    }));
    expect(prisma.recommendationProfile.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      update: expect.objectContaining({
        favoriteCount: { decrement: 1 }
      }),
      create: expect.objectContaining({
        favoriteCount: 0
      })
    }));
  });

  it('should skip processing when recommendation profile model is unavailable', async () => {
    const prisma = {
      outboxEvent: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn()
      }
    } as any;
    const consumer = new RecommendationOutboxConsumer(prisma);

    await expect(consumer.handleEvent(createEvent() as any)).resolves.toBeUndefined();
  });

  it('should claim pending events, process them, and mark them processed', async () => {
    const now = new Date('2026-06-16T12:10:00.000Z');
    const event = createEvent({ id: 7, availableAt: new Date('2026-06-16T12:00:00.000Z') });
    const prisma = createPrisma();
    prisma.outboxEvent.findMany.mockResolvedValue([event]);
    prisma.outboxEvent.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    const consumer = new RecommendationOutboxConsumer(prisma);

    const processed = await consumer.pollOnce(now);

    expect(processed).toBe(1);
    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
      where: {
        topic: RECOMMENDATION_OUTBOX_TOPIC,
        status: OutboxEventStatus.PENDING,
        availableAt: { lte: now }
      },
      orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
      take: 30
    });
    expect(prisma.outboxEvent.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        topic: RECOMMENDATION_OUTBOX_TOPIC,
        status: OutboxEventStatus.PROCESSING,
        processingStartedAt: {
          lte: new Date(now.getTime() - RECOMMENDATION_PROCESSING_TIMEOUT_MS)
        }
      },
      data: {
        status: OutboxEventStatus.PENDING,
        processingStartedAt: null,
        availableAt: now
      }
    });
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

  it('should requeue failed events with incremented retry count', async () => {
    const now = new Date('2026-06-16T12:10:00.000Z');
    const event = createEvent({ id: 9, retryCount: 1 });
    const prisma = createPrisma();
    prisma.recommendationProfile.upsert.mockRejectedValue(new Error('profile store down'));
    const consumer = new RecommendationOutboxConsumer(prisma);

    await (consumer as any).handleClaimedEvent(event, now);

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: {
        status: OutboxEventStatus.PENDING,
        retryCount: 2,
        lastError: 'profile store down',
        processingStartedAt: null,
        availableAt: expect.any(Date)
      }
    });
  });

  it('should mark terminal failures as failed', async () => {
    const now = new Date('2026-06-16T12:10:00.000Z');
    const event = createEvent({ id: 10, retryCount: RECOMMENDATION_MAX_RETRIES });
    const prisma = createPrisma();
    prisma.recommendationProfile.upsert.mockRejectedValue(new Error('profile store down'));
    const consumer = new RecommendationOutboxConsumer(prisma);

    await (consumer as any).handleClaimedEvent(event, now);

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        status: OutboxEventStatus.FAILED,
        retryCount: RECOMMENDATION_MAX_RETRIES + 1,
        lastError: 'profile store down',
        processingStartedAt: null,
        availableAt: now
      }
    });
  });

  it('should tolerate schema-not-ready errors when recovering stale events', async () => {
    const now = new Date('2026-06-16T12:10:00.000Z');
    const prisma = createPrisma();
    prisma.outboxEvent.updateMany.mockRejectedValueOnce(createPrismaKnownRequestError('P2021', 'missing OutboxEvent table'));
    const consumer = new RecommendationOutboxConsumer(prisma);

    await expect(consumer.pollOnce(now)).resolves.toBe(0);
    expect(prisma.outboxEvent.findMany).not.toHaveBeenCalled();
  });

  it('should tolerate schema-not-ready errors when claiming pending events', async () => {
    const now = new Date('2026-06-16T12:10:00.000Z');
    const prisma = createPrisma();
    prisma.outboxEvent.findMany.mockRejectedValueOnce(createPrismaKnownRequestError('P2021', 'missing OutboxEvent table'));
    const consumer = new RecommendationOutboxConsumer(prisma);

    await expect(consumer.pollOnce(now)).resolves.toBe(0);
    expect(prisma.outboxEvent.update).not.toHaveBeenCalled();
  });
});
