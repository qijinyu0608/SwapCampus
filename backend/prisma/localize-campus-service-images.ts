import '../src/load-env';
import { PrismaClient } from '@prisma/client';
import { resolveLocalCampusServiceImage } from './campus-service-image-pool';
import { ensureRemoteProductImageAsset } from './remote-product-image-assets';

const prisma = new PrismaClient();

function shouldSkipRemoteDownload(imageUrl: string) {
  try {
    const parsed = new URL(imageUrl);
    return parsed.hostname === 'cdn.example.com';
  } catch {
    return false;
  }
}

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
      listingId: true,
      sortOrder: true,
      listing: {
        select: {
          title: true,
          category: true,
          intent: true
        }
      }
    },
    orderBy: [
      { listingId: 'asc' },
      { id: 'asc' }
    ]
  });

  let updated = 0;

  for (const image of images) {
    let localImageUrl: string;

    if (shouldSkipRemoteDownload(image.imageUrl)) {
      localImageUrl = resolveLocalCampusServiceImage({
        category: image.listing.category,
        intent: image.listing.intent,
        listingId: image.listingId,
        title: image.listing.title,
        imageUrl: image.imageUrl
      });
    } else {
      try {
        localImageUrl = await ensureRemoteProductImageAsset({
          source: 'campus-service',
          sourceId: String(image.id),
          title: `campus-service-${image.listingId}-${image.id}`,
          imageUrl: image.imageUrl
        });
      } catch {
        localImageUrl = resolveLocalCampusServiceImage({
          category: image.listing.category,
          intent: image.listing.intent,
          listingId: image.listingId,
          title: image.listing.title,
          imageUrl: image.imageUrl
        });
      }
    }

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
