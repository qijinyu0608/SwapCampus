import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { VendureService } from '../vendure/vendure.service';
import { CommerceSyncOutboxConsumer } from './commerce-sync-outbox.consumer';
import { OutboxService } from './outbox.service';
import { SearchIndexOutboxConsumer } from './search-index-outbox.consumer';

@Module({
  providers: [
    PrismaService,
    SearchService,
    VendureService,
    OutboxService,
    SearchIndexOutboxConsumer,
    CommerceSyncOutboxConsumer
  ],
  exports: [OutboxService, SearchIndexOutboxConsumer, CommerceSyncOutboxConsumer]
})
export class OutboxModule {}
