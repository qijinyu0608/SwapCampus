import { Module } from '@nestjs/common';
import { SearchIndexOutboxConsumer } from './modules/outbox/search-index-outbox.consumer';
import { SearchService } from './modules/search/search.service';
import { PrismaService } from './prisma/prisma.service';

@Module({
  providers: [
    PrismaService,
    SearchService,
    SearchIndexOutboxConsumer
  ],
  exports: [PrismaService, SearchService, SearchIndexOutboxConsumer]
})
export class SearchIndexerModule {}
