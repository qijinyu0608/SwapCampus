import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { OutboxService } from './outbox.service';
import { SearchIndexOutboxConsumer } from './search-index-outbox.consumer';

@Module({
  providers: [
    PrismaService,
    SearchService,
    OutboxService,
    SearchIndexOutboxConsumer
  ],
  exports: [
    PrismaService,
    SearchService,
    OutboxService,
    SearchIndexOutboxConsumer
  ]
})
export class OutboxModule {}
