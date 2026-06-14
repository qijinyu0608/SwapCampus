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
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
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
    content: string;
    type: string;
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
