import { Module } from '@nestjs/common';
import { GovernanceOutboxPublisher } from '../governance/governance-outbox.publisher';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagesGateway } from '../messages/messages.gateway';
import { SearchService } from '../search/search.service';
import { MessageOutboxConsumer } from './message-outbox.consumer';
import { OutboxService } from './outbox.service';
import { RecommendationOutboxConsumer } from './recommendation-outbox.consumer';
import { SearchIndexOutboxConsumer } from './search-index-outbox.consumer';

@Module({
  providers: [
    PrismaService,
    MessagesGateway,
    SearchService,
    OutboxService,
    SearchIndexOutboxConsumer,
    MessageOutboxConsumer,
    RecommendationOutboxConsumer,
    GovernanceOutboxPublisher
  ],
  exports: [
    PrismaService,
    MessagesGateway,
    SearchService,
    OutboxService,
    SearchIndexOutboxConsumer,
    MessageOutboxConsumer,
    RecommendationOutboxConsumer,
    GovernanceOutboxPublisher
  ]
})
export class OutboxModule {}
