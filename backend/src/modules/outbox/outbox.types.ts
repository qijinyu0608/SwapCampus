import { OutboxAggregateType, OutboxEventStatus, Prisma } from '@prisma/client';

export const SEARCH_INDEX_OUTBOX_TOPIC = 'search.index';
export const COMMERCE_SYNC_OUTBOX_TOPIC = 'commerce.sync';
export const MESSAGE_OUTBOX_TOPIC = 'message.lifecycle';
export const RECOMMENDATION_OUTBOX_TOPIC = 'recommendation.behavior';
export const GOVERNANCE_OUTBOX_TOPIC = 'governance.audit';
export const SEARCH_INDEX_RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 5 * 60_000, 15 * 60_000] as const;
export const SEARCH_INDEX_MAX_RETRIES = SEARCH_INDEX_RETRY_DELAYS_MS.length;
export const SEARCH_INDEX_PROCESSING_TIMEOUT_MS = 2 * 60_000;
export const SEARCH_INDEX_BATCH_SIZE = 20;
export const COMMERCE_SYNC_RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 5 * 60_000, 15 * 60_000] as const;
export const COMMERCE_SYNC_MAX_RETRIES = COMMERCE_SYNC_RETRY_DELAYS_MS.length;
export const COMMERCE_SYNC_PROCESSING_TIMEOUT_MS = 2 * 60_000;
export const COMMERCE_SYNC_BATCH_SIZE = 20;
export const MESSAGE_RETRY_DELAYS_MS = [3_000, 10_000, 30_000, 2 * 60_000] as const;
export const MESSAGE_MAX_RETRIES = MESSAGE_RETRY_DELAYS_MS.length;
export const MESSAGE_PROCESSING_TIMEOUT_MS = 60_000;
export const MESSAGE_BATCH_SIZE = 20;
export const RECOMMENDATION_RETRY_DELAYS_MS = [3_000, 10_000, 30_000, 2 * 60_000] as const;
export const RECOMMENDATION_MAX_RETRIES = RECOMMENDATION_RETRY_DELAYS_MS.length;
export const RECOMMENDATION_PROCESSING_TIMEOUT_MS = 60_000;
export const RECOMMENDATION_BATCH_SIZE = 30;
export const GOVERNANCE_RETRY_DELAYS_MS = [3_000, 10_000, 30_000, 2 * 60_000] as const;
export const GOVERNANCE_MAX_RETRIES = GOVERNANCE_RETRY_DELAYS_MS.length;
export const GOVERNANCE_PROCESSING_TIMEOUT_MS = 60_000;
export const GOVERNANCE_BATCH_SIZE = 20;

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toRetryDelays(rawValue: string | undefined, fallback: readonly number[]) {
  if (!rawValue?.trim()) {
    return [...fallback];
  }

  const parsed = rawValue
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item >= 0);

  return parsed.length ? parsed : [...fallback];
}

export type OutboxConsumerConfig = {
  enabled: boolean;
  pollIntervalMs: number;
  batchSize: number;
  processingTimeoutMs: number;
  retryDelaysMs: number[];
  maxRetries: number;
};

export function getSearchOutboxConsumerConfig(env: NodeJS.ProcessEnv = process.env): OutboxConsumerConfig {
  const retryDelaysMs = toRetryDelays(env.SEARCH_INDEX_OUTBOX_RETRY_DELAYS_MS, SEARCH_INDEX_RETRY_DELAYS_MS);
  return {
    enabled: env.SEARCH_INDEX_OUTBOX_ENABLED !== 'false',
    pollIntervalMs: toPositiveInt(env.SEARCH_INDEX_OUTBOX_POLL_MS, 3_000),
    batchSize: toPositiveInt(env.SEARCH_INDEX_OUTBOX_BATCH_SIZE, SEARCH_INDEX_BATCH_SIZE),
    processingTimeoutMs: toPositiveInt(env.SEARCH_INDEX_OUTBOX_PROCESSING_TIMEOUT_MS, SEARCH_INDEX_PROCESSING_TIMEOUT_MS),
    retryDelaysMs,
    maxRetries: retryDelaysMs.length
  };
}

