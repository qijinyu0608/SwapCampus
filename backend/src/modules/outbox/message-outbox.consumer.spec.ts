import { OutboxAggregateType, OutboxEventStatus } from '@prisma/client';
import { MessageOutboxConsumer } from './message-outbox.consumer';
import {
  MESSAGE_MAX_RETRIES,
  MESSAGE_OUTBOX_TOPIC,
  MESSAGE_PROCESSING_TIMEOUT_MS
} from './outbox.types';

describe('MessageOutboxConsumer', () => {
  function createEvent(overrides: Record<string, any> = {}) {
    return {
      id: 1,
      topic: MESSAGE_OUTBOX_TOPIC,
      eventType: 'MessageSent',
      aggregateType: OutboxAggregateType.CONVERSATION,
      aggregateId: 18,
      payload: {
        conversationId: 18,
        messageId: 101,
        senderId: 7,
        type: 'TEXT'
      },
      status: OutboxEventStatus.PENDING,
      availableAt: new Date('2026-06-16T10:00:00.000Z'),
      retryCount: 0,
      lastError: null,
      processingStartedAt: null,
      createdAt: new Date('2026-06-16T10:00:00.000Z'),
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
      conversationReadCursor: {
        upsert: jest.fn().mockResolvedValue(undefined)
      }
    } as any;
  }

  function createGateway() {
    return {
      emitMessageById: jest.fn().mockResolvedValue(undefined)
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
  const originalEnabled = process.env.MESSAGE_OUTBOX_ENABLED;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://local/test';
    process.env.MESSAGE_OUTBOX_ENABLED = 'false';
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.MESSAGE_OUTBOX_ENABLED = originalEnabled;
  });

  it('should update read cursor and emit message by id', async () => {
    const prisma = createPrisma();
    const gateway = createGateway();
    const consumer = new MessageOutboxConsumer(prisma, gateway);

    await consumer.handleEvent(createEvent() as any);

    expect(prisma.conversationReadCursor.upsert).toHaveBeenCalledWith({
      where: {
        conversationId_userId: {
          conversationId: 18,
          userId: 7
        }
      },
      update: {
        lastReadMessageId: 101,
        lastReadAt: expect.any(Date)
      },
      create: {
        conversationId: 18,
        userId: 7,
        lastReadMessageId: 101,
        lastReadAt: expect.any(Date)
      }
    });
    expect(gateway.emitMessageById).toHaveBeenCalledWith(18, 101);
  });

  it('should claim pending events, process them, and mark them processed', async () => {
    const now = new Date('2026-06-16T10:10:00.000Z');
    const event = createEvent({ id: 7, availableAt: new Date('2026-06-16T10:00:00.000Z') });
    const prisma = createPrisma();
    prisma.outboxEvent.findMany.mockResolvedValue([event]);
    prisma.outboxEvent.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    const gateway = createGateway();
    const consumer = new MessageOutboxConsumer(prisma, gateway);

    const processed = await consumer.pollOnce(now);

    expect(processed).toBe(1);
    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
      where: {
        topic: MESSAGE_OUTBOX_TOPIC,
        status: OutboxEventStatus.PENDING,
        availableAt: { lte: now }
      },
      orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
      take: 20
    });
    expect(prisma.outboxEvent.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        topic: MESSAGE_OUTBOX_TOPIC,
        status: OutboxEventStatus.PROCESSING,
        processingStartedAt: {
          lte: new Date(now.getTime() - MESSAGE_PROCESSING_TIMEOUT_MS)
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
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        status: OutboxEventStatus.PROCESSED,
        processedAt: expect.any(Date),
        processingStartedAt: null,
        lastError: null
      }
    });
    expect(gateway.emitMessageById).toHaveBeenCalledWith(18, 101);
  });

  it('should requeue failed events with incremented retry count', async () => {
    const now = new Date('2026-06-16T10:10:00.000Z');
    const event = createEvent({ id: 9, retryCount: 1 });
    const prisma = createPrisma();
    const gateway = createGateway();
    gateway.emitMessageById.mockRejectedValue(new Error('socket down'));
    const consumer = new MessageOutboxConsumer(prisma, gateway);

    await (consumer as any).handleClaimedEvent(event, now);

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: {
        status: OutboxEventStatus.PENDING,
        retryCount: 2,
        lastError: 'socket down',
        processingStartedAt: null,
        availableAt: expect.any(Date)
      }
    });
  });

  it('should mark terminal failures as failed', async () => {
    const now = new Date('2026-06-16T10:10:00.000Z');
    const event = createEvent({ id: 10, retryCount: MESSAGE_MAX_RETRIES });
    const prisma = createPrisma();
    const gateway = createGateway();
    gateway.emitMessageById.mockRejectedValue(new Error('socket down'));
    const consumer = new MessageOutboxConsumer(prisma, gateway);

    await (consumer as any).handleClaimedEvent(event, now);

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        status: OutboxEventStatus.FAILED,
        retryCount: MESSAGE_MAX_RETRIES + 1,
        lastError: 'socket down',
        processingStartedAt: null,
        availableAt: now
      }
    });
  });

  it('should tolerate schema-not-ready errors when recovering stale events', async () => {
    const now = new Date('2026-06-16T10:10:00.000Z');
    const prisma = createPrisma();
    prisma.outboxEvent.updateMany.mockRejectedValueOnce(createPrismaKnownRequestError('P2021', 'missing OutboxEvent table'));
    const gateway = createGateway();
    const consumer = new MessageOutboxConsumer(prisma, gateway);

    await expect(consumer.pollOnce(now)).resolves.toBe(0);
    expect(prisma.outboxEvent.findMany).not.toHaveBeenCalled();
  });

  it('should tolerate schema-not-ready errors when claiming pending events', async () => {
    const now = new Date('2026-06-16T10:10:00.000Z');
    const prisma = createPrisma();
    prisma.outboxEvent.findMany.mockRejectedValueOnce(createPrismaKnownRequestError('P2021', 'missing OutboxEvent table'));
    const gateway = createGateway();
    const consumer = new MessageOutboxConsumer(prisma, gateway);

    await expect(consumer.pollOnce(now)).resolves.toBe(0);
    expect(prisma.outboxEvent.update).not.toHaveBeenCalled();
  });
});
