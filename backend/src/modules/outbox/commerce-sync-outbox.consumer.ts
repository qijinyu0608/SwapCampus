import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OutboxEventStatus, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VendureService } from '../vendure/vendure.service';
import {
  getCommerceOutboxConsumerConfig,
  COMMERCE_SYNC_OUTBOX_TOPIC,
  CommerceSyncOutboxEventRecord,
  nextCommerceRetryAt
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

function toPositiveInt(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function toCommerceSyncOutboxEventRecord(event: {
  id: number;
  topic: string;
  eventType: string;
  aggregateType: CommerceSyncOutboxEventRecord['aggregateType'];
  aggregateId: number;
  payload: Prisma.JsonValue;
  status: OutboxEventStatus;
  availableAt: Date;
  retryCount: number;
  lastError: string | null;
  processingStartedAt: Date | null;
  createdAt: Date;
  processedAt: Date | null;
}): CommerceSyncOutboxEventRecord {
  return {
    ...event,
    eventType: event.eventType as CommerceSyncOutboxEventRecord['eventType'],
    payload: event.payload as CommerceSyncOutboxEventRecord['payload']
  };
}

@Injectable()
export class CommerceSyncOutboxConsumer implements OnModuleInit {
  private readonly logger = new Logger(CommerceSyncOutboxConsumer.name);
  private readonly config = getCommerceOutboxConsumerConfig();
  private readonly enabled = this.config.enabled;
  private readonly pollIntervalMs = this.config.pollIntervalMs;
  private timer: NodeJS.Timeout | null = null;
  private pollInFlight = false;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(VendureService)
    private readonly vendureService: VendureService
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
        this.logger.warn(`Commerce outbox schema is not ready yet: ${toErrorMessage(error)}`);
        return 0;
      }
      throw error;
    } finally {
      this.pollInFlight = false;
      this.scheduleNextPoll();
    }
  }

  async handleEvent(event: CommerceSyncOutboxEventRecord) {
    switch (event.eventType) {
      case 'ProductPublished':
        await this.syncPublishedProduct(event.aggregateId);
        return;
      case 'ProductAvailabilityChanged':
        await this.syncProductAvailability(event.aggregateId);
        return;
      case 'OrderCreated':
        await this.ensureVendureOrder(event.aggregateId);
        return;
      case 'OrderCanceled':
        await this.cancelVendureOrder(event.aggregateId);
        return;
      case 'OrderCompleted':
        await this.completeVendureOrder(event.aggregateId);
        return;
      case 'UserRegisteredForCommerce':
        await this.syncUserCustomer(event.aggregateId);
        return;
      default:
        throw new Error(`Unsupported commerce outbox event type: ${event.eventType}`);
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
        this.logger.error(`Failed to run scheduled commerce outbox poll: ${toErrorMessage(error)}`);
      });
    }, Math.max(0, delay));
  }

  private async claimPendingEvents(now: Date) {
    const pending = await this.prisma.outboxEvent.findMany({
      where: {
        topic: COMMERCE_SYNC_OUTBOX_TOPIC,
        status: OutboxEventStatus.PENDING,
        availableAt: { lte: now }
      },
      orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
      take: this.config.batchSize
    });

    if (!pending.length) {
      return [];
    }

    const claimed: CommerceSyncOutboxEventRecord[] = [];
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
        claimed.push(toCommerceSyncOutboxEventRecord({
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
        topic: COMMERCE_SYNC_OUTBOX_TOPIC,
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
      this.logger.warn(`Recovered ${recovered.count} stale commerce outbox events`);
    }
  }

  private async handleClaimedEvent(event: CommerceSyncOutboxEventRecord, now: Date) {
    try {
      await this.markEntityState(event, 'PROCESSING', null);
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
      const message = toErrorMessage(error);
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: terminal ? OutboxEventStatus.FAILED : OutboxEventStatus.PENDING,
          retryCount: nextRetryCount,
          lastError: message,
          processingStartedAt: null,
          availableAt: terminal ? now : nextCommerceRetryAt(event.retryCount, now)
        }
      });
      await this.markEntityState(event, terminal ? 'FAILED' : 'PENDING', message);
      this.logger.warn(`Failed to process commerce outbox event #${event.id}: ${message}`);
    }
  }

  private async syncPublishedProduct(productId: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });
    if (!product) {
      return;
    }

    const vendureProduct = await this.vendureService.ensureProductVariant(product);
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        vendureProductId: vendureProduct.id,
        vendureVariantId: vendureProduct.variantId,
        commerceSyncStatus: 'SYNCED',
        commerceSyncError: null
      }
    });
  }

  private async syncProductAvailability(productId: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });
    if (!product) {
      return;
    }

    const vendureProduct = await this.vendureService.ensureProductVariant(product);
    await this.vendureService.setProductAvailability(
      vendureProduct.id,
      vendureProduct.variantId,
      product.status === ProductStatus.ON_SALE
    );
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        vendureProductId: vendureProduct.id,
        vendureVariantId: vendureProduct.variantId,
        commerceSyncStatus: 'SYNCED',
        commerceSyncError: null
      }
    });
  }

  private async syncUserCustomer(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) {
      return;
    }

    const customer = await this.vendureService.ensureCustomer(user);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        vendureCustomerId: customer.id,
        commerceSyncStatus: 'SYNCED',
        commerceSyncError: null
      }
    });
  }

  private async cancelVendureOrder(orderId: number) {
    const order = await this.ensureVendureOrder(orderId);
    if (!order?.id) {
      return;
    }

    await this.vendureService.cancelOrder(order.id);
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        commerceSyncStatus: 'SYNCED',
        commerceSyncError: null
      }
    });
  }

  private async completeVendureOrder(orderId: number) {
    const order = await this.ensureVendureOrder(orderId);
    if (!order?.id) {
      return;
    }

    await this.vendureService.settleOrderPayment(order.id);
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        commerceSyncStatus: 'SYNCED',
        commerceSyncError: null
      }
    });
  }

  private async ensureVendureOrder(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        buyer: true
      }
    });
    if (!order) {
      return null;
    }

    if (order.vendureOrderId) {
      return {
        id: order.vendureOrderId,
        code: order.vendureOrderCode
      };
    }

    const [vendureProduct, vendureCustomer] = await Promise.all([
      this.vendureService.ensureProductVariant(order.product),
      this.vendureService.ensureCustomer(order.buyer)
    ]);
    const placed = await this.vendureService.createPlacedOrder({
      customerId: vendureCustomer.id,
      productVariantId: vendureProduct.variantId,
      note: order.note || `SwapCampus 商品 ${order.productId} 购买订单`
    });

    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: order.productId },
        data: {
          vendureProductId: vendureProduct.id,
          vendureVariantId: vendureProduct.variantId,
          commerceSyncStatus: 'SYNCED',
          commerceSyncError: null
        }
      }),
      this.prisma.user.update({
        where: { id: order.buyerId },
        data: {
          vendureCustomerId: vendureCustomer.id,
          commerceSyncStatus: 'SYNCED',
          commerceSyncError: null
        }
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          vendureOrderId: placed.id,
          vendureOrderCode: placed.code,
          commerceSyncStatus: 'SYNCED',
          commerceSyncError: null
        }
      })
    ]);

    return placed;
  }

  private async markEntityState(
    event: CommerceSyncOutboxEventRecord,
    state: 'PENDING' | 'PROCESSING' | 'SYNCED' | 'FAILED',
    error: string | null
  ) {
    if (event.eventType === 'ProductPublished' || event.eventType === 'ProductAvailabilityChanged') {
      const productId = toPositiveInt((event.payload as Record<string, unknown>).productId);
      if (productId) {
        await this.prisma.product.updateMany({
          where: { id: productId },
          data: {
            commerceSyncStatus: state,
            commerceSyncError: error
          }
        });
      }
      return;
    }

    if (event.eventType === 'UserRegisteredForCommerce') {
      const userId = toPositiveInt((event.payload as Record<string, unknown>).userId);
      if (userId) {
        await this.prisma.user.updateMany({
          where: { id: userId },
          data: {
            commerceSyncStatus: state,
            commerceSyncError: error
          }
        });
      }
      return;
    }

    const orderId = toPositiveInt((event.payload as Record<string, unknown>).orderId);
    if (!orderId) {
      return;
    }

    await this.prisma.order.updateMany({
      where: { id: orderId },
      data: {
        commerceSyncStatus: state,
        commerceSyncError: error
      }
    });
  }
}