export function getCommerceOutboxConsumerConfig(env: NodeJS.ProcessEnv = process.env): OutboxConsumerConfig {
  const retryDelaysMs = toRetryDelays(env.COMMERCE_SYNC_OUTBOX_RETRY_DELAYS_MS, COMMERCE_SYNC_RETRY_DELAYS_MS);
  return {
    enabled: env.COMMERCE_SYNC_ENABLED !== 'false',
    pollIntervalMs: toPositiveInt(env.COMMERCE_SYNC_OUTBOX_POLL_MS, 3_000),
    batchSize: toPositiveInt(env.COMMERCE_SYNC_OUTBOX_BATCH_SIZE, COMMERCE_SYNC_BATCH_SIZE),
    processingTimeoutMs: toPositiveInt(env.COMMERCE_SYNC_OUTBOX_PROCESSING_TIMEOUT_MS, COMMERCE_SYNC_PROCESSING_TIMEOUT_MS),
    retryDelaysMs,
    maxRetries: retryDelaysMs.length
  };
}

export function getMessageOutboxConsumerConfig(env: NodeJS.ProcessEnv = process.env): OutboxConsumerConfig {
  const retryDelaysMs = toRetryDelays(env.MESSAGE_OUTBOX_RETRY_DELAYS_MS, MESSAGE_RETRY_DELAYS_MS);
  return {
    enabled: env.MESSAGE_OUTBOX_ENABLED !== 'false',
    pollIntervalMs: toPositiveInt(env.MESSAGE_OUTBOX_POLL_MS, 2_000),
    batchSize: toPositiveInt(env.MESSAGE_OUTBOX_BATCH_SIZE, MESSAGE_BATCH_SIZE),
    processingTimeoutMs: toPositiveInt(env.MESSAGE_OUTBOX_PROCESSING_TIMEOUT_MS, MESSAGE_PROCESSING_TIMEOUT_MS),
    retryDelaysMs,
    maxRetries: retryDelaysMs.length
  };
}

export function getRecommendationOutboxConsumerConfig(env: NodeJS.ProcessEnv = process.env): OutboxConsumerConfig {
  const retryDelaysMs = toRetryDelays(env.RECOMMENDATION_OUTBOX_RETRY_DELAYS_MS, RECOMMENDATION_RETRY_DELAYS_MS);
  return {
    enabled: env.RECOMMENDATION_OUTBOX_ENABLED !== 'false',
    pollIntervalMs: toPositiveInt(env.RECOMMENDATION_OUTBOX_POLL_MS, 2_000),
    batchSize: toPositiveInt(env.RECOMMENDATION_OUTBOX_BATCH_SIZE, RECOMMENDATION_BATCH_SIZE),
    processingTimeoutMs: toPositiveInt(env.RECOMMENDATION_OUTBOX_PROCESSING_TIMEOUT_MS, RECOMMENDATION_PROCESSING_TIMEOUT_MS),
    retryDelaysMs,
    maxRetries: retryDelaysMs.length
  };
}

export function getGovernanceOutboxConsumerConfig(env: NodeJS.ProcessEnv = process.env): OutboxConsumerConfig {
  const retryDelaysMs = toRetryDelays(env.GOVERNANCE_OUTBOX_RETRY_DELAYS_MS, GOVERNANCE_RETRY_DELAYS_MS);
  return {
    enabled: env.GOVERNANCE_OUTBOX_ENABLED !== 'false',
    pollIntervalMs: toPositiveInt(env.GOVERNANCE_OUTBOX_POLL_MS, 2_000),
    batchSize: toPositiveInt(env.GOVERNANCE_OUTBOX_BATCH_SIZE, GOVERNANCE_BATCH_SIZE),
    processingTimeoutMs: toPositiveInt(env.GOVERNANCE_OUTBOX_PROCESSING_TIMEOUT_MS, GOVERNANCE_PROCESSING_TIMEOUT_MS),
    retryDelaysMs,
    maxRetries: retryDelaysMs.length
  };
}

export const searchEventTypes = [
  'ProductCreated',
  'ProductUpdated',
  'ProductStatusChanged',
  'ProductDeleted',
  'SellerStatusChanged',
  'SellerProfileChanged'
] as const;

export type SearchEventType = (typeof searchEventTypes)[number];

export const commerceSyncEventTypes = [
  'ProductPublished',
  'ProductAvailabilityChanged',
  'ProductInventoryChanged',
  'OrderCreated',
  'OrderCanceled',
  'OrderCompleted',
  'OrderPaymentSettled',
  'OrderFulfillmentCompleted',
  'UserRegisteredForCommerce'
] as const;

