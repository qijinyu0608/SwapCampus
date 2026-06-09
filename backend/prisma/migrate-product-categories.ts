import { PrismaClient } from '@prisma/client';
import { normalizeProductCategoryName } from './product-category-migration';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      category: true
    }
  });

  let updatedCount = 0;

  for (const product of products) {
    const normalizedCategory = normalizeProductCategoryName(product.category);
    if (normalizedCategory === product.category) {
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        category: normalizedCategory
      }
    });
    updatedCount += 1;
  }

  console.log(`[db:migrate-product-categories] updated ${updatedCount} products`);
}

main()
  .catch((error) => {
    console.error('[db:migrate-product-categories] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
