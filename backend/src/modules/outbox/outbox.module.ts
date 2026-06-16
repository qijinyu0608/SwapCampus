import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { GovernanceOutboxConsumer } from './governance-outbox.consumer';
import { MessageOutboxConsumer } from './message-outbox.consumer';
import { OutboxService } from './outbox.service';
import { RecommendationOutboxConsumer } from './recommendation-outbox.consumer';
import { SearchIndexOutboxConsumer } from './search-index-outbox.consumer';

@Module({
  providers: [
    PrismaService,
    SearchService,
    OutboxService,
    SearchIndexOutboxConsumer,
    MessageOutboxConsumer,
    RecommendationOutboxConsumer,
    GovernanceOutboxConsumer
  ],
  exports: [
    PrismaService,
    SearchService,
    OutboxService,
    SearchIndexOutboxConsumer,
    MessageOutboxConsumer,
    RecommendationOutboxConsumer,
    GovernanceOutboxConsumer
  ]
})
export class OutboxModule {}
