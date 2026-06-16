import { OutboxAggregateType, OutboxEventStatus } from '@prisma/client';
import { GovernanceOutboxConsumer } from './governance-outbox.consumer';
import {
  GOVERNANCE_MAX_RETRIES,
  GOVERNANCE_OUTBOX_TOPIC,
  GOVERNANCE_PROCESSING_TIMEOUT_MS
} from './outbox.types';

describe('GovernanceOutboxConsumer', () => {
  function createEvent(overrides: Record<string, any> = {}) {
    return {
      id: 1,
      topic: GOVERNANCE_OUTBOX_TOPIC,
      eventType: 'AuditLogRequested',
      aggregateType: OutboxAggregateType.USER,
      aggregateId: 7,
      payload: {
        actorId: 9,
        actorName: '管理员#9',
        action: 'BAN_USER',
        targetType: 'USER',
        targetId: 7,
        detail: '封禁测试'
      },
      status: OutboxEventStatus.PENDING,
      availableAt: new Date('2026-06-16T13:00:00.000Z'),
      retryCount: 0,
      lastError: null,
      processingStartedAt: null,
      createdAt: new Date('2026-06-16T13:00:00.000Z'),
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
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined)
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
  const originalEnabled = process.env.GOVERNANCE_OUTBOX_ENABLED;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://local/test';
    process.env.GOVERNANCE_OUTBOX_ENABLED = 'false';
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.GOVERNANCE_OUTBOX_ENABLED = originalEnabled;
  });

  it('should create audit log from governance event payload', async () => {
    const prisma = createPrisma();
    const consumer = new GovernanceOutboxConsumer(prisma);

    await consumer.handleEvent(createEvent() as any);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 9,
        actorName: '管理员#9',
        action: 'BAN_USER',
        targetType: 'USER',
        targetId: 7,
        detail: '封禁测试'
      }
    });
  });

  it('should claim pending events, process them, and mark them processed', async () => {
    const now = new Date('2026-06-16T13:10:00.000Z');
    const event = createEvent({ id: 7, availableAt: new Date('2026-06-16T13:00:00.000Z') });
    const prisma = createPrisma();
    prisma.outboxEvent.findMany.mockResolvedValue([event]);
    prisma.outboxEvent.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    const consumer = new GovernanceOutboxConsumer(prisma);

    const processed = await consumer.pollOnce(now);

    expect(processed).toBe(1);
    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
      where: {
        topic: GOVERNANCE_OUTBOX_TOPIC,
        status: OutboxEventStatus.PENDING,
        availableAt: { lte: now }
      },
      orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
      take: 20
    });
    expect(prisma.outboxEvent.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        topic: GOVERNANCE_OUTBOX_TOPIC,
        status: OutboxEventStatus.PROCESSING,
        processingStartedAt: {
          lte: new Date(now.getTime() - GOVERNANCE_PROCESSING_TIMEOUT_MS)
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
    const now = new Date('2026-06-16T13:10:00.000Z');
    const event = createEvent({ id: 9, retryCount: 1 });
    const prisma = createPrisma();
    prisma.auditLog.create.mockRejectedValue(new Error('audit table locked'));
    const consumer = new GovernanceOutboxConsumer(prisma);

    await (consumer as any).handleClaimedEvent(event, now);

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: {
        status: OutboxEventStatus.PENDING,
        retryCount: 2,
        lastError: 'audit table locked',
        processingStartedAt: null,
        availableAt: expect.any(Date)
      }
    });
  });

  it('should mark terminal failures as failed', async () => {
    const now = new Date('2026-06-16T13:10:00.000Z');
    const event = createEvent({ id: 10, retryCount: GOVERNANCE_MAX_RETRIES });
    const prisma = createPrisma();
    prisma.auditLog.create.mockRejectedValue(new Error('audit table locked'));
    const consumer = new GovernanceOutboxConsumer(prisma);

    await (consumer as any).handleClaimedEvent(event, now);

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        status: OutboxEventStatus.FAILED,
        retryCount: GOVERNANCE_MAX_RETRIES + 1,
        lastError: 'audit table locked',
        processingStartedAt: null,
        availableAt: now
      }
    });
  });

  it('should tolerate schema-not-ready errors when recovering stale events', async () => {
    const now = new Date('2026-06-16T13:10:00.000Z');
    const prisma = createPrisma();
    prisma.outboxEvent.updateMany.mockRejectedValueOnce(createPrismaKnownRequestError('P2021', 'missing OutboxEvent table'));
    const consumer = new GovernanceOutboxConsumer(prisma);

    await expect(consumer.pollOnce(now)).resolves.toBe(0);
    expect(prisma.outboxEvent.findMany).not.toHaveBeenCalled();
  });

  it('should tolerate schema-not-ready errors when claiming pending events', async () => {
    const now = new Date('2026-06-16T13:10:00.000Z');
    const prisma = createPrisma();
    prisma.outboxEvent.findMany.mockRejectedValueOnce(createPrismaKnownRequestError('P2021', 'missing OutboxEvent table'));
    const consumer = new GovernanceOutboxConsumer(prisma);

    await expect(consumer.pollOnce(now)).resolves.toBe(0);
    expect(prisma.outboxEvent.update).not.toHaveBeenCalled();
  });
});
