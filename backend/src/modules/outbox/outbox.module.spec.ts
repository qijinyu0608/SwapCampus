import 'reflect-metadata';
import { GovernanceOutboxPublisher } from '../governance/governance-outbox.publisher';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagesGateway } from '../messages/messages.gateway';
import { SearchService } from '../search/search.service';
import { VendureService } from '../vendure/vendure.service';
import { CommerceSyncOutboxConsumer } from './commerce-sync-outbox.consumer';
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
      MessagesGateway,
      SearchService,
      OutboxService,
      SearchIndexOutboxConsumer,
      MessageOutboxConsumer,
      RecommendationOutboxConsumer,
      GovernanceOutboxPublisher
    ]));
    expect(providers).not.toContain(VendureService);
    expect(providers).not.toContain(CommerceSyncOutboxConsumer);
    expect(exports).toEqual(expect.arrayContaining([
      PrismaService,
      MessagesGateway,
      SearchService,
      OutboxService,
      SearchIndexOutboxConsumer,
      MessageOutboxConsumer,
      RecommendationOutboxConsumer,
      GovernanceOutboxPublisher
    ]));
    expect(exports).not.toContain(CommerceSyncOutboxConsumer);
  });
});
