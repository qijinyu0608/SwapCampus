import { PrismaClient } from '@prisma/client';
import { clearProductSearchIndex } from './remove-demo-data';

const prisma = new PrismaClient();

async function main() {
  await clearProductSearchIndex();

  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.review.deleteMany();
  await prisma.order.deleteMany();
  await prisma.campusServiceOrder.deleteMany();
  await prisma.report.deleteMany({
    where: {
      OR: [
        { productId: { not: null } },
        { campusServiceListingId: { not: null } }
      ]
    }
  });
  await prisma.auditLog.deleteMany({
    where: {
      targetType: { in: ['PRODUCT', 'CAMPUS_SERVICE'] }
    }
  });
  await prisma.campusServiceFavorite.deleteMany();
  await prisma.campusServiceBehavior.deleteMany();
  await prisma.campusServiceImage.deleteMany();
  await prisma.campusServiceListing.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.userBehavior.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();

  console.log('[db:clear-marketplace-data] removed product/service domain data and search index');
}

main()
  .catch((error) => {
    console.error('[db:clear-marketplace-data] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
