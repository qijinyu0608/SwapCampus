import 'reflect-metadata';
import { CommerceSyncOutboxConsumer } from './modules/outbox/commerce-sync-outbox.consumer';
import { VendureService } from './modules/vendure/vendure.service';
import { PrismaService } from './prisma/prisma.service';
import { CommerceSyncModule } from './commerce-sync.module';

describe('CommerceSyncModule', () => {
  it('should register standalone commerce sync worker providers', () => {
    const providers = Reflect.getMetadata('providers', CommerceSyncModule) ?? [];

    expect(providers).toEqual(expect.arrayContaining([
      PrismaService,
      VendureService,
      CommerceSyncOutboxConsumer
    ]));
  });
});
