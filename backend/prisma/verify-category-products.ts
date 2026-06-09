import { PrismaClient } from '@prisma/client';
import { PRODUCT_CATEGORY_NAMES } from './product-category-migration';

const prisma = new PrismaClient();
const categories = [...PRODUCT_CATEGORY_NAMES];

async function main() {
  const grouped = await prisma.product.groupBy({
    by: ['category'],
    _count: { _all: true }
  });

  const countMap = new Map(grouped.map((item) => [item.category, item._count._all]));
  const rows = categories.map((category) => ({
    category,
    count: countMap.get(category) ?? 0
  }));

  console.table(rows);

  const missing = rows.filter((row) => row.count < 1);
  if (missing.length) {
    throw new Error(`missing product categories: ${missing.map((row) => row.category).join(', ')}`);
  }

  console.log(`[db:verify-category-products] ok, ${rows.length} categories covered`);
}

main()
  .catch((error) => {
    console.error('[db:verify-category-products] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
