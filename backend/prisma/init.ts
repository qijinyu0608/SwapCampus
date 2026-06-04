import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log(`[db:init] existing data detected (${userCount} users), sync default accounts`);
    execSync('npm run db:sync-default-accounts', { stdio: 'inherit' });
    execSync('npm run db:ensure-category-products', { stdio: 'inherit' });
    execSync('npm run db:ensure-campus-services', { stdio: 'inherit' });
    return;
  }

  console.log('[db:init] database is empty, run seed');
  execSync('npm run db:seed', { stdio: 'inherit' });
  execSync('npm run db:sync-default-accounts', { stdio: 'inherit' });
  execSync('npm run db:ensure-category-products', { stdio: 'inherit' });
  execSync('npm run db:ensure-campus-services', { stdio: 'inherit' });
}

main()
  .catch((error) => {
    console.error('[db:init] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
