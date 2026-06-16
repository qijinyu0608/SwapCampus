import { Inject, Injectable } from '@nestjs/common';
import { OutboxAggregateType, OutboxEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  COMMERCE_SYNC_OUTBOX_TOPIC,
  GOVERNANCE_OUTBOX_TOPIC,
  MESSAGE_OUTBOX_TOPIC,
  OutboxTransactionClient,
  PublishOutboxEventInput,
  PublishGovernanceEventInput,
  PublishMessageEventInput,
  PublishOrderCommerceSyncEventInput,
  PublishProductCommerceSyncEventInput,
  PublishProductSearchEventInput,
  PublishRecommendationEventInput,
  PublishSellerSearchEventInput,
  PublishUserCommerceSyncEventInput,
  RECOMMENDATION_OUTBOX_TOPIC,
  SEARCH_INDEX_OUTBOX_TOPIC
} from './outbox.types';

type OutboxClient = Pick<PrismaService, 'outboxEvent'> | OutboxTransactionClient;

@Injectable()
export class OutboxService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async publishEvent(input: PublishOutboxEventInput, tx?: OutboxTransactionClient) {
    return this.getClient(tx).outboxEvent.create({
      data: {
        topic: input.topic,
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payload: input.payload,
        status: OutboxEventStatus.PENDING,
        availableAt: input.availableAt ?? new Date()
      }
    });
  }

  async publishProductSearchEvent(input: PublishProductSearchEventInput, tx?: OutboxTransactionClient) {
    return this.publishEvent({
      topic: SEARCH_INDEX_OUTBOX_TOPIC,
      eventType: input.eventType,
      aggregateType: OutboxAggregateType.PRODUCT,
      aggregateId: input.productId,
      payload: {
        productId: input.productId,
        changedBy: input.changedBy,
        reason: input.reason
      } satisfies Prisma.InputJsonObject,
      availableAt: input.availableAt
    }, tx);
  }

  async publishSellerSearchEvent(input: PublishSellerSearchEventInput, tx?: OutboxTransactionClient) {
    return this.publishEvent({
      topic: SEARCH_INDEX_OUTBOX_TOPIC,
      eventType: input.eventType,
      aggregateType: OutboxAggregateType.USER,
      aggregateId: input.sellerId,
      payload: {
        sellerId: input.sellerId,
        changedBy: input.changedBy,
        reason: input.reason
      } satisfies Prisma.InputJsonObject,
      availableAt: input.availableAt
    }, tx);
  }

  async publishProductCommerceSyncEvent(input: PublishProductCommerceSyncEventInput, tx?: OutboxTransactionClient) {
    return this.publishEvent({
      topic: COMMERCE_SYNC_OUTBOX_TOPIC,
      eventType: input.eventType,
      aggregateType: OutboxAggregateType.PRODUCT,
      aggregateId: input.productId,
      payload: {
        productId: input.productId
      } satisfies Prisma.InputJsonObject,
      availableAt: input.availableAt
    }, tx);
  }

  async publishProductInventorySyncEvent(input: PublishProductCommerceSyncEventInput, tx?: OutboxTransactionClient) {
    return this.publishProductCommerceSyncEvent(input, tx);
  }

  async publishOrderCommerceSyncEvent(input: PublishOrderCommerceSyncEventInput, tx?: OutboxTransactionClient) {
    return this.publishEvent({
      topic: COMMERCE_SYNC_OUTBOX_TOPIC,
      eventType: input.eventType,
      aggregateType: OutboxAggregateType.ORDER,
      aggregateId: input.orderId,
      payload: {
        orderId: input.orderId
      } satisfies Prisma.InputJsonObject,
      availableAt: input.availableAt
    }, tx);
  }

  async publishOrderPaymentSettledEvent(input: Omit<PublishOrderCommerceSyncEventInput, 'eventType'>, tx?: OutboxTransactionClient) {
    return this.publishOrderCommerceSyncEvent({
      ...input,
      eventType: 'OrderPaymentSettled'
    }, tx);
  }

  async publishOrderFulfillmentCompletedEvent(input: Omit<PublishOrderCommerceSyncEventInput, 'eventType'>, tx?: OutboxTransactionClient) {
    return this.publishOrderCommerceSyncEvent({
      ...input,
      eventType: 'OrderFulfillmentCompleted'
    }, tx);
  }

  async publishUserCommerceSyncEvent(input: PublishUserCommerceSyncEventInput, tx?: OutboxTransactionClient) {
    return this.publishEvent({
      topic: COMMERCE_SYNC_OUTBOX_TOPIC,
      eventType: input.eventType,
      aggregateType: OutboxAggregateType.USER,
      aggregateId: input.userId,
      payload: {
        userId: input.userId
      } satisfies Prisma.InputJsonObject,
      availableAt: input.availableAt
    }, tx);
  }

  async publishMessageEvent(input: PublishMessageEventInput, tx?: OutboxTransactionClient) {
    return this.publishEvent({
      topic: MESSAGE_OUTBOX_TOPIC,
      eventType: 'MessageSent',
      aggregateType: OutboxAggregateType.CONVERSATION,
      aggregateId: input.conversationId,
      payload: {
        conversationId: input.conversationId,
        messageId: input.messageId,
        senderId: input.senderId,
        type: input.type
      } satisfies Prisma.InputJsonObject,
      availableAt: input.availableAt
    }, tx);
  }

  async publishRecommendationEvent(input: PublishRecommendationEventInput, tx?: OutboxTransactionClient) {
    return this.publishEvent({
      topic: RECOMMENDATION_OUTBOX_TOPIC,
      eventType: input.eventType,
      aggregateType: OutboxAggregateType.USER,
      aggregateId: input.userId,
      payload: {
        userId: input.userId,
        productId: input.productId,
        action: input.action,
        occurredAt: (input.occurredAt ?? new Date()).toISOString()
      } satisfies Prisma.InputJsonObject,
      availableAt: input.availableAt
    }, tx);
  }

  async publishGovernanceEvent(input: PublishGovernanceEventInput, tx?: OutboxTransactionClient) {
    return this.publishEvent({
      topic: GOVERNANCE_OUTBOX_TOPIC,
      eventType: 'AuditLogRequested',
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: {
        actorId: input.actorId,
        actorName: input.actorName,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        detail: input.detail
      } satisfies Prisma.InputJsonObject,
      availableAt: input.availableAt
    }, tx);
  }

  private getClient(tx?: OutboxTransactionClient): OutboxClient {
    return tx ?? this.prisma;
  }
}
