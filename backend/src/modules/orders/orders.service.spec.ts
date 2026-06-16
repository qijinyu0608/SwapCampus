import { BadRequestException } from '@nestjs/common';
import { AccountStatus, MessageType, OrderStatus, ProductOfflineReason, ProductStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const buyerUser = {
    id: 11,
    studentId: '2026000011',
    email: 'buyer@example.com',
    role: 'USER'
  } as any;

  function createProduct(overrides: Record<string, unknown> = {}) {
    return {
      id: 18,
      sellerId: 22,
      title: '二手教材',
      description: '高数教材，九五成新',
      price: 88,
      category: 'BOOKS',
      condition: '95新',
      status: ProductStatus.ON_SALE,
      vendureProductId: null,
      vendureVariantId: null,
      offlineReason: null,
      ...overrides
    };
  }

  function createOrder(overrides: Record<string, unknown> = {}) {
    return {
      id: 91,
      productId: 18,
      buyerId: 11,
      sellerId: 22,
      status: OrderStatus.PENDING,
      vendureOrderId: null,
      vendureOrderCode: null,
      meetupLocation: null,
      note: null,
      paymentIntent: null,
      orderSnapshot: null,
      autoConfirmAt: new Date('2026-06-15T12:00:00.000Z'),
      createdAt: new Date('2026-06-12T09:00:00.000Z'),
      updatedAt: new Date('2026-06-12T09:00:00.000Z'),
      completedAt: null,
      canceledAt: null,
      ...overrides
    };
  }

  function createPrisma(overrides: {
    prisma?: Record<string, Record<string, any>>;
    tx?: Record<string, Record<string, any>>;
  } = {}) {
    const tx: any = {
      order: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      product: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn()
      },
      productImage: {
        findMany: jest.fn()
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn()
      },
      review: {
        findFirst: jest.fn(),
        create: jest.fn()
      },
      orderAppeal: {
        findFirst: jest.fn(),
        create: jest.fn()
      },
      conversation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      message: {
        create: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      },
      creditRedeemOrder: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    };

    const prisma: any = {
      order: {
        ...tx.order
      },
      product: {
        ...tx.product
      },
      productImage: {
        ...tx.productImage
      },
      user: {
        ...tx.user
      },
      review: {
        ...tx.review
      },
      orderAppeal: {
        ...tx.orderAppeal
      },
      conversation: {
        ...tx.conversation
      },
      message: {
        ...tx.message
      },
      auditLog: {
        ...tx.auditLog
      },
      creditRedeemOrder: {
        ...tx.creditRedeemOrder
      },
      $transaction: jest.fn(async (input: any) => {
        if (Array.isArray(input)) {
          return Promise.all(input);
        }

        return input(tx);
      })
    };

    Object.entries(overrides.tx ?? {}).forEach(([group, value]) => {
      Object.assign(tx[group], value);
    });
    Object.entries(overrides.prisma ?? {}).forEach(([group, value]) => {
      Object.assign(prisma[group], value);
    });

    return { prisma, tx };
  }

  function createService(prisma: any, overrides: {
    outbox?: Record<string, any>;
  } = {}) {
    const outboxService = {
      publishGovernanceEvent: jest.fn().mockResolvedValue(undefined),
      publishProductSearchEvent: jest.fn().mockResolvedValue(undefined),
      publishProductCommerceSyncEvent: jest.fn().mockResolvedValue(undefined),
      publishOrderCommerceSyncEvent: jest.fn().mockResolvedValue(undefined),
      publishUserCommerceSyncEvent: jest.fn().mockResolvedValue(undefined),
      ...overrides.outbox
    };

    return {
      service: new OrdersService(prisma, outboxService as any),
      outboxService
    };
  }

  function readEventPayload(messageCreate: jest.Mock) {
    const lastCall = messageCreate.mock.calls[messageCreate.mock.calls.length - 1];
    return JSON.parse(lastCall[0].data.content);
  }

  it('should create a product order and reserve the product', async () => {
    const product = createProduct();
    const createdOrder = createOrder({
      id: 401
    });
    const { prisma, tx } = createPrisma();
    prisma.product.findUnique.mockResolvedValue(product);
    prisma.user.findUnique.mockResolvedValue({
      id: 11,
      vendureCustomerId: null,
      displayName: '买家甲',
      email: 'buyer@example.com',
      accountStatus: AccountStatus.ACTIVE
    });
    prisma.productImage.findMany.mockResolvedValue([
      { imageUrl: 'https://cdn.example.com/book-cover.jpg' }
    ]);
    tx.order.create.mockResolvedValue(createdOrder);
    tx.product.update.mockResolvedValue(undefined);
    tx.conversation.findFirst.mockResolvedValue(null);
    tx.conversation.create.mockResolvedValue({ id: 9001 });
    tx.message.create.mockResolvedValue(undefined);

    const { service, outboxService } = createService(prisma);
    const result = await service.createOrder({
      productId: 18,
      meetupLocation: ' 图书馆门口 ',
      meetupTime: ' 今晚 8 点 ',
      paymentIntent: ' 现金 ',
      note: ' 想现场看看成色 '
    }, buyerUser);

    const createOrderArgs = tx.order.create.mock.calls[0][0];
    expect(createOrderArgs.data.status).toBe(OrderStatus.PENDING);
    expect(createOrderArgs.data.meetupLocation).toBe('图书馆门口');
    expect(createOrderArgs.data.paymentIntent).toBe('现金');
    expect(createOrderArgs.data.note).toContain('想现场看看成色');
    expect(createOrderArgs.data.note).toContain('交易时间：今晚 8 点');
    expect(createOrderArgs.data.note).toContain('支付方式：现金');
    expect(createOrderArgs.data.autoConfirmAt).toBeInstanceOf(Date);
    expect(createOrderArgs.data.vendureOrderId).toBeNull();
    expect(createOrderArgs.data.vendureOrderCode).toBeNull();
    expect(createOrderArgs.data.commerceSyncStatus).toBe('PENDING');
    expect(createOrderArgs.data.commerceSyncError).toBeNull();
    expect(createOrderArgs.data.orderSnapshot).toMatchObject({
      productId: 18,
      title: '二手教材',
      description: '高数教材，九五成新',
      price: 88,
      category: 'BOOKS',
      condition: '九五成',
      imageUrl: 'https://cdn.example.com/book-cover.jpg',
      sellerId: 22,
      sellerName: null
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 18 },
      data: {
        status: ProductStatus.OFFLINE,
        offlineReason: ProductOfflineReason.ORDER_RESERVED
      }
    });
    expect(tx.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 9001,
        senderId: 11,
        type: MessageType.ORDER_EVENT
      })
    });

    const payload = readEventPayload(tx.message.create);
    expect(payload).toMatchObject({
      kind: 'product-order-event',
      event: 'CREATED',
      orderId: 401,
      productId: 18,
      orderCode: 'SC00000401',
      title: '已提交订单',
      badge: '已下单',
      actionTarget: '/orders/401'
    });
    expect(outboxService.publishProductSearchEvent).toHaveBeenCalledWith({
      productId: 18,
      eventType: 'ProductStatusChanged',
      changedBy: 'orders',
      reason: 'ORDER_RESERVED'
    }, tx);
    expect(outboxService.publishProductCommerceSyncEvent).toHaveBeenCalledWith({
      productId: 18,
      eventType: 'ProductAvailabilityChanged'
    }, tx);
    expect(outboxService.publishProductCommerceSyncEvent).toHaveBeenCalledWith({
      productId: 18,
      eventType: 'ProductInventoryChanged'
    }, tx);
    expect(outboxService.publishOrderCommerceSyncEvent).toHaveBeenCalledWith({
      orderId: 401,
      eventType: 'OrderCreated'
    }, tx);
    expect(result).toEqual(createdOrder);
  });

  it('should reject creating order for own product', async () => {
    const { prisma } = createPrisma();
    prisma.product.findUnique.mockResolvedValue(createProduct({
      sellerId: 11
    }));
    prisma.user.findUnique.mockResolvedValue({
      id: 11,
      vendureCustomerId: null,
      displayName: '买家甲',
      email: 'buyer@example.com',
      accountStatus: AccountStatus.ACTIVE
    });
    prisma.productImage.findMany.mockResolvedValue([]);

    const { service, outboxService } = createService(prisma);

    await expect(service.createOrder({
      productId: 18
    }, buyerUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should create order appeal successfully', async () => {
    const { prisma } = createPrisma();
    prisma.order.findUnique.mockResolvedValue({
      id: 96,
      buyerId: 11,
      sellerId: 22,
      status: OrderStatus.IN_PROGRESS
    });
    prisma.orderAppeal.findFirst.mockResolvedValue(null);
    prisma.orderAppeal.create.mockResolvedValue({
      id: 501,
      status: 'OPEN',
      issueType: '未按约定交付',
      reason: '对方迟到且未提前说明',
      expectedAction: '取消订单'
    });

    const { service, outboxService } = createService(prisma);
    const result = await service.createAppeal(96, {
      issueType: ' 未按约定交付 ',
      reason: ' 对方迟到且未提前说明 ',
      expectedAction: ' 取消订单 '
    }, buyerUser);

    expect(prisma.orderAppeal.create).toHaveBeenCalledWith({
      data: {
        orderId: 96,
        appellantId: 11,
        respondentId: 22,
        issueType: '未按约定交付',
        reason: '对方迟到且未提前说明',
        expectedAction: '取消订单',
        status: 'OPEN'
      }
    });
    expect(outboxService.publishGovernanceEvent).toHaveBeenCalledWith({
      actorId: 11,
      actorName: '用户#11',
      action: 'CREATE_ORDER_APPEAL',
      targetType: 'ORDER_APPEAL',
      targetId: 501,
      detail: '未按约定交付：对方迟到且未提前说明',
      aggregateType: 'ORDER',
      aggregateId: 96
    });
    expect(result).toEqual({
      id: 501,
      status: 'OPEN',
      issueType: '未按约定交付',
      reason: '对方迟到且未提前说明'
    });
  });

  it('should reject duplicated open appeal from same appellant on same order', async () => {
    const { prisma } = createPrisma();
    prisma.order.findUnique.mockResolvedValue({
      id: 8,
      buyerId: 11,
      sellerId: 22,
      status: OrderStatus.IN_PROGRESS
    });
    prisma.orderAppeal.findFirst.mockResolvedValue({ id: 3 });

    const { service } = createService(prisma);

    await expect(
      service.createAppeal(8, {
        issueType: '未按约定交付',
        reason: '对方没有按约定地点出现',
        expectedAction: '取消订单'
      }, buyerUser)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should confirm meetup and push order event message', async () => {
    const pendingOrder = createOrder({
      id: 92,
      status: OrderStatus.PENDING
    });
    const updatedOrder = {
      ...pendingOrder,
      status: OrderStatus.IN_PROGRESS,
      meetupLocation: '南门快递柜',
      note: '到了给我发消息'
    };
    const { prisma, tx } = createPrisma();
    tx.order.findUnique
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce({
        id: 92,
        productId: 18,
        vendureOrderCode: null
      });
    tx.order.update.mockResolvedValue(updatedOrder);
    tx.conversation.findFirst.mockResolvedValue({ id: 3001 });
    tx.message.create.mockResolvedValue(undefined);
    tx.conversation.update.mockResolvedValue(undefined);

    const { service, outboxService } = createService(prisma);
    const result = await service.confirmMeetup(92, {
      meetupLocation: ' 南门快递柜 ',
      note: ' 到了给我发消息 '
    }, buyerUser);

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 92 },
      data: {
        status: OrderStatus.IN_PROGRESS,
        meetupLocation: '南门快递柜',
        note: '到了给我发消息'
      }
    });
    expect(tx.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 3001,
        senderId: 11,
        type: MessageType.ORDER_EVENT
      })
    });

    const payload = readEventPayload(tx.message.create);
    expect(payload).toMatchObject({
      event: 'MEETUP_CONFIRMED',
      orderId: 92,
      productId: 18,
      title: '已确认交付安排',
      badge: '待面交'
    });
    expect(outboxService.publishProductSearchEvent).not.toHaveBeenCalled();
    expect(result).toEqual(updatedOrder);
  });

  it('should cancel order, restore reserved product and push event message', async () => {
    const existingOrder = createOrder({
      id: 93,
      status: OrderStatus.PENDING
    });
    const canceledOrder = {
      ...existingOrder,
      status: OrderStatus.CANCELED,
      canceledAt: new Date('2026-06-12T10:30:00.000Z')
    };
    const { prisma, tx } = createPrisma();
    prisma.order.findUnique
      .mockResolvedValueOnce(existingOrder)
      .mockResolvedValueOnce({
        id: 93,
        productId: 18,
        vendureOrderCode: null
      });
    tx.order.update.mockResolvedValue(canceledOrder);
    tx.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    tx.product.findUnique.mockResolvedValue({
      id: 18,
      sellerId: 22,
      status: ProductStatus.OFFLINE,
      offlineReason: ProductOfflineReason.ORDER_RESERVED
    });
    tx.user.findUnique.mockResolvedValue({
      accountStatus: AccountStatus.ACTIVE
    });
    tx.conversation.findFirst.mockResolvedValue({ id: 3002 });
    tx.message.create.mockResolvedValue(undefined);
    tx.conversation.update.mockResolvedValue(undefined);

    const { service, outboxService } = createService(prisma);
    const result = await service.cancelOrder(93, {
      reason: ' 临时有事 '
    }, buyerUser);

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 93 },
      data: {
        status: OrderStatus.CANCELED,
        canceledAt: expect.any(Date),
        commerceSyncStatus: 'PENDING',
        commerceSyncError: null
      }
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 18 },
      data: {
        status: ProductStatus.ON_SALE,
        offlineReason: null
      }
    });

    const payload = readEventPayload(tx.message.create);
    expect(payload).toMatchObject({
      event: 'CANCELED',
      orderId: 93,
      productId: 18,
      title: '订单已取消',
      badge: '已取消'
    });
    expect(payload.summary).toContain('取消原因：临时有事');
    expect(outboxService.publishProductSearchEvent).toHaveBeenCalledWith({
      productId: 18,
      eventType: 'ProductStatusChanged',
      changedBy: 'orders',
      reason: 'ORDER_CANCELED'
    }, tx);
    expect(outboxService.publishProductCommerceSyncEvent).toHaveBeenCalledWith({
      productId: 18,
      eventType: 'ProductAvailabilityChanged'
    }, tx);
    expect(outboxService.publishProductCommerceSyncEvent).toHaveBeenCalledWith({
      productId: 18,
      eventType: 'ProductInventoryChanged'
    }, tx);
    expect(outboxService.publishOrderCommerceSyncEvent).toHaveBeenCalledWith({
      orderId: 93,
      eventType: 'OrderCanceled'
    }, tx);
    expect(result).toEqual(canceledOrder);
  });

  it('should not restore product on cancel when seller is banned', async () => {
    const { prisma, tx } = createPrisma();
    prisma.order.findUnique
      .mockResolvedValueOnce({
        id: 8,
        productId: 18,
        buyerId: 11,
        sellerId: 22,
        status: OrderStatus.PENDING,
        vendureOrderId: null
      })
      .mockResolvedValueOnce({
        id: 8,
        productId: 18,
        vendureOrderCode: null
      });
    tx.order.update.mockResolvedValue({
      id: 8,
      productId: 18,
      status: OrderStatus.CANCELED
    });
    tx.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    tx.product.findUnique.mockResolvedValue({
      id: 18,
      sellerId: 22,
      status: ProductStatus.OFFLINE,
      offlineReason: ProductOfflineReason.ORDER_RESERVED
    });
    tx.user.findUnique.mockResolvedValue({
      accountStatus: AccountStatus.BANNED
    });
    tx.conversation.findFirst.mockResolvedValue(null);
    tx.message.create.mockResolvedValue(undefined);

    const { service } = createService(prisma);
    await service.cancelOrder(8, { reason: '买家取消' }, buyerUser);

    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: {
        status: OrderStatus.CANCELED,
        canceledAt: expect.any(Date),
        commerceSyncStatus: 'PENDING',
        commerceSyncError: null
      }
    });
  });

  it('should not restore product on cancel when offline reason is not order reserved', async () => {
    const { prisma, tx } = createPrisma();
    prisma.order.findUnique
      .mockResolvedValueOnce({
        id: 9,
        productId: 28,
        buyerId: 11,
        sellerId: 22,
        status: OrderStatus.PENDING,
        vendureOrderId: null
      })
      .mockResolvedValueOnce({
        id: 9,
        productId: 28,
        vendureOrderCode: null
      });
    tx.order.update.mockResolvedValue({
      id: 9,
      productId: 28,
      status: OrderStatus.CANCELED
    });
    tx.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    tx.product.findUnique.mockResolvedValue({
      id: 28,
      sellerId: 22,
      status: ProductStatus.OFFLINE,
      offlineReason: ProductOfflineReason.REPORT_OFFLINE
    });
    tx.user.findUnique.mockResolvedValue({
      accountStatus: AccountStatus.ACTIVE
    });
    tx.conversation.findFirst.mockResolvedValue(null);
    tx.message.create.mockResolvedValue(undefined);

    const { service } = createService(prisma);
    await service.cancelOrder(9, { reason: '买家取消' }, buyerUser);

    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('should complete meetup, settle payment and mark order as waiting review', async () => {
    const existingOrder = createOrder({
      id: 94,
      status: OrderStatus.IN_PROGRESS,
      vendureOrderId: 'vendure-order-94'
    });
    const waitingReviewOrder = {
      ...existingOrder,
      status: OrderStatus.WAITING_REVIEW,
      completedAt: new Date('2026-06-12T11:00:00.000Z')
    };
    const { prisma, tx } = createPrisma();
    prisma.order.findUnique.mockResolvedValue(existingOrder);
    tx.order.findUnique
      .mockResolvedValueOnce(existingOrder)
      .mockResolvedValueOnce({
        id: 94,
        productId: 18,
        vendureOrderCode: null
      });
    tx.order.update.mockResolvedValue(waitingReviewOrder);
    tx.product.update.mockResolvedValue(undefined);
    tx.conversation.findFirst.mockResolvedValue({ id: 3003 });
    tx.message.create.mockResolvedValue(undefined);
    tx.conversation.update.mockResolvedValue(undefined);

    const { service, outboxService } = createService(prisma);
    const result = await service.completeMeetup(94, {}, buyerUser);

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 94 },
      data: {
        status: OrderStatus.WAITING_REVIEW,
        completedAt: expect.any(Date),
        commerceSyncStatus: 'PENDING',
        commerceSyncError: null
      }
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 18 },
      data: {
        status: ProductStatus.SOLD,
        offlineReason: null
      }
    });

    const payload = readEventPayload(tx.message.create);
    expect(payload).toMatchObject({
      event: 'BUYER_COMPLETED',
      orderId: 94,
      productId: 18,
      title: '买家已确认收货',
      badge: '待评价'
    });
    expect(outboxService.publishProductSearchEvent).toHaveBeenCalledWith({
      productId: 18,
      eventType: 'ProductStatusChanged',
      changedBy: 'orders',
      reason: 'ORDER_COMPLETED'
    }, tx);
    expect(outboxService.publishProductCommerceSyncEvent).toHaveBeenCalledWith({
      productId: 18,
      eventType: 'ProductAvailabilityChanged'
    }, tx);
    expect(outboxService.publishProductCommerceSyncEvent).toHaveBeenCalledWith({
      productId: 18,
      eventType: 'ProductInventoryChanged'
    }, tx);
    expect(outboxService.publishOrderCommerceSyncEvent).toHaveBeenCalledWith({
      orderId: 94,
      eventType: 'OrderPaymentSettled'
    }, tx);
    expect(outboxService.publishOrderCommerceSyncEvent).toHaveBeenCalledWith({
      orderId: 94,
      eventType: 'OrderFulfillmentCompleted'
    }, tx);
    expect(outboxService.publishOrderCommerceSyncEvent).toHaveBeenCalledWith({
      orderId: 94,
      eventType: 'OrderCompleted'
    }, tx);
    expect(result).toEqual(waitingReviewOrder);
  });

  it('should create review and close order as completed', async () => {
    const waitingReviewOrder = createOrder({
      id: 95,
      status: OrderStatus.WAITING_REVIEW
    });
    const completedOrder = {
      ...waitingReviewOrder,
      status: OrderStatus.COMPLETED
    };
    const review = {
      id: 601,
      orderId: 95,
      reviewerId: 11,
      rating: 5,
      content: '交易顺利'
    };
    const { prisma, tx } = createPrisma();
    tx.order.findUnique
      .mockResolvedValueOnce(waitingReviewOrder)
      .mockResolvedValueOnce({
        id: 95,
        productId: 18,
        vendureOrderCode: null
      });
    tx.review.findFirst.mockResolvedValue(null);
    tx.review.create.mockResolvedValue(review);
    tx.order.update.mockResolvedValue(completedOrder);
    tx.conversation.findFirst.mockResolvedValue({ id: 3004 });
    tx.message.create.mockResolvedValue(undefined);
    tx.conversation.update.mockResolvedValue(undefined);

    const { service } = createService(prisma);
    const result = await service.createReview(95, {
      rating: 5,
      content: '  交易顺利  '
    }, buyerUser);

    expect(tx.review.create).toHaveBeenCalledWith({
      data: {
        orderId: 95,
        reviewerId: 11,
        rating: 5,
        content: '交易顺利'
      }
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 95 },
      data: {
        status: OrderStatus.COMPLETED
      }
    });

    const payload = readEventPayload(tx.message.create);
    expect(payload).toMatchObject({
      event: 'REVIEW_CREATED',
      orderId: 95,
      productId: 18,
      title: '已提交评价',
      badge: '已评价'
    });
    expect(result).toEqual({
      order: completedOrder,
      review
    });
  });

  it('should derive detail action state from status and current user review record', async () => {
    const waitingReviewOrder = createOrder({
      id: 96,
      status: OrderStatus.WAITING_REVIEW
    });
    const completedOrder = createOrder({
      id: 97,
      status: OrderStatus.COMPLETED,
      completedAt: new Date('2026-06-15T10:00:00.000Z')
    });
    const buyerReview = {
      id: 701,
      rating: 5,
      content: '交易顺利',
      createdAt: new Date('2026-06-15T10:10:00.000Z'),
      reviewerId: 11,
      reviewer: {
        id: 11,
        displayName: '买家甲'
      }
    };
    const sellerReview = {
      id: 702,
      rating: 5,
      content: '买家守时',
      createdAt: new Date('2026-06-15T10:20:00.000Z'),
      reviewerId: 22,
      reviewer: {
        id: 22,
        displayName: '卖家乙'
      }
    };
    const product = createProduct();
    const buyer = {
      id: 11,
      displayName: '买家甲',
      avatarUrl: null,
      avatarFrame: null,
      creditScore: 90,
      verificationStatus: 'APPROVED'
    };
    const seller = {
      id: 22,
      displayName: '卖家乙',
      avatarUrl: null,
      avatarFrame: null,
      creditScore: 95,
      verificationStatus: 'APPROVED'
    };
    const { prisma } = createPrisma();
    prisma.order.findMany.mockResolvedValue([]);
    prisma.productImage.findMany.mockResolvedValue([
      { imageUrl: 'https://cdn.example.com/book-cover.jpg' }
    ]);
    prisma.conversation.findMany.mockResolvedValue([]);
    prisma.order.findUnique
      .mockResolvedValueOnce({
        ...waitingReviewOrder,
        product,
        buyer,
        seller,
        reviews: [],
        appeals: [],
        conversations: [{ id: 401 }]
      })
      .mockResolvedValueOnce({
        ...completedOrder,
        product,
        buyer,
        seller,
        reviews: [buyerReview, sellerReview],
        appeals: [],
        conversations: [{ id: 402 }]
      });

    const { service } = createService(prisma);
    const waitingReviewDetail = await service.getOrderDetail(96, buyerUser);
    const completedDetail = await service.getOrderDetail(97, buyerUser);

    expect(waitingReviewDetail.actionState).toMatchObject({
      canComplete: false,
      canReview: true,
      canAppeal: true,
      canOpenConversation: true
    });
    expect(completedDetail.actionState).toMatchObject({
      canComplete: false,
      canReview: false,
      canAppeal: true,
      canOpenConversation: true
    });
  });

  it('should reject duplicated review on the same order', async () => {
    const { prisma, tx } = createPrisma();
    tx.order.findUnique.mockResolvedValue(createOrder({
      id: 96,
      status: OrderStatus.WAITING_REVIEW
    }));
    tx.review.findFirst.mockResolvedValue({ id: 77 });

    const { service } = createService(prisma);

    await expect(service.createReview(96, {
      rating: 4,
      content: '还不错'
    }, buyerUser)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.review.create).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('should auto-complete expired orders during reconciliation', async () => {
    const expiredOrder = createOrder({
      id: 97,
      status: OrderStatus.IN_PROGRESS,
      vendureOrderId: 'vendure-order-97'
    });
    const reconciledOrder = {
      ...expiredOrder,
      status: OrderStatus.WAITING_REVIEW,
      completedAt: new Date('2026-06-15T08:00:00.000Z')
    };
    const { prisma, tx } = createPrisma();
    prisma.order.findMany.mockResolvedValue([
      {
        id: 97,
        productId: 18,
        vendureOrderId: 'vendure-order-97',
        buyerId: 11
      }
    ]);
    tx.order.findUnique
      .mockResolvedValueOnce(expiredOrder)
      .mockResolvedValueOnce({
        id: 97,
        productId: 18,
        vendureOrderCode: null
      });
    tx.order.update.mockResolvedValue(reconciledOrder);
    tx.product.update.mockResolvedValue(undefined);
    tx.conversation.findFirst.mockResolvedValue({ id: 3005 });
    tx.message.create.mockResolvedValue(undefined);
    tx.conversation.update.mockResolvedValue(undefined);

    const { service, outboxService } = createService(prisma);
    await (service as any).reconcileAutoConfirmedOrders(11);

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: {
        buyerId: 11,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS]
        },
        autoConfirmAt: {
          lte: expect.any(Date)
        }
      },
      select: {
        id: true,
        productId: true,
        vendureOrderId: true,
        buyerId: true
      }
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 97 },
      data: {
        status: OrderStatus.WAITING_REVIEW,
        completedAt: expect.any(Date),
        commerceSyncStatus: 'PENDING',
        commerceSyncError: null
      }
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 18 },
      data: {
        status: ProductStatus.SOLD,
        offlineReason: null
      }
    });

    const payload = readEventPayload(tx.message.create);
    expect(payload).toMatchObject({
      event: 'AUTO_COMPLETED',
      orderId: 97,
      productId: 18,
      title: '已自动确认收货',
      badge: '待评价'
    });
    expect(outboxService.publishProductSearchEvent).toHaveBeenCalledWith({
      productId: 18,
      eventType: 'ProductStatusChanged',
      changedBy: 'orders',
      reason: 'ORDER_AUTO_COMPLETED'
    }, tx);
    expect(outboxService.publishProductCommerceSyncEvent).toHaveBeenCalledWith({
      productId: 18,
      eventType: 'ProductAvailabilityChanged'
    }, tx);
    expect(outboxService.publishProductCommerceSyncEvent).toHaveBeenCalledWith({
      productId: 18,
      eventType: 'ProductInventoryChanged'
    }, tx);
    expect(outboxService.publishOrderCommerceSyncEvent).toHaveBeenCalledWith({
      orderId: 97,
      eventType: 'OrderPaymentSettled'
    }, tx);
    expect(outboxService.publishOrderCommerceSyncEvent).toHaveBeenCalledWith({
      orderId: 97,
      eventType: 'OrderFulfillmentCompleted'
    }, tx);
    expect(outboxService.publishOrderCommerceSyncEvent).toHaveBeenCalledWith({
      orderId: 97,
      eventType: 'OrderCompleted'
    }, tx);
  });
});
