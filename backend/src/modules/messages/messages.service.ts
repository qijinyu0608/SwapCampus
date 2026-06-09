import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { requireAuthenticatedUser } from '../auth/auth.utils';
import { SearchService } from '../search/search.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { MessagesGateway } from './messages.gateway';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(MessagesGateway)
    private readonly messagesGateway: MessagesGateway
  ) {}

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
              { order: { is: { buyerId: userId } } },
              { order: { is: { sellerId: userId } } },
              { campusServiceTask: { is: { publisherId: userId } } },
              { campusServiceTask: { is: { accepterId: userId } } },
              { messages: { some: { senderId: userId } } },
              ...(sellerProductIds.length ? [{ productId: { in: sellerProductIds } }] : [])
            ]
          }
        : undefined,
      include: {
        campusServiceTask: {
          select: {
            id: true,
            title: true,
            category: true,
            reward: true,
            locationFrom: true,
            locationTo: true,
            deadlineLabel: true,
            estimatedMinutes: true,
            status: true,
            publisherId: true,
            accepterId: true
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

    const participantIds = Array.from(
      new Set([
        ...products.map((product) => product.sellerId),
        ...conversations.flatMap((conversation) => [
          conversation.order?.buyerId,
          conversation.order?.sellerId,
          conversation.messages[0]?.senderId,
          conversation.campusServiceTask?.publisherId,
          conversation.campusServiceTask?.accepterId
        ])
      ].filter((value): value is number => Boolean(value)))
    );

    const users = participantIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: participantIds } },
          select: {
            id: true,
            displayName: true,
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
      const campusPublisherId = conversation.campusServiceTask?.publisherId ?? null;
      const campusAccepterId = conversation.campusServiceTask?.accepterId ?? null;
      const selfRole = this.resolveSelfRole(
        userId,
        conversation.order?.buyerId,
        productSellerId,
        campusAccepterId,
        campusPublisherId
      );
      const counterpartId = this.resolveCounterpartId({
        currentUserId: userId,
        productSellerId,
        buyerId: conversation.order?.buyerId ?? null,
        sellerId: conversation.order?.sellerId ?? null,
        latestSenderId: latestMessage?.senderId ?? null,
        campusPublisherId,
        campusAccepterId
      });
      const counterpart = counterpartId ? userMap.get(counterpartId) ?? null : null;

      return {
        id: conversation.id,
        orderId: conversation.orderId,
        productId: conversation.productId,
        campusServiceTaskId: conversation.campusServiceTask?.id ?? null,
        campusServiceTaskTitle: conversation.campusServiceTask?.title ?? null,
        campusServiceTask: conversation.campusServiceTask
          ? {
              id: conversation.campusServiceTask.id,
              title: conversation.campusServiceTask.title,
              category: conversation.campusServiceTask.category,
              reward: Number(conversation.campusServiceTask.reward),
              locationFrom: conversation.campusServiceTask.locationFrom,
              locationTo: conversation.campusServiceTask.locationTo,
              deadlineLabel: conversation.campusServiceTask.deadlineLabel,
              estimatedMinutes: conversation.campusServiceTask.estimatedMinutes,
              status: conversation.campusServiceTask.status
            }
          : null,
        preview: latestMessage?.content ?? '点击查看消息',
        updatedAt: conversation.updatedAt,
        latestMessageSenderId: latestMessage?.senderId ?? null,
        latestMessageAt: latestMessage?.createdAt ?? conversation.updatedAt,
        selfRole,
        participant: {
          id: counterpart?.id ?? counterpartId ?? null,
          displayName: counterpart?.displayName ?? '同校同学',
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

    const existing = await this.prisma.conversation.findFirst({
      where: {
        productId: dto.productId,
        messages: {
          some: {
            senderId: buyerUser.id
          }
        }
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
        productId: dto.productId
      }
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: buyerUser.id,
        content: dto.initialMessage?.trim() || '你好，这件商品还在吗？'
      }
    });

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

    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                displayName: true
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
        select: { id: true, accountStatus: true, displayName: true }
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
    campusBuyerId?: number | null,
    campusSellerId?: number | null
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

    if (campusSellerId === currentUserId) {
      return 'seller';
    }

    if (campusBuyerId === currentUserId) {
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
    campusAccepterId: number | null;
  }) {
    const {
      currentUserId,
      buyerId,
      sellerId,
      productSellerId,
      latestSenderId,
      campusPublisherId,
      campusAccepterId
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

      if (campusPublisherId === currentUserId && campusAccepterId) {
        return campusAccepterId;
      }

      if (campusAccepterId === currentUserId && campusPublisherId) {
        return campusPublisherId;
      }
    }

    return sellerId ?? buyerId ?? productSellerId ?? campusAccepterId ?? campusPublisherId ?? latestSenderId ?? null;
  }

  async getConversationAccessContext(conversationId: number) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        campusServiceTask: {
          select: {
            publisherId: true,
            accepterId: true
          }
        },
        order: true,
        messages: {
          select: {
            senderId: true
          }
        }
      }
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

    const participantIds = new Set<number>();

    if (conversation.order?.buyerId) {
      participantIds.add(conversation.order.buyerId);
    }

    if (conversation.order?.sellerId) {
      participantIds.add(conversation.order.sellerId);
    }

    if (product?.sellerId) {
      participantIds.add(product.sellerId);
    }

    if (conversation.campusServiceTask?.publisherId) {
      participantIds.add(conversation.campusServiceTask.publisherId);
    }

    if (conversation.campusServiceTask?.accepterId) {
      participantIds.add(conversation.campusServiceTask.accepterId);
    }

    conversation.messages.forEach((message) => {
      participantIds.add(message.senderId);
    });

    return {
      conversation,
      participantIds
    };
  }
}
