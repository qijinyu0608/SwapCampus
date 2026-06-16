import '../src/load-env';
import { PrismaClient } from '@prisma/client';
import { ensureRemoteProductImageAsset } from './remote-product-image-assets';

const prisma = new PrismaClient();

async function main() {
  const images = await prisma.campusServiceImage.findMany({
    where: {
      imageUrl: {
        startsWith: 'http'
      }
    },
    select: {
      id: true,
      imageUrl: true,
      listingId: true
    },
    orderBy: [
      { listingId: 'asc' },
      { id: 'asc' }
    ]
  });

  let updated = 0;

  for (const image of images) {
    const localImageUrl = await ensureRemoteProductImageAsset({
      source: 'campus-service',
      sourceId: String(image.id),
      title: `campus-service-${image.listingId}-${image.id}`,
      imageUrl: image.imageUrl
    });

    await prisma.campusServiceImage.update({
      where: { id: image.id },
      data: { imageUrl: localImageUrl }
    });
    updated += 1;
  }

  console.log(`[db:localize-campus-service-images] updated ${updated} campus service images`);
}

main()
  .catch((error) => {
    console.error('[db:localize-campus-service-images] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
