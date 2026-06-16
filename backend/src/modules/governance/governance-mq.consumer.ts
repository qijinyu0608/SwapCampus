import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { PrismaService } from '../../prisma/prisma.service';
import { getGovernanceRabbitmqConfig } from './governance-rabbitmq.types';

export type GovernanceAuditMessage = {
  outboxEventId: number;
  eventType: string;
  aggregateType: string;
  aggregateId: number;
  payload: {
    actorId: number | null;
    actorName: string;
    action: string;
    targetType: string;
    targetId: number;
    detail: string;
  };
  createdAt: string;
};

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

@Injectable()
export class GovernanceMqConsumer implements OnModuleInit {
  private readonly logger = new Logger(GovernanceMqConsumer.name);
  private readonly config = getGovernanceRabbitmqConfig();
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (!this.config.enabled || !process.env.DATABASE_URL) {
      return;
    }

    await this.ensureChannel();
    await this.channel!.consume(this.config.queue, (message) => {
      void this.handleDelivery(message).catch((error) => {
        this.logger.error(`Failed to process governance mq message: ${toErrorMessage(error)}`);
      });
    }, { noAck: false });
  }

  async handleMessage(payload: GovernanceAuditMessage) {
    const existing = await this.prisma.auditLog.findFirst({
      where: {
        actorId: payload.payload.actorId,
        action: payload.payload.action,
        targetType: payload.payload.targetType,
        targetId: payload.payload.targetId,
        detail: payload.payload.detail
      }
    });

    if (existing) {
      return;
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: payload.payload.actorId,
        actorName: payload.payload.actorName,
        action: payload.payload.action,
        targetType: payload.payload.targetType,
        targetId: payload.payload.targetId,
        detail: payload.payload.detail
      }
    });
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
    await channel.prefetch(this.config.prefetchCount);
    this.connection = connection;
    this.channel = channel;
  }

  private async handleDelivery(message: ConsumeMessage | null) {
    if (!message) {
      return;
    }

    try {
      const payload = JSON.parse(message.content.toString('utf8')) as GovernanceAuditMessage;
      await this.handleMessage(payload);
      this.channel!.ack(message);
    } catch (error) {
      this.logger.warn(`Governance MQ message failed: ${toErrorMessage(error)}`);
      this.channel!.nack(message, false, false);
    }
  }
}
