import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OutboxAggregateType, OutboxEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import {
  getSearchOutboxConsumerConfig,
  nextSearchRetryAt,
  SEARCH_INDEX_OUTBOX_TOPIC,
  SearchOutboxEventRecord
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

function toSearchOutboxEventRecord(event: {
  id: number;
  topic: string;
  eventType: string;
  aggregateType: OutboxAggregateType;
  aggregateId: number;
  payload: Prisma.JsonValue;
  status: OutboxEventStatus;
  availableAt: Date;
  retryCount: number;
  lastError: string | null;
  processingStartedAt: Date | null;
  createdAt: Date;
  processedAt: Date | null;
}): SearchOutboxEventRecord {
  return {
    ...event,
    eventType: event.eventType as SearchOutboxEventRecord['eventType'],
    payload: event.payload as SearchOutboxEventRecord['payload']
  };
}

@Injectable()
export class SearchIndexOutboxConsumer implements OnModuleInit {
  private readonly logger = new Logger(SearchIndexOutboxConsumer.name);
  private readonly config = getSearchOutboxConsumerConfig();
  private readonly enabled = this.config.enabled;
  private readonly pollIntervalMs = this.config.pollIntervalMs;
  private timer: NodeJS.Timeout | null = null;
  private pollInFlight = false;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SearchService)
    private readonly searchService: SearchService
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
        this.logger.warn(`Search outbox schema is not ready yet: ${toErrorMessage(error)}`);
        return 0;
      }
      throw error;
    } finally {
      this.pollInFlight = false;
      this.scheduleNextPoll();
    }
  }

  async handleEvent(event: SearchOutboxEventRecord) {
    switch (event.eventType) {
      case 'ProductCreated':
      case 'ProductUpdated':
      case 'ProductStatusChanged':
        await this.searchService.syncProduct(event.aggregateId);
        return;
      case 'ProductDeleted':
        await this.searchService.deleteProduct(event.aggregateId);
        return;
      case 'SellerStatusChanged':
      case 'SellerProfileChanged':
        await this.searchService.syncSellerProducts(event.aggregateId);
        return;
      default:
        throw new Error(`Unsupported search outbox event type: ${event.eventType}`);
    }
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
        this.logger.error(`Failed to run scheduled search outbox poll: ${toErrorMessage(error)}`);
      });
    }, Math.max(0, delay));
  }

  private async claimPendingEvents(now: Date) {
    const pending = await this.prisma.outboxEvent.findMany({
      where: {
        topic: SEARCH_INDEX_OUTBOX_TOPIC,
        status: OutboxEventStatus.PENDING,
        availableAt: { lte: now }
      },
      orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
      take: this.config.batchSize
    });

    if (!pending.length) {
      return [];
    }

    const claimed: SearchOutboxEventRecord[] = [];
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
        claimed.push(toSearchOutboxEventRecord({
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
    const recovered = await this.prisma.outboxEvent.updateMany({
      where: {
        topic: SEARCH_INDEX_OUTBOX_TOPIC,
        status: OutboxEventStatus.PROCESSING,
        processingStartedAt: { lte: threshold }
      },
      data: {
        status: OutboxEventStatus.PENDING,
        processingStartedAt: null,
        availableAt: now
      }
    });

    if (recovered.count > 0) {
      this.logger.warn(`Recovered ${recovered.count} stale search outbox events`);
    }
  }

  private async handleClaimedEvent(event: SearchOutboxEventRecord, now: Date) {
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
          availableAt: terminal ? now : nextSearchRetryAt(event.retryCount, now)
        }
      });
      this.logger.warn(`Failed to process search outbox event #${event.id}: ${toErrorMessage(error)}`);
    }
  }
}
