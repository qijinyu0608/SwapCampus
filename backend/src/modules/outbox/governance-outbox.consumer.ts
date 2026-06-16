import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OutboxEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getGovernanceOutboxConsumerConfig,
  GovernanceOutboxEventRecord,
  GOVERNANCE_OUTBOX_TOPIC,
  nextGovernanceRetryAt
} from './outbox.types';

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isSchemaNotReadyError(error: unknown) {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'P2021';
}

function toGovernanceOutboxEventRecord(event: {
  id: number;
  topic: string;
  eventType: string;
  aggregateType: GovernanceOutboxEventRecord['aggregateType'];
  aggregateId: number;
  payload: Prisma.JsonValue;
  status: OutboxEventStatus;
  availableAt: Date;
  retryCount: number;
  lastError: string | null;
  processingStartedAt: Date | null;
  createdAt: Date;
  processedAt: Date | null;
}): GovernanceOutboxEventRecord {
  return {
    ...event,
    eventType: event.eventType as GovernanceOutboxEventRecord['eventType'],
    payload: event.payload as GovernanceOutboxEventRecord['payload']
  };
}

@Injectable()
export class GovernanceOutboxConsumer implements OnModuleInit {
  private readonly logger = new Logger(GovernanceOutboxConsumer.name);
  private readonly config = getGovernanceOutboxConsumerConfig();
  private readonly enabled = this.config.enabled;
  private readonly pollIntervalMs = this.config.pollIntervalMs;
  private timer: NodeJS.Timeout | null = null;
  private pollInFlight = false;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async onModuleInit() {
    if (!this.enabled || !process.env.DATABASE_URL) {
      return;
    }

    this.scheduleNextPoll(0);
  }

  async pollOnce(now = new Date()) {
    if (this.pollInFlight) {
      return 0;
    }

    this.pollInFlight = true;

    try {
      await this.recoverExpiredProcessingEvents(now);
      const events = await this.claimPendingEvents(now);
      for (const event of events) {
        await this.handleClaimedEvent(event, now);
      }
      return events.length;
    } catch (error) {
      if (isSchemaNotReadyError(error)) {
        this.logger.warn(`Governance outbox schema is not ready yet: ${toErrorMessage(error)}`);
        return 0;
      }
      throw error;
    } finally {
      this.pollInFlight = false;
      this.scheduleNextPoll();
    }
  }

  async handleEvent(event: GovernanceOutboxEventRecord) {
    await this.prisma.auditLog.create({
      data: {
        actorId: event.payload.actorId,
        actorName: event.payload.actorName,
        action: event.payload.action,
        targetType: event.payload.targetType,
        targetId: event.payload.targetId,
        detail: event.payload.detail
      }
    });
  }

  private scheduleNextPoll(delay = this.pollIntervalMs) {
    if (!this.enabled) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      void this.pollOnce().catch((error) => {
        this.logger.error(`Failed to run scheduled governance outbox poll: ${toErrorMessage(error)}`);
      });
    }, Math.max(0, delay));
  }

  private async claimPendingEvents(now: Date) {
    const pending = await this.prisma.outboxEvent.findMany({
      where: {
        topic: GOVERNANCE_OUTBOX_TOPIC,
        status: OutboxEventStatus.PENDING,
        availableAt: { lte: now }
      },
      orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
      take: this.config.batchSize
    });

    if (!pending.length) {
      return [];
    }

    const claimed: GovernanceOutboxEventRecord[] = [];
    for (const event of pending) {
      const updated = await this.prisma.outboxEvent.updateMany({
        where: {
          id: event.id,
          status: OutboxEventStatus.PENDING
        },
        data: {
          status: OutboxEventStatus.PROCESSING,
          processingStartedAt: now,
          lastError: null
        }
      });

      if (updated.count === 1) {
        claimed.push(toGovernanceOutboxEventRecord({
          ...event,
          status: OutboxEventStatus.PROCESSING,
          processingStartedAt: now,
          lastError: null
        }));
      }
    }

    return claimed;
  }

  private async recoverExpiredProcessingEvents(now: Date) {
    const threshold = new Date(now.getTime() - this.config.processingTimeoutMs);
    await this.prisma.outboxEvent.updateMany({
      where: {
        topic: GOVERNANCE_OUTBOX_TOPIC,
        status: OutboxEventStatus.PROCESSING,
        processingStartedAt: { lte: threshold }
      },
      data: {
        status: OutboxEventStatus.PENDING,
        processingStartedAt: null,
        availableAt: now
      }
    });
  }

  private async handleClaimedEvent(event: GovernanceOutboxEventRecord, now: Date) {
    try {
      await this.handleEvent(event);
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxEventStatus.PROCESSED,
          processedAt: new Date(),
          processingStartedAt: null,
          lastError: null
        }
      });
    } catch (error) {
      const nextRetryCount = event.retryCount + 1;
      const terminal = nextRetryCount > this.config.maxRetries;
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: terminal ? OutboxEventStatus.FAILED : OutboxEventStatus.PENDING,
          retryCount: nextRetryCount,
          lastError: toErrorMessage(error),
          processingStartedAt: null,
          availableAt: terminal ? now : nextGovernanceRetryAt(event.retryCount, now)
        }
      });
      this.logger.warn(`Failed to process governance outbox event #${event.id}: ${toErrorMessage(error)}`);
    }
  }
}
