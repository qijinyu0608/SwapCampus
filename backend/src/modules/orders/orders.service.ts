import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, OrderStatus, Prisma, ProductStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAuthenticatedUser } from '../auth/auth.utils';
import { SearchService } from '../search/search.service';
import { VendureService } from '../vendure/vendure.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CompleteOrderDto } from './dto/complete-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateMeetupDto } from './dto/update-meetup.dto';

const activeOrderStatuses = [
  OrderStatus.PENDING,
  OrderStatus.IN_PROGRESS,
  OrderStatus.WAITING_REVIEW
];

function buildOrderConfirmationNote(payload: CreateOrderDto, productTitle: string) {
  return [
    payload.note?.trim() || `想约“${productTitle}”当面交易`,
    payload.meetupTime?.trim() ? `交易时间：${payload.meetupTime.trim()}` : null,
    payload.paymentIntent?.trim() ? `支付方式：${payload.paymentIntent.trim()}（示意，暂不真实支付）` : null
  ].filter((item): item is string => Boolean(item)).join('\n');
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SearchService)
    private readonly searchService: SearchService,
    @Inject(VendureService)
    private readonly vendureService: VendureService
  ) {}

  async createOrder(payload: CreateOrderDto, currentUser: AuthenticatedUser) {
    const buyerUser = requireAuthenticatedUser(currentUser);
    const [product, buyer] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: payload.productId }
      }),
      this.prisma.user.findUnique({
        where: { id: buyerUser.id },
        select: { id: true, vendureCustomerId: true, displayName: true, email: true, accountStatus: true }
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

    const [vendureProduct, vendureCustomer] = await Promise.all([
      this.vendureService.ensureProductVariant(product),
      this.vendureService.ensureCustomer(buyer)
    ]);

    if (!product.vendureProductId || !product.vendureVariantId) {
      await this.prisma.product.update({
        where: { id: product.id },
        data: {
          vendureProductId: vendureProduct.id,
          vendureVariantId: vendureProduct.variantId
        }
      });
    }

    if (!buyer.vendureCustomerId) {
      await this.prisma.user.update({
        where: { id: buyer.id },
        data: {
          vendureCustomerId: vendureCustomer.id
        }
      });
    }

    const orderNote = buildOrderConfirmationNote(payload, product.title);
    const vendureOrder = await this.vendureService.createPlacedOrder({
      customerId: vendureCustomer.id,
      productVariantId: vendureProduct.variantId,
      note: orderNote || `SwapCampus 商品 ${product.id} 购买订单`
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          vendureOrderId: vendureOrder.id,
          vendureOrderCode: vendureOrder.code,
          productId: product.id,
          buyerId: buyerUser.id,
          sellerId: product.sellerId,
          meetupLocation: payload.meetupLocation?.trim() || null,
          note: orderNote || null,
          status: OrderStatus.PENDING
        }
      });

      await tx.product.update({
        where: { id: product.id },
        data: { status: ProductStatus.OFFLINE }
      });

      const conversation = await tx.conversation.create({
        data: {
          orderId: order.id,
          productId: product.id
        }
      });

      await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: buyerUser.id,
          content: orderNote || `你好，我想买“${product.title}”，可以约线下面交吗？`
        }
      });

      return order;
    });

    await this.searchService.syncProduct(payload.productId);
    return result;
  }

  async listOrders(params?: {
    currentUser?: AuthenticatedUser;
    page?: number;
    pageSize?: number;
  }) {
    const authUser = requireAuthenticatedUser(params?.currentUser);
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
            select: { id: true, displayName: true, creditScore: true, verificationStatus: true }
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

    return {
      items: orders.map((order) => {
        const product = productMap.get(order.productId);
        const buyer = userMap.get(order.buyerId);
        const seller = userMap.get(order.sellerId);

        return {
          ...order,
          externalOrderId: order.vendureOrderId,
          externalOrderCode: order.vendureOrderCode,
          productTitle: product?.title ?? `商品#${order.productId}`,
          productPrice: product ? Number(product.price) : null,
          productCategory: product?.category ?? null,
          productCondition: product?.condition ?? null,
          productStatus: product?.status ?? null,
          productImageUrl: firstImageMap.get(order.productId) ?? null,
          conversationId: conversationMap.get(order.id) ?? null,
          buyerName: buyer?.displayName ?? `用户#${order.buyerId}`,
          buyerCreditScore: buyer?.creditScore ?? null,
          buyerVerified: buyer?.verificationStatus === VerificationStatus.APPROVED,
          sellerName: seller?.displayName ?? `用户#${order.sellerId}`,
          sellerCreditScore: seller?.creditScore ?? null,
          sellerVerified: seller?.verificationStatus === VerificationStatus.APPROVED
        };
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total ? Math.ceil(total / pageSize) : 1
      }
    };
  }

  async confirmMeetup(orderId: number, payload: UpdateMeetupDto, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const result = await this.prisma.$transaction(async (tx) => {
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

      await this.appendOrderMessage(tx, orderId, authUser.id, [
        '已确认线下面交安排。',
        nextLocation ? `面交地点：${nextLocation}` : null,
        nextNote ? `备注：${nextNote}` : null
      ].filter((item): item is string => Boolean(item)).join('\n'));

      return updated;
    });

    await this.searchService.syncProduct(result.productId);
    return result;
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

    if (existingOrder.vendureOrderId) {
      await this.vendureService.cancelOrder(existingOrder.vendureOrderId, payload.reason);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELED }
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

      if (!activeOrder && !finishedOrder) {
        await tx.product.update({
          where: { id: existingOrder.productId },
          data: { status: ProductStatus.ON_SALE }
        });
      }

      await this.appendOrderMessage(
        tx,
        orderId,
        authUser.id,
        `订单已取消。${payload.reason?.trim() ? `原因：${payload.reason.trim()}` : '双方可重新沟通后再次下单。'}`
      );

      return updated;
    });

    await this.searchService.syncProduct(result.productId);
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

    this.assertParticipant(existingOrder, authUser.id);

    if (existingOrder.status !== OrderStatus.IN_PROGRESS) {
      throw new BadRequestException('只有已约定面交的订单才能确认完成');
    }

    if (existingOrder.vendureOrderId) {
      await this.vendureService.settleOrderPayment(existingOrder.vendureOrderId);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.WAITING_REVIEW }
      });

      await tx.product.update({
        where: { id: existingOrder.productId },
        data: { status: ProductStatus.SOLD }
      });

      await this.appendOrderMessage(tx, orderId, authUser.id, '线下面交已完成，订单进入待评价。');

      return updated;
    });

    await this.searchService.syncProduct(result.productId);
    return result;
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

      await this.appendOrderMessage(tx, orderId, authUser.id, `已完成评价：${payload.rating} 星。`);

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

  private async appendOrderMessage(
    tx: Prisma.TransactionClient,
    orderId: number,
    senderId: number,
    content: string
  ) {
    const conversation = await tx.conversation.findFirst({
      where: { orderId },
      select: { id: true }
    });

    if (!conversation) {
      return;
    }

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        content
      }
    });

    await tx.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() }
    });
  }
}
