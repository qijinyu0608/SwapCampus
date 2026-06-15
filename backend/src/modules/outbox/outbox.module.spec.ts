import 'reflect-metadata';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { VendureService } from '../vendure/vendure.service';
import { CommerceSyncOutboxConsumer } from './commerce-sync-outbox.consumer';
import { OutboxModule } from './outbox.module';
import { OutboxService } from './outbox.service';
import { SearchIndexOutboxConsumer } from './search-index-outbox.consumer';

describe('OutboxModule', () => {
  it('should keep backend outbox wiring limited to search indexing', () => {
    const providers = Reflect.getMetadata('providers', OutboxModule) ?? [];
    const exports = Reflect.getMetadata('exports', OutboxModule) ?? [];

    expect(providers).toEqual(expect.arrayContaining([
      PrismaService,
      SearchService,
      OutboxService,
      SearchIndexOutboxConsumer
    ]));
    expect(providers).not.toContain(VendureService);
    expect(providers).not.toContain(CommerceSyncOutboxConsumer);
    expect(exports).toEqual(expect.arrayContaining([
      PrismaService,
      SearchService,
      OutboxService,
      SearchIndexOutboxConsumer
    ]));
    expect(exports).not.toContain(CommerceSyncOutboxConsumer);
  });
});
