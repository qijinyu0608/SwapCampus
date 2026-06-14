import { PrismaClient, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.product.updateMany({
    where: { status: ProductStatus.PENDING },
    data: { status: ProductStatus.ON_SALE }
  });

  console.log(`[db:migrate-product-statuses] migrated ${result.count} products from PENDING to ON_SALE`);
}

main()
  .catch((error) => {
    console.error('[db:migrate-product-statuses] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
