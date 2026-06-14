import { PrismaService } from '../src/prisma/prisma.service';
import { SearchService } from '../src/modules/search/search.service';

async function main() {
  const prisma = new PrismaService();
  const searchService = new SearchService(prisma);

  try {
    await searchService.reindexProducts();
    console.log('[db:reindex-products] reindexed products');
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('[db:reindex-products] failed', error);
    process.exitCode = 1;
  });
