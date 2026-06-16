import 'reflect-metadata';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { VendureService } from '../vendure/vendure.service';
import { CommerceSyncOutboxConsumer } from './commerce-sync-outbox.consumer';
import { GovernanceOutboxConsumer } from './governance-outbox.consumer';
import { MessageOutboxConsumer } from './message-outbox.consumer';
import { OutboxModule } from './outbox.module';
import { OutboxService } from './outbox.service';
import { RecommendationOutboxConsumer } from './recommendation-outbox.consumer';
import { SearchIndexOutboxConsumer } from './search-index-outbox.consumer';

describe('OutboxModule', () => {
  it('should keep backend outbox wiring limited to single-process consumers and exclude commerce worker', () => {
    const providers = Reflect.getMetadata('providers', OutboxModule) ?? [];
    const exports = Reflect.getMetadata('exports', OutboxModule) ?? [];

    expect(providers).toEqual(expect.arrayContaining([
      PrismaService,
      SearchService,
      OutboxService,
      SearchIndexOutboxConsumer,
      MessageOutboxConsumer,
      RecommendationOutboxConsumer,
      GovernanceOutboxConsumer
    ]));
    expect(providers).not.toContain(VendureService);
    expect(providers).not.toContain(CommerceSyncOutboxConsumer);
    expect(exports).toEqual(expect.arrayContaining([
      PrismaService,
      SearchService,
      OutboxService,
      SearchIndexOutboxConsumer,
      MessageOutboxConsumer,
      RecommendationOutboxConsumer,
      GovernanceOutboxConsumer
    ]));
    expect(exports).not.toContain(CommerceSyncOutboxConsumer);
  });
});
