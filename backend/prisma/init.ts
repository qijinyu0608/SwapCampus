import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

const prisma = new PrismaClient();

function runStep(name: string, command: string, options?: { allowFailure?: boolean }) {
  console.log(`[db:init] start ${name}`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`[db:init] done ${name}`);
  } catch (error) {
    if (options?.allowFailure) {
      console.warn(`[db:init] skip ${name}:`, error);
      return;
    }

    throw error;
  }
}

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log(`[db:init] existing data detected (${userCount} users), sync default accounts`);
    runStep('sync default accounts', 'npm run db:sync-default-accounts', { allowFailure: true });
    runStep('ensure category products', 'npm run db:ensure-category-products');
    runStep('ensure campus services', 'npm run db:ensure-campus-services');
    return;
  }

  console.log('[db:init] database is empty, run seed');
  runStep('seed', 'npm run db:seed');
  runStep('sync default accounts', 'npm run db:sync-default-accounts', { allowFailure: true });
  runStep('ensure category products', 'npm run db:ensure-category-products');
  runStep('ensure campus services', 'npm run db:ensure-campus-services');
}

main()
  .catch((error) => {
    console.error('[db:init] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
