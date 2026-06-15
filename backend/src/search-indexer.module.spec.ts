import 'reflect-metadata';
import { SearchIndexOutboxConsumer } from './modules/outbox/search-index-outbox.consumer';
import { SearchService } from './modules/search/search.service';
import { PrismaService } from './prisma/prisma.service';
import { SearchIndexerModule } from './search-indexer.module';

describe('SearchIndexerModule', () => {
  it('should register standalone search indexer worker providers', () => {
    const providers = Reflect.getMetadata('providers', SearchIndexerModule) ?? [];

    expect(providers).toEqual(expect.arrayContaining([
      PrismaService,
      SearchService,
      SearchIndexOutboxConsumer
    ]));
  });
});
