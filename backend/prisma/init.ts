import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log(`[db:init] existing data detected (${userCount} users), skip demo seed/bootstrap`);
    return;
  }

  console.log('[db:init] database is empty, schema only; skip demo seed/bootstrap');
}

main()
  .catch((error) => {
    console.error('[db:init] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
