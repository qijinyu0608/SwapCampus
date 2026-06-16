import '../src/load-env';
import { PrismaClient } from '@prisma/client';
import { getLocalProductImage } from './product-image-pool';

const prisma = new PrismaClient();
const PLACEHOLDER_LOCAL_IMAGE = '/images/products/remote/escuelajs-004ec8153327.svg';

async function main() {
  const images = await prisma.productImage.findMany({
    where: {
      imageUrl: PLACEHOLDER_LOCAL_IMAGE
    },
    select: {
      id: true,
      productId: true,
      sortOrder: true
    },
    orderBy: [
      { productId: 'asc' },
      { sortOrder: 'asc' }
    ]
  });

  let updated = 0;

  for (const image of images) {
    await prisma.productImage.update({
      where: { id: image.id },
      data: {
        imageUrl: getLocalProductImage(image.productId + image.sortOrder)
      }
    });
    updated += 1;
  }

  console.log(`[db:replace-placeholder-product-images] updated ${updated} placeholder product images`);
}

main()
  .catch((error) => {
    console.error('[db:replace-placeholder-product-images] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
