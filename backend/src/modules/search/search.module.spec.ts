import 'reflect-metadata';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchModule } from './search.module';
import { SearchService } from './search.service';

describe('SearchModule', () => {
  it('registers the search service and prisma provider', () => {
    const providers = Reflect.getMetadata('providers', SearchModule) ?? [];
    const exports = Reflect.getMetadata('exports', SearchModule) ?? [];

    expect(providers).toEqual(expect.arrayContaining([SearchService, PrismaService]));
    expect(exports).toEqual(expect.arrayContaining([SearchService]));
  });
});
