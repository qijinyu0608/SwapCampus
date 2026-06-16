import { OutboxAggregateType, OutboxEventStatus } from '@prisma/client';
import { GovernanceOutboxPublisher } from './governance-outbox.publisher';
import { GOVERNANCE_OUTBOX_TOPIC } from '../outbox/outbox.types';

describe('GovernanceOutboxPublisher', () => {
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
      }
    } as any;
  }

  beforeEach(() => {
    process.env.GOVERNANCE_MQ_ENABLED = 'true';
    process.env.DATABASE_URL = 'mysql://local/test';
  });

  it('should mark governance outbox event processed after successful publish', async () => {
    const prisma = createPrisma();
    const publisher = new GovernanceOutboxPublisher(prisma);
    jest.spyOn(publisher as any, 'ensureChannel').mockResolvedValue(undefined);
    (publisher as any).channel = {
      publish: jest.fn().mockReturnValue(true)
    };

    await (publisher as any).publishClaimedEvent(createEvent({ id: 7 }), new Date('2026-06-16T13:10:00.000Z'));

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
});

