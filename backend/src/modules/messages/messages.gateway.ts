import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import Session from 'supertokens-node/recipe/session';
import { MessageType, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { hasAvatarFrameRewardUnlocked, hasTrustedBadgeRewardUnlocked } from '../credit-center/credit-center.utils';
import {
  collectConversationParticipantIds,
  messageConversationAccessInclude,
  type MessageConversationAccessRecord
} from './message-conversation.helpers';

type NewMessageEvent = {
  conversationId: number;
  message: {
    id: number;
    senderId: number;
    senderName: string;
    senderAvatarUrl?: string | null;
    senderAvatarFrame?: string | null;
    senderTrustedBadgeUnlocked?: boolean;
    content: string;
    type: string;
    attachment?: Record<string, unknown> | null;
    previewText?: string;
    createdAt: Date;
  };
};

type SocketWithAuth = Socket & {
  data: {
    user?: AuthenticatedUser;
  };
};

@Injectable()
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: false
  }
})
export class MessagesGateway implements OnGatewayConnection {
  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async handleConnection(client: SocketWithAuth) {
    try {
      const token = this.extractAccessToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const session = await Session.getSessionWithoutRequestResponse(token, undefined, {
        checkDatabase: true
      });

      if (!session) {
        client.disconnect(true);
        return;
      }

      const accessTokenPayload = session.getAccessTokenPayload();
      client.data.user = {
        id: Number(accessTokenPayload.userId),
        supertokensUserId: String(session.getUserId()),
        studentId: typeof accessTokenPayload.studentId === 'string' ? accessTokenPayload.studentId : null,
        displayName: typeof accessTokenPayload.displayName === 'string' ? accessTokenPayload.displayName : undefined,
        email: String(accessTokenPayload.email ?? ''),
        role: (accessTokenPayload.role as UserRole) ?? UserRole.USER
      };
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('message:join')
  async joinConversation(
    @MessageBody() payload: { conversationId?: number },
    @ConnectedSocket() client: SocketWithAuth
  ) {
    const authUser = client.data.user;
    if (!authUser) {
      throw new UnauthorizedException('请先登录');
    }

    if (!payload.conversationId) {
      return;
    }

    const accessContext = await this.getConversationAccessContext(payload.conversationId);
    if (!accessContext || !accessContext.participantIds.has(authUser.id)) {
      throw new UnauthorizedException('无权加入此会话');
    }

    if (
      accessContext.conversation.productId &&
      accessContext.conversation.initiatorId &&
      accessContext.conversation.messages.length === 0 &&
      accessContext.conversation.initiatorId !== authUser.id
    ) {
      throw new UnauthorizedException('无权加入此会话');
    }

    client.join(this.getConversationRoom(payload.conversationId));
  }

  emitNewMessage(event: NewMessageEvent) {
    this.server
      .to(this.getConversationRoom(event.conversationId))
      .emit('message:new', event);
  }

  async emitMessageById(conversationId: number, messageId: number) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            displayName: true,
            avatarUrl: true,
            avatarFrame: true
          }
        }
      }
    });

    if (!message) {
      return;
    }

    const [avatarFrameUnlocked, trustedBadgeUnlocked] = await Promise.all([
      hasAvatarFrameRewardUnlocked(this.prisma, message.senderId),
      hasTrustedBadgeRewardUnlocked(this.prisma, message.senderId)
    ]);

    this.emitNewMessage({
      conversationId,
      message: this.mapRealtimeMessage(message, { avatarFrameUnlocked, trustedBadgeUnlocked })
    });
  }

  private extractAccessToken(client: Socket) {
    const authHeader = client.handshake.auth?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }

    const fallbackToken = client.handshake.auth?.accessToken;
    if (typeof fallbackToken === 'string' && fallbackToken.trim()) {
      return fallbackToken.trim();
    }

    return undefined;
  }

  private getConversationRoom(conversationId: number) {
    return `conversation:${conversationId}`;
  }

  private getMessagePreview(type: MessageType, content: string) {
    if (type === MessageType.IMAGE) {
      return '[图片]';
    }

    if (type === MessageType.VIDEO) {
      return '[视频]';
    }

    if (type === MessageType.ORDER_EVENT) {
      return '[订单动态]';
    }

    return content;
  }

  private parseAttachment(type: MessageType, content: string) {
    if (type !== MessageType.IMAGE && type !== MessageType.VIDEO) {
      return null;
    }

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (
        typeof parsed.objectKey !== 'string'
        || typeof parsed.url !== 'string'
        || typeof parsed.mimeType !== 'string'
        || typeof parsed.size !== 'number'
      ) {
        return null;
      }

      return {
        kind: type === MessageType.IMAGE ? 'image' : 'video',
        objectKey: parsed.objectKey,
        url: parsed.url,
        mimeType: parsed.mimeType,
        size: parsed.size,
        width: typeof parsed.width === 'number' ? parsed.width : undefined,
        height: typeof parsed.height === 'number' ? parsed.height : undefined,
        originalName: typeof parsed.originalName === 'string' ? parsed.originalName : undefined
      };
    } catch {
      return null;
    }
  }

  private parseOrderEvent(type: MessageType, content: string) {
    if (type !== MessageType.ORDER_EVENT) {
      return null;
    }

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (
        parsed.kind !== 'product-order-event'
        || typeof parsed.orderId !== 'number'
        || typeof parsed.productId !== 'number'
        || typeof parsed.title !== 'string'
        || typeof parsed.summary !== 'string'
      ) {
        return null;
      }

      return {
        kind: 'product-order-event' as const,
        event: typeof parsed.event === 'string' ? parsed.event : 'CREATED',
        title: parsed.title,
        summary: parsed.summary,
        orderId: parsed.orderId,
        productId: parsed.productId,
        orderCode: typeof parsed.orderCode === 'string' ? parsed.orderCode : '',
        actionLabel: typeof parsed.actionLabel === 'string' || parsed.actionLabel === null ? parsed.actionLabel : null,
        actionTarget: typeof parsed.actionTarget === 'string' || parsed.actionTarget === null ? parsed.actionTarget : null,
        badge: typeof parsed.badge === 'string' || parsed.badge === null ? parsed.badge : null,
        meta: Array.isArray(parsed.meta)
          ? parsed.meta.filter((item): item is { label: string; value: string } => Boolean(item) && typeof item === 'object' && typeof (item as any).label === 'string' && typeof (item as any).value === 'string')
          : []
      };
    } catch {
      return null;
    }
  }

  private mapRealtimeMessage(message: {
    id: number;
    senderId: number;
    content: string;
    type: MessageType;
    createdAt: Date;
    sender: {
      displayName: string;
      avatarUrl: string | null;
      avatarFrame: string | null;
    };
  }, options: { avatarFrameUnlocked: boolean; trustedBadgeUnlocked: boolean }) {
    return {
      id: message.id,
      senderId: message.senderId,
      senderName: message.sender.displayName,
      senderAvatarUrl: message.sender.avatarUrl ?? null,
      senderAvatarFrame: options.avatarFrameUnlocked ? (message.sender.avatarFrame ?? null) : null,
      senderTrustedBadgeUnlocked: options.trustedBadgeUnlocked,
      content: message.type === MessageType.TEXT || message.type === MessageType.EMOJI ? message.content : '',
      type: message.type,
      attachment: this.parseAttachment(message.type, message.content),
      orderEvent: this.parseOrderEvent(message.type, message.content),
      previewText: this.getMessagePreview(message.type, message.content),
      createdAt: message.createdAt
    };
  }

  private async getConversationAccessContext(conversationId: number) {
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

    return {
      conversation,
      participantIds: collectConversationParticipantIds({
        conversation: conversation as MessageConversationAccessRecord,
        productSellerId: product?.sellerId ?? null
      })
    };
  }
}
