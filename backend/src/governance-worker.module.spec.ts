import 'reflect-metadata';
import { GovernanceOutboxConsumer } from './modules/outbox/governance-outbox.consumer';
import { PrismaService } from './prisma/prisma.service';
import { GovernanceWorkerModule } from './governance-worker.module';

describe('GovernanceWorkerModule', () => {
  it('should register standalone governance worker providers', () => {
    const providers = Reflect.getMetadata('providers', GovernanceWorkerModule) ?? [];

    expect(providers).toEqual(expect.arrayContaining([
      PrismaService,
      GovernanceOutboxConsumer
    ]));
  });
});
