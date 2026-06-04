import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Controller('messages')
export class MessagesController {
  constructor(
    @Inject(MessagesService)
    private readonly messagesService: MessagesService
  ) {}

  @Get('conversations')
  listConversations(@Query('userId') userId?: string) {
    return this.messagesService.listConversations(userId ? Number(userId) : undefined);
  }

  @Post('conversations')
  createConversation(@Body() dto: CreateConversationDto) {
    return this.messagesService.createConversation(dto);
  }

  @Post('demo-hydrate')
  hydrateDemoConversations(
    @Body() dto: {
      userId: number;
      studentId?: string;
      name?: string;
      email?: string;
    }
  ) {
    return this.messagesService.hydrateDemoConversations(dto);
  }

  @Get('conversations/:id')
  getConversationMessages(
    @Param('id', ParseIntPipe) id: number,
    @Query('userId') userId?: string
  ) {
    return this.messagesService.getConversationMessages(id, userId ? Number(userId) : undefined);
  }

  @Post('conversations/:id')
  sendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto
  ) {
    return this.messagesService.sendMessage(id, dto);
  }
}
