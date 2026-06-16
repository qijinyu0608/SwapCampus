import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, MessageType, OrderStatus, Prisma, PrismaClient, ProductOfflineReason, ProductStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hasAvatarFrameRewardUnlocked, hasTrustedBadgeRewardUnlocked } from '../credit-center/credit-center.utils';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAuthenticatedUser } from '../auth/auth.utils';
import { OutboxService } from '../outbox/outbox.service';
import { normalizeProductConditionValue } from '../products/product-conditions';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CompleteOrderDto } from './dto/complete-order.dto';
import { CreateOrderAppealDto } from './dto/create-order-appeal.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateMeetupDto } from './dto/update-meetup.dto';

const activeOrderStatuses = [
  OrderStatus.PENDING,
  OrderStatus.IN_PROGRESS,
  OrderStatus.WAITING_REVIEW
];

const AUTO_CONFIRM_RECEIPT_HOURS = 72;

type ProductOrderSnapshot = {
  productId: number;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  imageUrl: string | null;
  sellerId: number;
  sellerName: string | null;
};

type OrderEventPayload = {
  kind: 'product-order-event';
  event:
    | 'CREATED'
    | 'MEETUP_CONFIRMED'
    | 'CANCELED'
    | 'AUTO_COMPLETED'
    | 'BUYER_COMPLETED'
    | 'REVIEW_CREATED';
  title: string;
  summary: string;
  orderId: number;
  productId: number;
  orderCode: string;
  actionLabel?: string | null;
  actionTarget?: string | null;
  badge?: string | null;
  meta?: Array<{ label: string; value: string }>;
};

function buildOrderConfirmationNote(payload: CreateOrderDto, productTitle: string) {
  return [
    payload.note?.trim() || `想约“${productTitle}”当面交易`,
    payload.meetupTime?.trim() ? `交易时间：${payload.meetupTime.trim()}` : null,
    payload.paymentIntent?.trim() ? `支付方式：${payload.paymentIntent.trim()}` : null
  ].filter((item): item is string => Boolean(item)).join('\n');
}

function buildAutoConfirmAt(baseDate: Date) {
  return new Date(baseDate.getTime() + AUTO_CONFIRM_RECEIPT_HOURS * 60 * 60 * 1000);
}

function formatOrderCode(orderId: number) {
  return `SC${String(orderId).padStart(8, '0')}`;
}