export type CommerceSyncEventType = (typeof commerceSyncEventTypes)[number];

export const messageEventTypes = [
  'MessageSent'
] as const;

export type MessageEventType = (typeof messageEventTypes)[number];

export const recommendationEventTypes = [
  'BehaviorTracked',
  'FavoriteChanged',
  'OrderCompleted'
] as const;

export type RecommendationEventType = (typeof recommendationEventTypes)[number];

export const governanceEventTypes = [
  'AuditLogRequested'
] as const;

export type GovernanceEventType = (typeof governanceEventTypes)[number];

export type SearchEventReason =
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'ORDER_RESERVED'
  | 'ORDER_CANCELED'
  | 'ORDER_COMPLETED'
  | 'ORDER_AUTO_COMPLETED'
  | 'ADMIN_PRODUCT_STATUS_CHANGED'
  | 'ADMIN_ORDER_CANCELED'
  | 'REPORT_PRODUCT_OFFLINE'
  | 'REPORT_USER_BANNED'
  | 'REPORT_USER_UNBANNED'
  | 'USER_BANNED'
  | 'USER_UNBANNED'
  | 'USER_PROFILE_UPDATED'
  | 'USER_VERIFICATION_CHANGED'
  | 'ORDER_APPEAL_RESOLVED'
  | 'ORDER_APPEAL_BANNED'
  | 'ORDER_APPEAL_UNBANNED';

export type ProductSearchEventPayload = {
  productId: number;
  changedBy: string;
  reason: SearchEventReason;
};

export type SellerSearchEventPayload = {
  sellerId: number;
  changedBy: string;
  reason: SearchEventReason;
};

export type SearchOutboxPayload = ProductSearchEventPayload | SellerSearchEventPayload;

export type ProductCommerceSyncPayload = {
  productId: number;
};

export type OrderCommerceSyncPayload = {
  orderId: number;
};

export type UserCommerceSyncPayload = {
  userId: number;
};

export type CommerceSyncOutboxPayload =
  | ProductCommerceSyncPayload
  | OrderCommerceSyncPayload
  | UserCommerceSyncPayload;

export type MessageOutboxPayload = {
  conversationId: number;
  messageId: number;
  senderId: number;
  type: string;
};

export type RecommendationBehaviorAction =
  | 'VIEW'
  | 'CONTACT'
  | 'FAVORITE'
  | 'UNFAVORITE'
  | 'ORDER_COMPLETED';

export type RecommendationOutboxPayload = {
  userId: number;
  productId?: number;
  action: RecommendationBehaviorAction;
  occurredAt?: string;
};

export type GovernanceOutboxPayload = {
  actorId: number | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId: number;
  detail: string;
};

export type PublishOutboxEventInput = {
  topic: string;
  eventType: SearchEventType | CommerceSyncEventType | MessageEventType | RecommendationEventType | GovernanceEventType;
  aggregateType: OutboxAggregateType;
  aggregateId: number;
  payload: Prisma.InputJsonValue;
  availableAt?: Date;
};

export type PublishProductSearchEventInput = {
  productId: number;
  eventType: Extract<SearchEventType, 'ProductCreated' | 'ProductUpdated' | 'ProductStatusChanged' | 'ProductDeleted'>;
  changedBy: string;
  reason: SearchEventReason;
  availableAt?: Date;
};

export type PublishSellerSearchEventInput = {
  sellerId: number;
  eventType: Extract<SearchEventType, 'SellerStatusChanged' | 'SellerProfileChanged'>;
  changedBy: string;
  reason: SearchEventReason;
  availableAt?: Date;
};

export type PublishProductCommerceSyncEventInput = {
  productId: number;
  eventType: Extract<CommerceSyncEventType, 'ProductPublished' | 'ProductAvailabilityChanged' | 'ProductInventoryChanged'>;
  availableAt?: Date;
};

export type PublishOrderCommerceSyncEventInput = {
  orderId: number;
  eventType: Extract<
    CommerceSyncEventType,
    'OrderCreated' | 'OrderCanceled' | 'OrderCompleted' | 'OrderPaymentSettled' | 'OrderFulfillmentCompleted'
  >;
  availableAt?: Date;
};

export type PublishUserCommerceSyncEventInput = {
  userId: number;
  eventType: Extract<CommerceSyncEventType, 'UserRegisteredForCommerce'>;
  availableAt?: Date;
};

