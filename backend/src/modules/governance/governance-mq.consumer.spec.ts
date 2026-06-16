import { GovernanceMqConsumer } from './governance-mq.consumer';

describe('GovernanceMqConsumer', () => {
  function createPrisma() {
    return {
      auditLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;
  }

  beforeEach(() => {
    process.env.GOVERNANCE_MQ_ENABLED = 'true';
    process.env.DATABASE_URL = 'mysql://local/test';
  });

  it('should create audit log when message is not duplicated', async () => {
    const prisma = createPrisma();
    const consumer = new GovernanceMqConsumer(prisma);

    await consumer.handleMessage({
      outboxEventId: 1,
      eventType: 'AuditLogRequested',
      aggregateType: 'USER',
      aggregateId: 7,
      payload: {
        actorId: 9,
        actorName: '管理员#9',
        action: 'BAN_USER',
        targetType: 'USER',
        targetId: 7,
        detail: '封禁测试'
      },
      createdAt: '2026-06-16T13:00:00.000Z'
    });

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

  it('should skip duplicate audit log message', async () => {
    const prisma = createPrisma();
    prisma.auditLog.findFirst.mockResolvedValue({ id: 3 });
    const consumer = new GovernanceMqConsumer(prisma);

    await consumer.handleMessage({
      outboxEventId: 1,
      eventType: 'AuditLogRequested',
      aggregateType: 'USER',
      aggregateId: 7,
      payload: {
        actorId: 9,
        actorName: '管理员#9',
        action: 'BAN_USER',
        targetType: 'USER',
        targetId: 7,
        detail: '封禁测试'
      },
      createdAt: '2026-06-16T13:00:00.000Z'
    });

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

