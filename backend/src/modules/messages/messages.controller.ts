import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('messages')
export class MessagesController {
  constructor(
    @Inject(MessagesService)
    private readonly messagesService: MessagesService
  ) {}

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.messagesService.listConversations(user);
  }

  @Post('conversations')
  @UseGuards(JwtAuthGuard)
  createConversation(@Body() dto: CreateConversationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.messagesService.createConversation(dto, user);
  }

  @Get('conversations/:id')
  @UseGuards(JwtAuthGuard)
  getConversationMessages(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.messagesService.getConversationMessages(id, user);
  }

  @Post('conversations/:id')
  @UseGuards(JwtAuthGuard)
  sendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.messagesService.sendMessage(id, dto, user);
  }
}
