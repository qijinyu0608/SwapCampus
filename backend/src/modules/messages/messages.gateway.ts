import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

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

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: false
  }
})
export class MessagesGateway {
  @WebSocketServer()
  private readonly server!: Server;

  @SubscribeMessage('message:join')
  joinConversation(
    @MessageBody() payload: { conversationId?: number },
    @ConnectedSocket() client: Socket
  ) {
    if (!payload.conversationId) {
      return;
    }

    client.join(this.getConversationRoom(payload.conversationId));
  }

  emitNewMessage(event: NewMessageEvent) {
    this.server
      .to(this.getConversationRoom(event.conversationId))
      .emit('message:new', event);
  }

  private getConversationRoom(conversationId: number) {
    return `conversation:${conversationId}`;
  }
}
