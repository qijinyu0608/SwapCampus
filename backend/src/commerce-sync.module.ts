import { Module } from '@nestjs/common';
import { CommerceSyncOutboxConsumer } from './modules/outbox/commerce-sync-outbox.consumer';
import { VendureService } from './modules/vendure/vendure.service';
import { PrismaService } from './prisma/prisma.service';

@Module({
  providers: [
    PrismaService,
    VendureService,
    CommerceSyncOutboxConsumer
  ]
})
export class CommerceSyncModule {}
