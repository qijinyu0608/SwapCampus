import '../src/load-env';
import { PrismaClient } from '@prisma/client';
import { ensureRemoteProductImageAsset, loadRemoteProductSamples, writeRemoteProductSamples } from './remote-product-image-assets';

const prisma = new PrismaClient();

async function main() {
  const samples = await loadRemoteProductSamples();
  const updatedSamples = [];
  const failures: Array<{ title: string; imageUrl: string; error: string }> = [];

  for (const sample of samples) {
    try {
      const localImageUrl = await ensureRemoteProductImageAsset(sample);
      updatedSamples.push({
        ...sample,
        localImageUrl
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failures.push({
        title: sample.title,
        imageUrl: sample.imageUrl,
        error: detail
      });
      updatedSamples.push(sample);
    }
  }

  await writeRemoteProductSamples(updatedSamples);

  const productImages = await prisma.productImage.findMany({
    where: {
      imageUrl: {
        startsWith: 'http'
      }
    },
    select: {
      id: true,
      imageUrl: true
    }
  });

  const imageMap = new Map<string, string>();
  const titleMap = new Map<string, string>();
  for (const sample of updatedSamples) {
    if (sample.localImageUrl) {
      imageMap.set(sample.imageUrl, sample.localImageUrl);
      titleMap.set(sample.title, sample.localImageUrl);
    }
  }

  let updated = 0;
  for (const image of productImages) {
    const localImageUrl = imageMap.get(image.imageUrl);
    if (!localImageUrl) {
      continue;
    }

    await prisma.productImage.update({
      where: { id: image.id },
      data: { imageUrl: localImageUrl }
    });
    updated += 1;
  }

  const titleMatchedProducts = await prisma.product.findMany({
    where: {
      title: {
        in: [...titleMap.keys()]
      }
    },
    select: {
      id: true,
      title: true,
      images: {
        select: {
          id: true,
          imageUrl: true,
          sortOrder: true
        },
        orderBy: {
          sortOrder: 'asc'
        }
      }
    }
  });

  for (const product of titleMatchedProducts) {
    const localImageUrl = titleMap.get(product.title);
    const firstImage = product.images[0];
    if (!localImageUrl || !firstImage || firstImage.imageUrl === localImageUrl) {
      continue;
    }

    await prisma.productImage.update({
      where: { id: firstImage.id },
      data: { imageUrl: localImageUrl }
    });
    updated += 1;
  }

  console.log(`[db:download-remote-product-images] localized ${imageMap.size} unique remote images, updated ${updated} db rows`);
  if (failures.length) {
    console.warn(`[db:download-remote-product-images] failed to localize ${failures.length} images`);
    failures.slice(0, 10).forEach((failure) => {
      console.warn(`- ${failure.title}: ${failure.error}`);
    });
  }
}

main()
  .catch((error) => {
    console.error('[db:download-remote-product-images] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
