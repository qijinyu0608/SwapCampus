import { OutboxAggregateType, OutboxEventStatus, Prisma } from '@prisma/client';

export const SEARCH_INDEX_OUTBOX_TOPIC = 'search.index';
export const COMMERCE_SYNC_OUTBOX_TOPIC = 'commerce.sync';
export const SEARCH_INDEX_RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 5 * 60_000, 15 * 60_000] as const;
export const SEARCH_INDEX_MAX_RETRIES = SEARCH_INDEX_RETRY_DELAYS_MS.length;
export const SEARCH_INDEX_PROCESSING_TIMEOUT_MS = 2 * 60_000;
export const SEARCH_INDEX_BATCH_SIZE = 20;
export const COMMERCE_SYNC_RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 5 * 60_000, 15 * 60_000] as const;
export const COMMERCE_SYNC_MAX_RETRIES = COMMERCE_SYNC_RETRY_DELAYS_MS.length;
export const COMMERCE_SYNC_PROCESSING_TIMEOUT_MS = 2 * 60_000;
export const COMMERCE_SYNC_BATCH_SIZE = 20;

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
  'OrderCreated',
  'OrderCanceled',
  'OrderCompleted',
  'UserRegisteredForCommerce'
] as const;

export type CommerceSyncEventType = (typeof commerceSyncEventTypes)[number];

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

export type PublishOutboxEventInput = {
  topic: string;
  eventType: SearchEventType | CommerceSyncEventType;
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
  eventType: Extract<CommerceSyncEventType, 'ProductPublished'>;
  availableAt?: Date;
};

export type PublishOrderCommerceSyncEventInput = {
  orderId: number;
  eventType: Extract<CommerceSyncEventType, 'OrderCreated' | 'OrderCanceled' | 'OrderCompleted'>;
  availableAt?: Date;
};

export type PublishUserCommerceSyncEventInput = {
  userId: number;
  eventType: Extract<CommerceSyncEventType, 'UserRegisteredForCommerce'>;
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

export function nextSearchRetryAt(retryCount: number, now = new Date()) {
  const delay = SEARCH_INDEX_RETRY_DELAYS_MS[Math.min(retryCount, SEARCH_INDEX_RETRY_DELAYS_MS.length - 1)];
  return new Date(now.getTime() + delay);
}

export function nextCommerceRetryAt(retryCount: number, now = new Date()) {
  const delay = COMMERCE_SYNC_RETRY_DELAYS_MS[Math.min(retryCount, COMMERCE_SYNC_RETRY_DELAYS_MS.length - 1)];
  return new Date(now.getTime() + delay);
}