function formatDateTimeLabel(date: Date | string | null | undefined) {
  if (!date) {
    return '待更新';
  }

  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return '待更新';
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getOrderActionState(params: {
  order: {
    buyerId: number;
    sellerId: number;
    status: OrderStatus;
  };
  currentUserId: number;
  reviews?: Array<{ reviewerId: number }> | null;
  hasConversation?: boolean;
}) {
  const { order, currentUserId, reviews, hasConversation = false } = params;
  const isBuyer = order.buyerId === currentUserId;
  const isParticipant = isBuyer || order.sellerId === currentUserId;
  const hasReviewed = reviews?.some((review) => review.reviewerId === currentUserId) ?? false;

  return {
    canComplete: isBuyer && (order.status === OrderStatus.PENDING || order.status === OrderStatus.IN_PROGRESS),
    canReview: isParticipant && (order.status === OrderStatus.WAITING_REVIEW || order.status === OrderStatus.COMPLETED) && !hasReviewed,
    canAppeal: isParticipant && order.status !== OrderStatus.CANCELED,
    canOpenConversation: hasConversation
  };
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(OutboxService)
    private readonly outboxService: OutboxService
  ) {}

  private get orderAppealClient() {
    return this.prisma as PrismaService & Pick<PrismaClient, 'orderAppeal'>;
  }

  async createOrder(payload: CreateOrderDto, currentUser: AuthenticatedUser) {
    const buyerUser = requireAuthenticatedUser(currentUser);
    const [product, buyer, productImages] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: payload.productId }
      }),
      this.prisma.user.findUnique({
        where: { id: buyerUser.id },
        select: { id: true, vendureCustomerId: true, displayName: true, email: true, accountStatus: true }
      }),
      this.prisma.productImage.findMany({
        where: { productId: payload.productId },
        orderBy: { sortOrder: 'asc' },
        select: { imageUrl: true }
      })
    ]);

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    if (!buyer) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (buyer.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法下单');
    }

    if (product.sellerId === buyerUser.id) {
      throw new BadRequestException('不能购买自己发布的商品');
    }

    if (product.status !== ProductStatus.ON_SALE) {
      throw new BadRequestException('商品当前不可下单');
    }

    const orderNote = buildOrderConfirmationNote(payload, product.title);
    const autoConfirmAt = buildAutoConfirmAt(new Date());
    const orderSnapshot: ProductOrderSnapshot = {
      productId: product.id,
      title: product.title,
      description: product.description,
      price: Number(product.price),
      category: product.category,
      condition: normalizeProductConditionValue(product.condition),
      imageUrl: productImages[0]?.imageUrl ?? null,
      sellerId: product.sellerId,
      sellerName: null
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          vendureOrderId: null,
          vendureOrderCode: null,
          productId: product.id,
          buyerId: buyerUser.id,
          sellerId: product.sellerId,
          meetupLocation: payload.meetupLocation?.trim() || null,
          note: orderNote || null,
          paymentIntent: payload.paymentIntent?.trim() || null,
          orderSnapshot,
          autoConfirmAt,
          status: OrderStatus.PENDING,
          commerceSyncStatus: 'PENDING',
          commerceSyncError: null
        }
      });

      await tx.product.update({
        where: { id: product.id },
        data: {
          status: ProductStatus.OFFLINE,
          offlineReason: ProductOfflineReason.ORDER_RESERVED
        }
      });

      await this.outboxService.publishProductSearchEvent({
        productId: product.id,
        eventType: 'ProductStatusChanged',
        changedBy: 'orders',
        reason: 'ORDER_RESERVED'
      }, tx);
      await this.outboxService.publishOrderCommerceSyncEvent({
        orderId: order.id,
        eventType: 'OrderCreated'
      }, tx);
      await this.outboxService.publishProductCommerceSyncEvent({
        productId: product.id,
        eventType: 'ProductAvailabilityChanged'
      }, tx);
      await this.outboxService.publishProductCommerceSyncEvent({
        productId: product.id,
        eventType: 'ProductInventoryChanged'
      }, tx);

      const existingConversation = await tx.conversation.findFirst({
        where: {
          productId: product.id,
          initiatorId: buyerUser.id
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true }
      });

      const conversation = existingConversation
        ? await tx.conversation.update({
            where: { id: existingConversation.id },
            data: {
              orderId: order.id,
              updatedAt: new Date()
            },
            select: { id: true }
          })
        : await tx.conversation.create({
            data: {
              orderId: order.id,
              productId: product.id,
              initiatorId: buyerUser.id
            },
            select: { id: true }
          });

      const createdMessage = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: buyerUser.id,
          type: MessageType.ORDER_EVENT,
          content: JSON.stringify(this.buildOrderEventPayload({
            event: 'CREATED',
            orderId: order.id,
            productId: product.id,
            orderCode: formatOrderCode(order.id),
            title: '已提交订单',
            summary: `订单已创建，等待卖家确认线下交付安排。${AUTO_CONFIRM_RECEIPT_HOURS} 小时后将自动确认收货。`,
            badge: '已下单',
            actionLabel: '查看订单',
            actionTarget: `/orders/${order.id}`,
            meta: [
              { label: '下单时间', value: formatDateTimeLabel(order.createdAt) },
              { label: '交付方式', value: payload.meetupLocation?.trim() || '线下面交待协商' },
              { label: '支付方式', value: payload.paymentIntent?.trim() || '线下面交后付款' }
            ]
          }))
        }
      });
      if (createdMessage?.id) {
        await this.outboxService.publishMessageEvent({
          conversationId: conversation.id,
          messageId: createdMessage.id,
          senderId: buyerUser.id,
          type: MessageType.ORDER_EVENT
        }, tx);
      }

      return order;
    });
    return result;
  }

  async listOrders(params?: {
    currentUser?: AuthenticatedUser;
    page?: number;
    pageSize?: number;
  }) {
    const authUser = requireAuthenticatedUser(params?.currentUser);
    await this.reconcileAutoConfirmedOrders(authUser.id);
    const page = params?.page ?? 1;
    const pageSize = Math.min(params?.pageSize ?? 6, 20);
    const skip = (page - 1) * pageSize;
    const where = {
      OR: [{ buyerId: authUser.id }, { sellerId: authUser.id }]
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      this.prisma.order.count({ where })
    ]);

    const productIds = [...new Set(orders.map((order) => order.productId))];
    const orderIds = orders.map((order) => order.id);
    const userIds = [...new Set(orders.flatMap((order) => [order.buyerId, order.sellerId]))];
    const [products, images, users, conversations] = await Promise.all([
      productIds.length
        ? this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
              id: true,
              title: true,
              price: true,
              category: true,
              condition: true,
              status: true
            }
          })
        : [],
      productIds.length
        ? this.prisma.productImage.findMany({
            where: { productId: { in: productIds } },
            orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }],
            select: { productId: true, imageUrl: true }
          })
        : [],
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, displayName: true, avatarUrl: true, avatarFrame: true, creditScore: true, verificationStatus: true }
          })
        : [],
      orderIds.length
        ? this.prisma.conversation.findMany({
            where: { orderId: { in: orderIds } },
            select: { id: true, orderId: true }
          })
        : []
    ]);

    const productMap = new Map(products.map((product) => [product.id, product]));
    const userMap = new Map(users.map((user) => [user.id, user]));
    const conversationMap = new Map(conversations.map((conversation) => [conversation.orderId, conversation.id]));
    const firstImageMap = new Map<number, string>();
    images.forEach((image) => {
      if (!firstImageMap.has(image.productId)) {
        firstImageMap.set(image.productId, image.imageUrl);
      }
    });

    const [unlockedUserIds, trustedBadgeUnlockedUserIds] = await Promise.all([
      Promise.all(users.map(async (user) => (await hasAvatarFrameRewardUnlocked(this.prisma, user.id)) ? user.id : null))
        .then((items) => new Set(items.filter((item): item is number => item !== null))),
      Promise.all(users.map(async (user) => (await hasTrustedBadgeRewardUnlocked(this.prisma, user.id)) ? user.id : null))
        .then((items) => new Set(items.filter((item): item is number => item !== null)))
    ]);

    return {
      items: orders.map((order) => this.mapOrderListItem({
        order,
        currentUserId: authUser.id,
        product: productMap.get(order.productId),
        conversationId: conversationMap.get(order.id) ?? null,
        productImageUrl: firstImageMap.get(order.productId) ?? null,
        buyer: userMap.get(order.buyerId),
        seller: userMap.get(order.sellerId),
        unlockedUserIds,
        trustedBadgeUnlockedUserIds
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total ? Math.ceil(total / pageSize) : 1
      }
    };
  }

  async getOrderByProductId(productId: number) {
    return this.prisma.order.findFirst({
      where: {
        productId,
        status: { not: OrderStatus.CANCELED }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        productId: true,
        buyerId: true,
        sellerId: true,
        status: true,
        createdAt: true,
        completedAt: true,
        autoConfirmAt: true
      }
    });
  }

  async getOrderDetail(orderId: number, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    await this.reconcileAutoConfirmedOrders(authUser.id);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            category: true,
            condition: true,
            status: true,
            description: true
          }
        },
        buyer: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            avatarFrame: true,
            creditScore: true,
            verificationStatus: true
          }
        },
        seller: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            avatarFrame: true,
            creditScore: true,
            verificationStatus: true
          }
        },
        reviews: {
          orderBy: { createdAt: 'asc' },
          include: {
            reviewer: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        },
        appeals: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            appellantId: true,
            respondentId: true,
            issueType: true,
            reason: true,
            expectedAction: true,
            status: true,
            resolutionNote: true,
            createdAt: true,
            updatedAt: true
          }
        },
        conversations: {
          orderBy: { updatedAt: 'desc' },
          select: { id: true }
        }
      }
    }) as (Awaited<ReturnType<typeof this.prisma.order.findUnique>> & {
      product: {
        id: number;
        title: string;
        price: Prisma.Decimal;
        category: string;
        condition: string;
        status: ProductStatus;
        description: string;
      };
      buyer: {
        id: number;
        displayName: string;
        avatarUrl: string | null;
        avatarFrame: string | null;
        creditScore: number;
        verificationStatus: VerificationStatus;
      };
      seller: {
        id: number;
        displayName: string;
        avatarUrl: string | null;
        avatarFrame: string | null;
        creditScore: number;
        verificationStatus: VerificationStatus;
      };
      reviews: Array<{
        id: number;
        rating: number;
        content: string;
        createdAt: Date;
        reviewerId: number;
        reviewer: {
          id: number;
          displayName: string;
        };
      }>;
      appeals: Array<{
        id: number;
        appellantId: number;
        respondentId: number;
        issueType: string;
        reason: string;
        expectedAction: string | null;
        status: string;
        resolutionNote: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>;
      conversations: Array<{ id: number }>;
    }) | null;

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    this.assertParticipant(order, authUser.id);

    const [images, unlockedUserIds, trustedBadgeUnlockedUserIds] = await Promise.all([
      this.prisma.productImage.findMany({
        where: { productId: order.productId },
        orderBy: { sortOrder: 'asc' },
        select: { imageUrl: true }
      }),
      Promise.all([order.buyerId, order.sellerId].map(async (id) => (await hasAvatarFrameRewardUnlocked(this.prisma, id)) ? id : null))
        .then((items) => new Set(items.filter((item): item is number => item !== null))),
      Promise.all([order.buyerId, order.sellerId].map(async (id) => (await hasTrustedBadgeRewardUnlocked(this.prisma, id)) ? id : null))
        .then((items) => new Set(items.filter((item): item is number => item !== null)))
    ]);
    const snapshot = this.parseOrderSnapshot(order.orderSnapshot, {
      productId: order.productId,
      title: order.product.title,
      description: order.product.description,
      price: Number(order.product.price),
      category: order.product.category,
      condition: normalizeProductConditionValue(order.product.condition),
      imageUrl: images[0]?.imageUrl ?? null,
      sellerId: order.sellerId,
      sellerName: order.seller.displayName
    });
    const detail = this.mapOrderListItem({
      order,
      currentUserId: authUser.id,
      product: order.product,
      conversationId: order.conversations[0]?.id ?? null,
      productImageUrl: images[0]?.imageUrl ?? null,
      buyer: order.buyer,
      seller: order.seller,
      unlockedUserIds,
      trustedBadgeUnlockedUserIds
    });

    const actionState = getOrderActionState({
      order,
      currentUserId: authUser.id,
      reviews: order.reviews,
      hasConversation: Boolean(order.conversations[0]?.id)
    });

    return {
      ...detail,
      orderCode: order.vendureOrderCode ?? formatOrderCode(order.id),
      paymentIntent: order.paymentIntent ?? null,
      orderSnapshot: snapshot,
      autoConfirmCountdownSeconds: this.getAutoConfirmCountdownSeconds(order.autoConfirmAt, order.status),
      timeline: [
        { label: '下单时间', value: formatDateTimeLabel(order.createdAt) },
        { label: '自动确认', value: formatDateTimeLabel(order.autoConfirmAt) },
        { label: '完成时间', value: formatDateTimeLabel(order.completedAt) },
        { label: '取消时间', value: formatDateTimeLabel(order.canceledAt) }
      ],
      reviews: order.reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        content: review.content,
        createdAt: review.createdAt,
        reviewerId: review.reviewerId,
        reviewerName: review.reviewer.displayName
      })),
      appeals: order.appeals.map((appeal) => ({
        id: appeal.id,
        appellantId: appeal.appellantId,
        respondentId: appeal.respondentId,
        issueType: appeal.issueType,
        reason: appeal.reason,
        expectedAction: appeal.expectedAction,
        status: appeal.status,
        resolutionNote: appeal.resolutionNote,
        createdAt: appeal.createdAt,
        updatedAt: appeal.updatedAt
      })),
      actionState
    };
  }

  async createAppeal(orderId: number, payload: CreateOrderAppealDto, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        status: true
      }
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    this.assertParticipant(order, authUser.id);

    if (order.status === OrderStatus.CANCELED) {
      throw new BadRequestException('已取消订单不能发起申诉');
    }

    const respondentId = order.buyerId === authUser.id ? order.sellerId : order.buyerId;
    const duplicatedOpenAppeal = await this.orderAppealClient.orderAppeal.findFirst({
      where: {
        orderId,
        appellantId: authUser.id,
        respondentId,
        status: 'OPEN'
      },
      select: { id: true }
    });

    if (duplicatedOpenAppeal) {
      throw new BadRequestException('你已经针对该订单提交过待处理申诉');
    }

    const appeal = await this.orderAppealClient.orderAppeal.create({
      data: {
        orderId,
        appellantId: authUser.id,
        respondentId,
        issueType: payload.issueType.trim(),
        reason: payload.reason.trim(),
        expectedAction: payload.expectedAction?.trim() || null,
        status: 'OPEN'
      }
    });

    await this.outboxService.publishGovernanceEvent({
      actorId: authUser.id,
      actorName: `用户#${authUser.id}`,
      action: 'CREATE_ORDER_APPEAL',
      targetType: 'ORDER_APPEAL',
      targetId: appeal.id,
      detail: `${payload.issueType.trim()}：${payload.reason.trim()}`,
      aggregateType: 'ORDER' as any,
      aggregateId: orderId
    });

    return {
      id: appeal.id,
      status: appeal.status,
      issueType: appeal.issueType,
      reason: appeal.reason
    };
  }

  async confirmMeetup(orderId: number, payload: UpdateMeetupDto, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId }
      });

      if (!order) {
        throw new NotFoundException('订单不存在');
      }

      this.assertParticipant(order, authUser.id);

      if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.IN_PROGRESS) {
        throw new BadRequestException('当前订单状态不能修改面交约定');
      }

      const nextLocation = payload.meetupLocation?.trim() || order.meetupLocation || null;
      const nextNote = payload.note?.trim() || order.note || null;
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.IN_PROGRESS,
          meetupLocation: nextLocation,
          note: nextNote
        }
      });

      await this.appendOrderEventMessage(tx, {
        orderId,
        senderId: authUser.id,
        event: 'MEETUP_CONFIRMED',
        title: '已确认交付安排',
        summary: '线下交付方案已更新，订单进入待面交阶段。',
        badge: '待面交',
        meta: [
          { label: '面交地点', value: nextLocation || '待协商' },
          { label: '备注', value: nextNote || '无' }
        ]
      });

      return updated;
    });
  }

  async cancelOrder(orderId: number, payload: CancelOrderDto, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const existingOrder = await this.prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!existingOrder) {
      throw new NotFoundException('订单不存在');
    }

    this.assertParticipant(existingOrder, authUser.id);

    if (existingOrder.status === OrderStatus.COMPLETED || existingOrder.status === OrderStatus.CANCELED) {
      throw new BadRequestException('当前订单不能取消');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELED,
          canceledAt: new Date(),
          commerceSyncStatus: 'PENDING',
          commerceSyncError: null
        }
      });

      const activeOrder = await tx.order.findFirst({
        where: {
          productId: existingOrder.productId,
          id: { not: orderId },
          status: { in: activeOrderStatuses }
        },
        select: { id: true }
      });

      const finishedOrder = await tx.order.findFirst({
        where: {
          productId: existingOrder.productId,
          id: { not: orderId },
          status: OrderStatus.COMPLETED
        },
        select: { id: true }
      });

      let restoredProduct = false;
      if (!activeOrder && !finishedOrder) {
        const product = await tx.product.findUnique({
          where: { id: existingOrder.productId },
          select: { id: true, sellerId: true, offlineReason: true, status: true }
        });

        const seller = product
          ? await tx.user.findUnique({
              where: { id: product.sellerId },
              select: { accountStatus: true }
            })
          : null;

        if (
          product
          && seller?.accountStatus !== AccountStatus.BANNED
          && product.status === ProductStatus.OFFLINE
          && product.offlineReason === ProductOfflineReason.ORDER_RESERVED
        ) {
          await tx.product.update({
            where: { id: existingOrder.productId },
            data: { status: ProductStatus.ON_SALE, offlineReason: null }
          });
          restoredProduct = true;
        }
      }

      if (restoredProduct) {
        await this.outboxService.publishProductSearchEvent({
          productId: existingOrder.productId,
          eventType: 'ProductStatusChanged',
          changedBy: 'orders',
          reason: 'ORDER_CANCELED'
        }, tx);
        await this.outboxService.publishProductCommerceSyncEvent({
          productId: existingOrder.productId,
          eventType: 'ProductAvailabilityChanged'
        }, tx);
        await this.outboxService.publishProductCommerceSyncEvent({
          productId: existingOrder.productId,
          eventType: 'ProductInventoryChanged'
        }, tx);
      }
      await this.outboxService.publishOrderCommerceSyncEvent({
        orderId,
        eventType: 'OrderCanceled'
      }, tx);

      await this.appendOrderEventMessage(tx, {
        orderId,
        senderId: authUser.id,
        event: 'CANCELED',
        title: '订单已取消',
        summary: payload.reason?.trim() ? `取消原因：${payload.reason.trim()}` : '订单已取消，双方可重新沟通后再次下单。',
        badge: '已取消',
        meta: payload.reason?.trim() ? [{ label: '取消原因', value: payload.reason.trim() }] : []
      });

      return updated;
    });
    return result;
  }

  async completeMeetup(orderId: number, _payload: CompleteOrderDto, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const existingOrder = await this.prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!existingOrder) {
      throw new NotFoundException('订单不存在');
    }

    if (existingOrder.buyerId !== authUser.id) {
      throw new ForbiddenException('只有买家可以确认收货');
    }

    if (existingOrder.status !== OrderStatus.PENDING && existingOrder.status !== OrderStatus.IN_PROGRESS) {
      throw new BadRequestException('当前订单状态不能确认收货');
    }

    return this.completeOrderAndOpenReview(orderId, authUser.id, 'BUYER_COMPLETED');
  }

  async createReview(orderId: number, payload: CreateReviewDto, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId }
      });

      if (!order) {
        throw new NotFoundException('订单不存在');
      }

      this.assertParticipant(order, authUser.id);

      if (order.status !== OrderStatus.WAITING_REVIEW && order.status !== OrderStatus.COMPLETED) {
        throw new BadRequestException('当前订单还不能评价');
      }

      const existing = await tx.review.findFirst({
        where: {
          orderId,
          reviewerId: authUser.id
        },
        select: { id: true }
      });

      if (existing) {
        throw new BadRequestException('你已评价过该订单');
      }

      const review = await tx.review.create({
        data: {
          orderId,
          reviewerId: authUser.id,
          rating: payload.rating,
          content: payload.content?.trim() || '线下面交顺利完成'
        }
      });

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED }
      });

      await this.appendOrderEventMessage(tx, {
        orderId,
        senderId: authUser.id,
        event: 'REVIEW_CREATED',
        title: '已提交评价',
        summary: `已提交 ${payload.rating} 星评价，订单已完结。`,
        badge: '已评价',
        meta: [
          { label: '评分', value: `${payload.rating} 星` },
          { label: '评价内容', value: payload.content?.trim() || '线下面交顺利完成' }
        ]
      });

      return {
        order: updated,
        review
      };
    });
  }

  private assertParticipant(order: { buyerId: number; sellerId: number }, userId: number) {
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('只能操作自己的订单');
    }
  }

  private parseOrderSnapshot(snapshot: Prisma.JsonValue | null | undefined, fallback: ProductOrderSnapshot): ProductOrderSnapshot {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return fallback;
    }

    const parsed = snapshot as Partial<ProductOrderSnapshot>;
    return {
      productId: typeof parsed.productId === 'number' ? parsed.productId : fallback.productId,
      title: typeof parsed.title === 'string' ? parsed.title : fallback.title,
      description: typeof parsed.description === 'string' ? parsed.description : fallback.description,
      price: typeof parsed.price === 'number' ? parsed.price : fallback.price,
      category: typeof parsed.category === 'string' ? parsed.category : fallback.category,
      condition: typeof parsed.condition === 'string'
        ? normalizeProductConditionValue(parsed.condition)
        : fallback.condition,
      imageUrl: typeof parsed.imageUrl === 'string' || parsed.imageUrl === null ? parsed.imageUrl : fallback.imageUrl,
      sellerId: typeof parsed.sellerId === 'number' ? parsed.sellerId : fallback.sellerId,
      sellerName: typeof parsed.sellerName === 'string' || parsed.sellerName === null ? parsed.sellerName : fallback.sellerName
    };
  }

  private getAutoConfirmCountdownSeconds(autoConfirmAt: Date | null, status: OrderStatus) {
    if (!autoConfirmAt || status === OrderStatus.CANCELED || status === OrderStatus.COMPLETED || status === OrderStatus.WAITING_REVIEW) {
      return 0;
    }

    return Math.max(0, Math.floor((autoConfirmAt.getTime() - Date.now()) / 1000));
  }

  private buildOrderEventPayload(params: {
    event: OrderEventPayload['event'];
    orderId: number;
    productId: number;
    orderCode: string;
    title: string;
    summary: string;
    badge?: string | null;
    actionLabel?: string | null;
    actionTarget?: string | null;
    meta?: Array<{ label: string; value: string }>;
  }): OrderEventPayload {
    return {
      kind: 'product-order-event',
      event: params.event,
      title: params.title,
      summary: params.summary,
      orderId: params.orderId,
      productId: params.productId,
      orderCode: params.orderCode,
      badge: params.badge ?? null,
      actionLabel: params.actionLabel ?? null,
      actionTarget: params.actionTarget ?? `/orders/${params.orderId}`,
      meta: params.meta ?? []
    };
  }

  private mapOrderListItem(params: {
    order: {
      id: number;
      vendureOrderId: string | null;
      vendureOrderCode: string | null;
      productId: number;
      buyerId: number;
      sellerId: number;
      status: OrderStatus;
      meetupLocation: string | null;
      note: string | null;
      paymentIntent?: string | null;
      autoConfirmAt?: Date | null;
      createdAt: Date;
      updatedAt: Date;
      completedAt?: Date | null;
      canceledAt?: Date | null;
    };
    currentUserId: number;
    product?: {
      id: number;
      title: string;
      price: Prisma.Decimal | number;
      category: string;
      condition: string;
      status: ProductStatus;
    } | null;
    conversationId: number | null;
    productImageUrl: string | null;
    buyer?: {
      id: number;
      displayName: string;
      avatarUrl: string | null;
      avatarFrame: string | null;
      creditScore: number;
      verificationStatus: VerificationStatus;
    } | null;
    seller?: {
      id: number;
      displayName: string;
      avatarUrl: string | null;
      avatarFrame: string | null;
      creditScore: number;
      verificationStatus: VerificationStatus;
    } | null;
    unlockedUserIds: Set<number>;
    trustedBadgeUnlockedUserIds?: Set<number>;
  }) {
    const { order, product, conversationId, productImageUrl, buyer, seller, unlockedUserIds, trustedBadgeUnlockedUserIds, currentUserId } = params;
    const actionState = getOrderActionState({
      order,
      currentUserId,
      hasConversation: Boolean(conversationId)
    });
    return {
      ...order,
      orderCode: order.vendureOrderCode ?? formatOrderCode(order.id),
      externalOrderId: order.vendureOrderId,
      externalOrderCode: order.vendureOrderCode,
      productTitle: product?.title ?? `商品#${order.productId}`,
      productPrice: product ? Number(product.price) : null,
      productCategory: product?.category ?? null,
      productCondition: product?.condition ?? null,
      productStatus: product?.status ?? null,
      productImageUrl,
      conversationId,
      buyerName: buyer?.displayName ?? `用户#${order.buyerId}`,
      buyerAvatarUrl: buyer?.avatarUrl ?? null,
      buyerAvatarFrame: unlockedUserIds.has(order.buyerId) ? (buyer?.avatarFrame ?? null) : null,
      buyerTrustedBadgeUnlocked: trustedBadgeUnlockedUserIds?.has(order.buyerId) ?? false,
      buyerCreditScore: buyer?.creditScore ?? null,
      buyerVerified: buyer?.verificationStatus === VerificationStatus.APPROVED,
      sellerName: seller?.displayName ?? `用户#${order.sellerId}`,
      sellerAvatarUrl: seller?.avatarUrl ?? null,
      sellerAvatarFrame: unlockedUserIds.has(order.sellerId) ? (seller?.avatarFrame ?? null) : null,
      sellerTrustedBadgeUnlocked: trustedBadgeUnlockedUserIds?.has(order.sellerId) ?? false,
      sellerCreditScore: seller?.creditScore ?? null,
      sellerVerified: seller?.verificationStatus === VerificationStatus.APPROVED,
      autoConfirmAt: order.autoConfirmAt ?? null,
      autoConfirmCountdownSeconds: this.getAutoConfirmCountdownSeconds(order.autoConfirmAt ?? null, order.status),
      canBuyerComplete: actionState.canComplete,
      canReview: actionState.canReview
    };
  }

  private async completeOrderAndOpenReview(orderId: number, senderId: number, event: 'AUTO_COMPLETED' | 'BUYER_COMPLETED') {
    const result = await this.prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId }
      });

      if (!currentOrder) {
        throw new NotFoundException('订单不存在');
      }

      const completedAt = new Date();
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.WAITING_REVIEW,
          completedAt,
          commerceSyncStatus: 'PENDING',
          commerceSyncError: null
        }
      });

      await tx.product.update({
        where: { id: currentOrder.productId },
        data: { status: ProductStatus.SOLD, offlineReason: null }
      });

      await this.outboxService.publishProductSearchEvent({
        productId: currentOrder.productId,
        eventType: 'ProductStatusChanged',
        changedBy: 'orders',
        reason: event === 'AUTO_COMPLETED' ? 'ORDER_AUTO_COMPLETED' : 'ORDER_COMPLETED'
      }, tx);
      await this.outboxService.publishProductCommerceSyncEvent({
        productId: currentOrder.productId,
        eventType: 'ProductAvailabilityChanged'
      }, tx);
      await this.outboxService.publishProductCommerceSyncEvent({
        productId: currentOrder.productId,
        eventType: 'ProductInventoryChanged'
      }, tx);
      await this.outboxService.publishOrderCommerceSyncEvent({
        orderId,
        eventType: 'OrderPaymentSettled'
      }, tx);
      await this.outboxService.publishOrderCommerceSyncEvent({
        orderId,
        eventType: 'OrderFulfillmentCompleted'
      }, tx);
      await this.outboxService.publishOrderCommerceSyncEvent({
        orderId,
        eventType: 'OrderCompleted'
      }, tx);

      await this.appendOrderEventMessage(tx, {
        orderId,
        senderId,
        event,
        title: event === 'AUTO_COMPLETED' ? '已自动确认收货' : '买家已确认收货',
        summary: event === 'AUTO_COMPLETED'
          ? '订单超过确认时限，系统已自动确认收货，当前可提交评价。'
          : '买家已确认收货，订单进入待评价阶段。',
        badge: '待评价',
        meta: [{ label: '确认时间', value: formatDateTimeLabel(completedAt) }]
      });

      return updated;
    });

    return result;
  }

  private async reconcileAutoConfirmedOrders(userId: number) {
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        buyerId: userId,
        status: { in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS] },
        autoConfirmAt: {
          lte: new Date()
        }
      },
      select: {
        id: true,
        productId: true,
        vendureOrderId: true,
        buyerId: true
      }
    });

    if (!expiredOrders.length) {
      return;
    }

    for (const order of expiredOrders) {
      await this.completeOrderAndOpenReview(order.id, order.buyerId, 'AUTO_COMPLETED');
    }
  }

  private async appendOrderMessage(
    tx: Prisma.TransactionClient,
    orderId: number,
    senderId: number,
    content: string,
    type: MessageType = MessageType.TEXT
  ) {
    const conversation = await tx.conversation.findFirst({
      where: { orderId },
      select: { id: true }
    });

    if (!conversation) {
      return;
    }

    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        content,
        type
      }
    });

    if (message?.id) {
      await this.outboxService.publishMessageEvent({
        conversationId: conversation.id,
        messageId: message.id,
        senderId,
        type
      }, tx);
    }

    await tx.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() }
    });
  }

  private async appendOrderEventMessage(
    tx: Prisma.TransactionClient,
    params: {
      orderId: number;
      senderId: number;
      event: OrderEventPayload['event'];
      title: string;
      summary: string;
      badge?: string | null;
      actionLabel?: string | null;
      actionTarget?: string | null;
      meta?: Array<{ label: string; value: string }>;
    }
  ) {
    const order = await tx.order.findUnique({
      where: { id: params.orderId },
      select: {
        id: true,
        productId: true,
        vendureOrderCode: true
      }
    });

    if (!order) {
      return;
    }

    await this.appendOrderMessage(
      tx,
      params.orderId,
      params.senderId,
      JSON.stringify(this.buildOrderEventPayload({
        event: params.event,
        orderId: order.id,
        productId: order.productId,
        orderCode: order.vendureOrderCode ?? formatOrderCode(order.id),
        title: params.title,
        summary: params.summary,
        badge: params.badge,
        actionLabel: params.actionLabel,
        actionTarget: params.actionTarget,
        meta: params.meta
      })),
      MessageType.ORDER_EVENT
    );
  }
}
