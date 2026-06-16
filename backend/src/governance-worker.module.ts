import { Module } from '@nestjs/common';
import { GovernanceOutboxConsumer } from './modules/outbox/governance-outbox.consumer';
import { PrismaService } from './prisma/prisma.service';

@Module({
  providers: [
    PrismaService,
    GovernanceOutboxConsumer
  ],
  exports: [PrismaService, GovernanceOutboxConsumer]
})
export class GovernanceWorkerModule {}
