import '../src/load-env';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type RecordRow = {
  scope: 'product' | 'campus';
  id: number;
  imageUrl: string;
};

function isLocalStaticImage(url: string) {
  return url.startsWith('/images/');
}

async function fileExists(absolutePath: string) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const [productImages, campusImages] = await Promise.all([
    prisma.productImage.findMany({
      select: { id: true, imageUrl: true }
    }),
    prisma.campusServiceImage.findMany({
      select: { id: true, imageUrl: true }
    })
  ]);

  const records: RecordRow[] = [
    ...productImages.map((item) => ({ scope: 'product' as const, id: item.id, imageUrl: item.imageUrl })),
    ...campusImages.map((item) => ({ scope: 'campus' as const, id: item.id, imageUrl: item.imageUrl }))
  ];

  const missing: RecordRow[] = [];
  const external: RecordRow[] = [];

  for (const record of records) {
    if (!isLocalStaticImage(record.imageUrl)) {
      external.push(record);
      continue;
    }

    const absolutePath = path.resolve(process.cwd(), `../frontend/public${record.imageUrl}`);
    if (!(await fileExists(absolutePath))) {
      missing.push(record);
    }
  }

  console.log(JSON.stringify({
    total: records.length,
    externalCount: external.length,
    missingCount: missing.length,
    sampleExternal: external.slice(0, 10),
    sampleMissing: missing.slice(0, 10)
  }, null, 2));

  if (external.length || missing.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('[db:verify-local-image-records] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
