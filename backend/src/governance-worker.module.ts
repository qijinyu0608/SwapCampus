import { Module } from '@nestjs/common';
import { GovernanceMqConsumer } from './modules/governance/governance-mq.consumer';
import { PrismaService } from './prisma/prisma.service';

@Module({
  providers: [
    PrismaService,
    GovernanceMqConsumer
  ],
  exports: [PrismaService, GovernanceMqConsumer]
})
export class GovernanceWorkerModule {}
