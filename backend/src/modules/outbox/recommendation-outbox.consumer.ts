import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OutboxEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getRecommendationOutboxConsumerConfig,
  nextRecommendationRetryAt,
  RecommendationOutboxEventRecord,
  RECOMMENDATION_OUTBOX_TOPIC
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

function toRecommendationOutboxEventRecord(event: {
  id: number;
  topic: string;
  eventType: string;
  aggregateType: RecommendationOutboxEventRecord['aggregateType'];
  aggregateId: number;
  payload: Prisma.JsonValue;
  status: OutboxEventStatus;
  availableAt: Date;
  retryCount: number;
  lastError: string | null;
  processingStartedAt: Date | null;
  createdAt: Date;
  processedAt: Date | null;
}): RecommendationOutboxEventRecord {
  return {
    ...event,
    eventType: event.eventType as RecommendationOutboxEventRecord['eventType'],
    payload: event.payload as RecommendationOutboxEventRecord['payload']
  };
}

@Injectable()
export class RecommendationOutboxConsumer implements OnModuleInit {
  private readonly logger = new Logger(RecommendationOutboxConsumer.name);
  private readonly config = getRecommendationOutboxConsumerConfig();
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
        this.logger.warn(`Recommendation outbox schema is not ready yet: ${toErrorMessage(error)}`);
        return 0;
      }
      throw error;
    } finally {
      this.pollInFlight = false;
      this.scheduleNextPoll();
    }
  }

  async handleEvent(event: RecommendationOutboxEventRecord) {
    const profileClient = this.prisma as PrismaService & {
      recommendationProfile?: {
        upsert: (args: {
          where: { userId: number };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => Promise<unknown>;
      };
    };

    if (typeof profileClient.recommendationProfile?.upsert !== 'function') {
      return;
    }

    const baseUpdate: Record<string, unknown> = {
      lastBehaviorAt: event.payload.occurredAt ? new Date(event.payload.occurredAt) : new Date()
    };

    const createData: Record<string, unknown> = {
      userId: event.payload.userId,
      lastBehaviorAt: event.payload.occurredAt ? new Date(event.payload.occurredAt) : new Date()
    };

    switch (event.payload.action) {
      case 'VIEW':
        baseUpdate.viewCount = { increment: 1 };
        createData.viewCount = 1;
        break;
      case 'CONTACT':
        baseUpdate.contactCount = { increment: 1 };
        createData.contactCount = 1;
        break;
      case 'FAVORITE':
        baseUpdate.favoriteCount = { increment: 1 };
        createData.favoriteCount = 1;
        break;
      case 'UNFAVORITE':
        baseUpdate.favoriteCount = { decrement: 1 };
        createData.favoriteCount = 0;
        break;
      case 'ORDER_COMPLETED':
        baseUpdate.orderCount = { increment: 1 };
        createData.orderCount = 1;
        break;
      default:
        return;
    }

    await profileClient.recommendationProfile.upsert({
      where: { userId: event.payload.userId },
      create: createData,
      update: baseUpdate
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
        this.logger.error(`Failed to run scheduled recommendation outbox poll: ${toErrorMessage(error)}`);
      });
    }, Math.max(0, delay));
  }

  private async claimPendingEvents(now: Date) {
    const pending = await this.prisma.outboxEvent.findMany({
      where: {
        topic: RECOMMENDATION_OUTBOX_TOPIC,
        status: OutboxEventStatus.PENDING,
        availableAt: { lte: now }
      },
      orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
      take: this.config.batchSize
    });

    if (!pending.length) {
      return [];
    }

    const claimed: RecommendationOutboxEventRecord[] = [];
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
        claimed.push(toRecommendationOutboxEventRecord({
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
        topic: RECOMMENDATION_OUTBOX_TOPIC,
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

  private async handleClaimedEvent(event: RecommendationOutboxEventRecord, now: Date) {
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
          availableAt: terminal ? now : nextRecommendationRetryAt(event.retryCount, now)
        }
      });
      this.logger.warn(`Failed to process recommendation outbox event #${event.id}: ${toErrorMessage(error)}`);
    }
  }
}
