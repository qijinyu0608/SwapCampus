import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  CampusServiceCategory,
  CampusServiceListingStatus,
  CampusServiceOrderStatus
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAuthenticatedUser } from '../auth/auth.utils';
import { SearchService } from '../search/search.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { MessagesGateway } from './messages.gateway';
import {
  collectConversationParticipantIds,
  messageConversationAccessInclude,
  resolveCampusConversationParticipants,
  type MessageConversationAccessRecord
} from './message-conversation.helpers';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(MessagesGateway)
    private readonly messagesGateway: MessagesGateway
  ) {}

  private mapCampusConversationStatus(params: {
    listingStatus: CampusServiceListingStatus | null;
    orderStatus: CampusServiceOrderStatus | null;
  }) {
    const { listingStatus, orderStatus } = params;
    if (listingStatus === CampusServiceListingStatus.CANCELED || orderStatus === CampusServiceOrderStatus.CANCELED || orderStatus === CampusServiceOrderStatus.EXPIRED) {
      return 'CANCELED' as const;
    }

    if (orderStatus === CampusServiceOrderStatus.COMPLETED) {
      return 'DONE' as const;
    }

    if (
      orderStatus === CampusServiceOrderStatus.PENDING_CONFIRMATION
      || orderStatus === CampusServiceOrderStatus.CONFIRMED
      || orderStatus === CampusServiceOrderStatus.WAITING_COMPLETE_CONFIRM
    ) {
      return 'MATCHED' as const;
    }

    return listingStatus === CampusServiceListingStatus.ENDED ? 'DONE' as const : 'OPEN' as const;
  }

  private mapCampusConversationStatusLabel(status: ReturnType<MessagesService['mapCampusConversationStatus']>) {
    switch (status) {
      case 'OPEN':
        return '可参与';
      case 'MATCHED':
        return '进行中';
      case 'DONE':
        return '已完成';
      case 'CANCELED':
        return '已取消';
      default:
        return status;
    }
  }

  private mapCampusServiceCategoryLabel(category: CampusServiceCategory) {
    switch (category) {
      case 'ERRAND':
        return '跑腿';
      case 'AGENCY':
        return '代办';
      case 'GROUP_BUY':
        return '拼单';
      case 'MOVING':
        return '搬运';
      case 'TUTORING':
        return '辅导';
      case 'SKILL':
        return '技能';
      case 'REPAIR':
        return '维修';
      case 'EVENT':
        return '活动协助';
      case 'OTHER':
        return '其他';
      case 'HELP':
        return '帮忙';
      default:
        return category;
    }
  }

  private isBuyerOnlyDraftConversation(conversation: Pick<MessageConversationAccessRecord, 'productId' | 'initiatorId' | 'messages'>) {
    return Boolean(conversation.productId && conversation.initiatorId && conversation.messages.length === 0);
  }

  async listConversations(currentUser?: AuthenticatedUser) {
    const userId = currentUser?.id;
    const sellerProductIds = userId
      ? (await this.prisma.product.findMany({
          where: { sellerId: userId },
          select: { id: true }
        })).map((item) => item.id)
      : [];

    const conversations = await this.prisma.conversation.findMany({
      where: userId
        ? {
            OR: [
              { initiatorId: userId },
              { order: { is: { buyerId: userId } } },
              { order: { is: { sellerId: userId } } },
              { campusServiceOrder: { is: { requesterId: userId } } },
              { campusServiceOrder: { is: { providerId: userId } } },
              { messages: { some: { senderId: userId } } },
              ...(sellerProductIds.length
                ? [{
                    AND: [
                      { productId: { in: sellerProductIds } },
                      { messages: { some: {} } }
                    ]
                  }]
                : [])
            ]
          }
        : undefined,
      include: {
        campusServiceOrder: {
          select: {
            id: true,
            requesterId: true,
            providerId: true,
            status: true,
            finalAmount: true,
            listing: {
              select: {
                id: true,
                intent: true,
                title: true,
                category: true,
                amount: true,
                routeFrom: true,
                routeTo: true,
                locationNote: true,
                validUntilAt: true,
                estimatedMinutes: true,
                status: true,
                ownerId: true
              }
            }
          }
        },
        order: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                displayName: true,
                verification: {
                  select: {
                    college: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 20
    });

    const productIds = Array.from(
      new Set(conversations.map((conversation) => conversation.productId).filter((value): value is number => Boolean(value)))
    );

    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            sellerId: true,
            title: true,
            price: true,
            category: true,
            condition: true,
            status: true
          }
        })
      : [];

    const productImages = productIds.length
      ? await this.prisma.productImage.findMany({
          where: { productId: { in: productIds } },
          orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }],
          select: {
            productId: true,
            imageUrl: true
          }
        })
      : [];

    const productSellerMap = new Map(products.map((product) => [product.id, product.sellerId]));
    const participantIds = Array.from(
      new Set([
        ...conversations.flatMap((conversation) => Array.from(collectConversationParticipantIds({
          conversation: conversation as MessageConversationAccessRecord,
          productSellerId: conversation.productId ? productSellerMap.get(conversation.productId) ?? null : null
        })))
      ].filter((value): value is number => Boolean(value)))
    );

    const users = participantIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: participantIds } },
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            verification: {
              select: {
                college: true
              }
            }
          }
        })
      : [];

    const productMap = new Map(products.map((product) => [product.id, product]));
    const firstImageByProductId = new Map<number, string>();
    productImages.forEach((image) => {
      if (!firstImageByProductId.has(image.productId)) {
        firstImageByProductId.set(image.productId, image.imageUrl);
      }
    });
    const userMap = new Map(users.map((user) => [user.id, user]));

    return conversations.map((conversation) => {
      const latestMessage = conversation.messages[0] ?? null;
      const product = conversation.productId ? productMap.get(conversation.productId) ?? null : null;
      const productSellerId = product?.sellerId ?? conversation.order?.sellerId ?? null;
      const campusOrder = conversation.campusServiceOrder;
      const campusListing = campusOrder?.listing ?? null;
      const campusParticipants = resolveCampusConversationParticipants({ campusServiceOrder: campusOrder });
      const campusPublisherId = campusParticipants.publisherId;
      const campusParticipantId = campusParticipants.participantId;
      const selfRole = this.resolveSelfRole(
        userId,
        conversation.order?.buyerId,
        productSellerId,
        campusParticipantId,
        campusPublisherId
      );
      const counterpartId = this.resolveCounterpartId({
        currentUserId: userId,
        productSellerId,
        buyerId: conversation.order?.buyerId ?? null,
        sellerId: conversation.order?.sellerId ?? null,
        latestSenderId: latestMessage?.senderId ?? null,
        campusPublisherId,
        campusParticipantId
      });
      const counterpart = counterpartId ? userMap.get(counterpartId) ?? null : null;
      const campusServiceSnapshot = campusListing
        ? {
            title: campusListing.title,
            category: campusListing.category,
            reward: campusOrder?.finalAmount ?? campusListing.amount ?? 0,
            locationFrom: campusListing.routeFrom ?? campusListing.locationNote ?? '待协商',
            locationTo: campusListing.routeTo ?? campusListing.locationNote ?? '待协商',
            deadlineLabel: campusListing.validUntilAt.toISOString().slice(0, 16).replace('T', ' '),
            estimatedMinutes: campusListing.estimatedMinutes,
            status: this.mapCampusConversationStatus({
              listingStatus: campusListing.status,
              orderStatus: campusOrder?.status ?? null
            })
          }
        : null;
      const campusServiceDisplay = campusServiceSnapshot
        ? {
            title: campusServiceSnapshot.title,
            category: campusServiceSnapshot.category,
            categoryLabel: this.mapCampusServiceCategoryLabel(campusServiceSnapshot.category),
            intent: campusListing?.intent ?? null,
            intentLabel: campusListing
              ? (campusListing.ownerId === campusOrder?.requesterId ? '找人帮我' : '我来提供')
              : null,
            reward: Number(campusServiceSnapshot.reward),
            routeLabel: `${campusServiceSnapshot.locationFrom} -> ${campusServiceSnapshot.locationTo}`,
            locationFrom: campusServiceSnapshot.locationFrom,
            locationTo: campusServiceSnapshot.locationTo,
            deadlineLabel: campusServiceSnapshot.deadlineLabel,
            estimatedMinutes: campusServiceSnapshot.estimatedMinutes,
            status: campusServiceSnapshot.status,
            statusLabel: this.mapCampusConversationStatusLabel(campusServiceSnapshot.status)
          }
        : null;

      return {
        id: conversation.id,
        orderId: conversation.orderId,
        productId: conversation.productId,
        campusServiceOrderId: campusOrder?.id ?? null,
        campusServiceListing: campusListing
          ? {
              id: campusListing.id,
              title: campusListing.title,
              category: campusListing.category,
              intent: campusListing.intent,
              intentLabel: campusListing.ownerId === campusOrder?.requesterId ? '找人帮我' : '我来提供',
              reward: Number(campusOrder?.finalAmount ?? campusListing.amount ?? 0),
              locationFrom: campusListing.routeFrom ?? campusListing.locationNote ?? '待协商',
              locationTo: campusListing.routeTo ?? campusListing.locationNote ?? '待协商',
              deadlineLabel: campusListing.validUntilAt.toISOString().slice(0, 16).replace('T', ' '),
              estimatedMinutes: campusListing.estimatedMinutes,
              status: this.mapCampusConversationStatus({
                listingStatus: campusListing.status,
                orderStatus: campusOrder?.status ?? null
              })
            }
          : null,
        campusServiceDisplay,
        preview: latestMessage?.content ?? '点击查看消息',
        updatedAt: conversation.updatedAt,
        latestMessageSenderId: latestMessage?.senderId ?? null,
        latestMessageAt: latestMessage?.createdAt ?? conversation.updatedAt,
        selfRole,
        participant: {
          id: counterpart?.id ?? counterpartId ?? null,
          displayName: counterpart?.displayName ?? '同校同学',
          avatarUrl: counterpart?.avatarUrl ?? null,
          college: counterpart?.verification?.college ?? null,
          isSeller: Boolean(productSellerId && counterpartId === productSellerId)
        },
        product: product
          ? {
              id: product.id,
              title: product.title,
              price: Number(product.price),
              category: product.category,
              condition: product.condition,
              imageUrl: firstImageByProductId.get(product.id) ?? null,
              status: product.status,
              meetupLocation: conversation.order?.meetupLocation ?? null
            }
          : null
      };
    });
  }

  async createConversation(dto: CreateConversationDto, currentUser: AuthenticatedUser) {
    const buyerUser = requireAuthenticatedUser(currentUser);
    const [product, buyer] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: dto.productId }
      }),
      this.prisma.user.findUnique({
        where: { id: buyerUser.id },
        select: { id: true, accountStatus: true }
      })
    ]);

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    if (!buyer) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (buyer.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法发起会话');
    }

    if (buyer.id === product.sellerId) {
      throw new BadRequestException('不能和自己发起会话');
    }

    const initialMessage = dto.initialMessage?.trim();

    const existing = await this.prisma.conversation.findFirst({
      where: {
        productId: dto.productId,
        initiatorId: buyerUser.id
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (existing) {
      return {
        id: existing.id,
        productId: existing.productId,
        reused: true
      };
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        productId: dto.productId,
        initiatorId: buyerUser.id
      }
    });

    if (initialMessage) {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: buyerUser.id,
          content: initialMessage
        }
      });
    }

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() }
    });

    return {
      id: conversation.id,
      productId: conversation.productId,
      reused: false
    };
  }

  async getConversationMessages(id: number, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const accessContext = await this.getConversationAccessContext(id);
    if (!accessContext) {
      return [];
    }

    if (!accessContext.participantIds.has(authUser.id)) {
      throw new ForbiddenException('无权查看此会话');
    }

    if (
      this.isBuyerOnlyDraftConversation(accessContext.conversation as MessageConversationAccessRecord) &&
      accessContext.conversation.initiatorId !== authUser.id
    ) {
      throw new ForbiddenException('无权查看此会话');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
          }
        }
      });

    if (!conversation) {
      return [];
    }

    return conversation.messages.map((message) => ({
      id: message.id,
      senderId: message.senderId,
      senderName: message.sender.displayName,
      senderAvatarUrl: message.sender.avatarUrl ?? null,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt
    }));
  }

  async sendMessage(conversationId: number, dto: SendMessageDto, currentUser: AuthenticatedUser) {
    const authUser = requireAuthenticatedUser(currentUser);
    const [sender, accessContext] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, accountStatus: true, displayName: true, avatarUrl: true }
      }),
      this.getConversationAccessContext(conversationId)
    ]);

    if (!sender) {
      throw new BadRequestException('登录状态已失效，请重新登录');
    }

    if (sender.accountStatus === AccountStatus.BANNED) {
      throw new ForbiddenException('账号已被封禁，无法发送消息');
    }

    if (!accessContext) {
      throw new NotFoundException('会话不存在');
    }

    if (!accessContext.participantIds.has(authUser.id)) {
      throw new ForbiddenException('当前账号无权发送此会话消息');
    }

    if (
      this.isBuyerOnlyDraftConversation(accessContext.conversation as MessageConversationAccessRecord) &&
      accessContext.conversation.initiatorId !== authUser.id
    ) {
      throw new ForbiddenException('当前账号无权发送此会话消息');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: authUser.id,
        content: dto.content
      }
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    const response = {
      id: message.id,
      senderId: message.senderId,
      senderName: sender.displayName,
      senderAvatarUrl: sender.avatarUrl ?? null,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt
    };

    this.messagesGateway.emitNewMessage({
      conversationId,
      message: response
    });

    return response;
  }

  private resolveSelfRole(
    currentUserId?: number,
    buyerId?: number | null,
    sellerId?: number | null,
    campusParticipantId?: number | null,
    campusPublisherId?: number | null
  ) {
    if (!currentUserId) {
      return null;
    }

    if (sellerId === currentUserId) {
      return 'seller';
    }

    if (buyerId === currentUserId) {
      return 'buyer';
    }

    if (campusPublisherId === currentUserId) {
      return 'seller';
    }

    if (campusParticipantId === currentUserId) {
      return 'buyer';
    }

    return null;
  }

  private resolveCounterpartId(params: {
    currentUserId?: number;
    buyerId: number | null;
    sellerId: number | null;
    productSellerId: number | null;
    latestSenderId: number | null;
    campusPublisherId: number | null;
    campusParticipantId: number | null;
  }) {
    const {
      currentUserId,
      buyerId,
      sellerId,
      productSellerId,
      latestSenderId,
      campusPublisherId,
      campusParticipantId
    } = params;

    if (currentUserId) {
      if (buyerId === currentUserId && sellerId) {
        return sellerId;
      }

      if (sellerId === currentUserId && buyerId) {
        return buyerId;
      }

      if (productSellerId === currentUserId && latestSenderId && latestSenderId !== currentUserId) {
        return latestSenderId;
      }

      if (productSellerId && productSellerId !== currentUserId) {
        return productSellerId;
      }

      if (latestSenderId && latestSenderId !== currentUserId) {
        return latestSenderId;
      }

      if (campusPublisherId === currentUserId && campusParticipantId) {
        return campusParticipantId;
      }

      if (campusParticipantId === currentUserId && campusPublisherId) {
        return campusPublisherId;
      }
    }

    return sellerId ?? buyerId ?? productSellerId ?? campusParticipantId ?? campusPublisherId ?? latestSenderId ?? null;
  }

  async getConversationAccessContext(conversationId: number) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: messageConversationAccessInclude
    });

    if (!conversation) {
      return null;
    }

    const product = conversation.productId
      ? await this.prisma.product.findUnique({
          where: { id: conversation.productId },
          select: {
            sellerId: true
          }
        })
      : null;

    const participantIds = collectConversationParticipantIds({
      conversation: conversation as MessageConversationAccessRecord,
      productSellerId: product?.sellerId ?? null
    });

    return {
      conversation,
      participantIds
    };
  }
}
