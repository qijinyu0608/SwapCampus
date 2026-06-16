import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OutboxEventStatus, Prisma } from '@prisma/client';
import amqp, { Channel, ChannelModel } from 'amqplib';
import { PrismaService } from '../../prisma/prisma.service';
import { GOVERNANCE_OUTBOX_TOPIC, GovernanceOutboxEventRecord, nextGovernanceRetryAt } from '../outbox/outbox.types';
import { getGovernanceRabbitmqConfig } from './governance-rabbitmq.types';

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
export class GovernanceOutboxPublisher implements OnModuleInit {
  private readonly logger = new Logger(GovernanceOutboxPublisher.name);
  private readonly config = getGovernanceRabbitmqConfig();
  private timer: NodeJS.Timeout | null = null;
  private pollInFlight = false;
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (!this.config.enabled || !process.env.DATABASE_URL) {
      return;
    }

    await this.ensureChannel();
    this.scheduleNextPoll(0);
  }

  async pollOnce(now = new Date()) {
    if (!this.config.enabled || this.pollInFlight) {
      return 0;
    }

    this.pollInFlight = true;

    try {
      await this.ensureChannel();
      await this.recoverExpiredProcessingEvents(now);
      const events = await this.claimPendingEvents(now);
      for (const event of events) {
        await this.publishClaimedEvent(event, now);
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

  async publishEvent(event: GovernanceOutboxEventRecord) {
    await this.ensureChannel();
    const payload = Buffer.from(JSON.stringify({
      outboxEventId: event.id,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      createdAt: event.createdAt.toISOString()
    }));

    const published = this.channel!.publish(
      this.config.exchange,
      this.config.routingKey,
      payload,
      {
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        persistent: true,
        messageId: String(event.id),
        type: event.eventType,
        timestamp: event.createdAt.getTime()
      }
    );

    if (!published) {
      throw new Error('governance rabbitmq channel buffer is full');
    }
  }

  private async ensureChannel() {
    if (this.channel) {
      return;
    }

    const connection = await amqp.connect(this.config.url);
    connection.on('close', () => {
      this.channel = null;
      this.connection = null;
    });
    connection.on('error', () => {
      this.channel = null;
      this.connection = null;
    });
    const channel = await connection.createChannel();
    await channel.assertExchange(this.config.exchange, 'direct', { durable: true });
    await channel.assertQueue(this.config.queue, { durable: true });
    await channel.bindQueue(this.config.queue, this.config.exchange, this.config.routingKey);
    this.connection = connection;
    this.channel = channel;
  }

  private scheduleNextPoll(delay = 2_000) {
    if (!this.config.enabled) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      void this.pollOnce().catch((error) => {
        this.logger.error(`Failed to publish governance outbox events: ${toErrorMessage(error)}`);
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
      take: 20
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
    await this.prisma.outboxEvent.updateMany({
      where: {
        topic: GOVERNANCE_OUTBOX_TOPIC,
        status: OutboxEventStatus.PROCESSING,
        processingStartedAt: { lte: new Date(now.getTime() - 60_000) }
      },
      data: {
        status: OutboxEventStatus.PENDING,
        processingStartedAt: null,
        availableAt: now
      }
    });
  }

  private async publishClaimedEvent(event: GovernanceOutboxEventRecord, now: Date) {
    try {
      await this.publishEvent(event);
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
      const terminal = nextRetryCount > 4;
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
      this.logger.warn(`Failed to publish governance outbox event #${event.id}: ${toErrorMessage(error)}`);
      this.channel = null;
      this.connection = null;
    }
  }
}