export type PublishMessageEventInput = {
  conversationId: number;
  messageId: number;
  senderId: number;
  type: string;
  availableAt?: Date;
};

export type PublishRecommendationEventInput = {
  userId: number;
  productId?: number;
  eventType: RecommendationEventType;
  action: RecommendationBehaviorAction;
  occurredAt?: Date;
  availableAt?: Date;
};

export type PublishGovernanceEventInput = GovernanceOutboxPayload & {
  aggregateType: OutboxAggregateType;
  aggregateId: number;
  availableAt?: Date;
};

export type OutboxTransactionClient = Pick<Prisma.TransactionClient, 'outboxEvent'>;

export type SearchOutboxEventRecord = {
  id: number;
  topic: string;
  eventType: SearchEventType;
  aggregateType: OutboxAggregateType;
  aggregateId: number;
  payload: SearchOutboxPayload;
  status: OutboxEventStatus;
  availableAt: Date;
  retryCount: number;
  lastError: string | null;
  processingStartedAt: Date | null;
  createdAt: Date;
  processedAt: Date | null;
};

export type CommerceSyncOutboxEventRecord = {
  id: number;
  topic: string;
  eventType: CommerceSyncEventType;
  aggregateType: OutboxAggregateType;
  aggregateId: number;
  payload: CommerceSyncOutboxPayload;
  status: OutboxEventStatus;
  availableAt: Date;
  retryCount: number;
  lastError: string | null;
  processingStartedAt: Date | null;
  createdAt: Date;
  processedAt: Date | null;
};

export type MessageOutboxEventRecord = {
  id: number;
  topic: string;
  eventType: MessageEventType;
  aggregateType: OutboxAggregateType;
  aggregateId: number;
  payload: MessageOutboxPayload;
  status: OutboxEventStatus;
  availableAt: Date;
  retryCount: number;
  lastError: string | null;
  processingStartedAt: Date | null;
  createdAt: Date;
  processedAt: Date | null;
};

export type RecommendationOutboxEventRecord = {
  id: number;
  topic: string;
  eventType: RecommendationEventType;
  aggregateType: OutboxAggregateType;
  aggregateId: number;
  payload: RecommendationOutboxPayload;
  status: OutboxEventStatus;
  availableAt: Date;
  retryCount: number;
  lastError: string | null;
  processingStartedAt: Date | null;
  createdAt: Date;
  processedAt: Date | null;
};

export type GovernanceOutboxEventRecord = {
  id: number;
  topic: string;
  eventType: GovernanceEventType;
  aggregateType: OutboxAggregateType;
  aggregateId: number;
  payload: GovernanceOutboxPayload;
  status: OutboxEventStatus;
  availableAt: Date;
  retryCount: number;
  lastError: string | null;
  processingStartedAt: Date | null;
  createdAt: Date;
  processedAt: Date | null;
};

export function nextSearchRetryAt(retryCount: number, now = new Date()) {
  const config = getSearchOutboxConsumerConfig();
  const delay = config.retryDelaysMs[Math.min(retryCount, config.retryDelaysMs.length - 1)];
  return new Date(now.getTime() + delay);
}

export function nextCommerceRetryAt(retryCount: number, now = new Date()) {
  const config = getCommerceOutboxConsumerConfig();
  const delay = config.retryDelaysMs[Math.min(retryCount, config.retryDelaysMs.length - 1)];
  return new Date(now.getTime() + delay);
}

export function nextMessageRetryAt(retryCount: number, now = new Date()) {
  const config = getMessageOutboxConsumerConfig();
  const delay = config.retryDelaysMs[Math.min(retryCount, config.retryDelaysMs.length - 1)];
  return new Date(now.getTime() + delay);
}

export function nextRecommendationRetryAt(retryCount: number, now = new Date()) {
  const config = getRecommendationOutboxConsumerConfig();
  const delay = config.retryDelaysMs[Math.min(retryCount, config.retryDelaysMs.length - 1)];
  return new Date(now.getTime() + delay);
}

export function nextGovernanceRetryAt(retryCount: number, now = new Date()) {
  const config = getGovernanceOutboxConsumerConfig();
  const delay = config.retryDelaysMs[Math.min(retryCount, config.retryDelaysMs.length - 1)];
  return new Date(now.getTime() + delay);
}
