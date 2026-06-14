import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { SearchService } from '../src/modules/search/search.service';
import { seedDemoData } from './demo-seed';
import { clearProductSearchIndex } from './remove-demo-data';

const prisma = new PrismaService();

async function main() {
  await clearProductSearchIndex();

  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.review.deleteMany();
  await prisma.order.deleteMany();
  await prisma.campusServiceOrder.deleteMany();
  await prisma.report.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.campusServiceFavorite.deleteMany();
  await prisma.campusServiceBehavior.deleteMany();
  await prisma.campusServiceImage.deleteMany();
  await prisma.campusServiceListing.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.userFollow.deleteMany();
  await prisma.userBehavior.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.creditRedeemOrder.deleteMany();
  await prisma.creditMissionClaim.deleteMany();
  await prisma.creditPointLedger.deleteMany();
  await prisma.userCreditAsset.deleteMany();
  await prisma.studentVerification.deleteMany();
  await prisma.user.deleteMany();

  await seedDemoData(prisma);

  const searchService = new SearchService(prisma);
  await searchService.reindexProducts();

  console.log('[db:reset-and-seed-demo] reset and reseeded demo data');
}

main()
  .catch((error) => {
    console.error('[db:reset-and-seed-demo] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
