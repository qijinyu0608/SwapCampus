import { AccountStatus, PrismaClient, UserRole, VerificationStatus } from '@prisma/client';
import { ensureSuperTokensRoles, syncSuperTokensUser } from './supertokens-sync';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = 'admin@swapcampus.cn';
const DEFAULT_ADMIN_PASSWORD = 'SwapCampusAdmin2026';
const DEFAULT_USER_PASSWORD = 'SwapCampusUser2026';
const DEMO_USER_EMAIL = 'qjinyu0608@qq.com';
const DEMO_USER_PASSWORD = '123456';
const DEMO_USER_STUDENT_ID = '2026990608';
const SUPERTOKENS_SYNC_TIMEOUT_MS = 15000;

async function withTimeout<T>(task: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${SUPERTOKENS_SYNC_TIMEOUT_MS}ms`));
        }, SUPERTOKENS_SYNC_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function main() {
  await ensureSuperTokensRoles();

  const users = await prisma.user.findMany({
    include: {
      verification: true
    },
    orderBy: { id: 'asc' }
  });

  for (const user of users) {
    const isAdmin = user.role === UserRole.ADMIN;
    const email = isAdmin
      ? DEFAULT_ADMIN_EMAIL
      : user.email === DEMO_USER_EMAIL || user.studentId === DEMO_USER_STUDENT_ID
        ? DEMO_USER_EMAIL
        : /^user\d+@swapcampus\.local$/.test(user.email)
          ? user.email.replace('@swapcampus.local', '@stu.swapcampus.cn')
          : user.email;

    const password = email === DEMO_USER_EMAIL ? DEMO_USER_PASSWORD : isAdmin ? DEFAULT_ADMIN_PASSWORD : DEFAULT_USER_PASSWORD;

    try {
      console.log(`[db:sync-default-accounts] syncing ${email}`);
      await withTimeout(
        syncSuperTokensUser(prisma, {
          email,
          password,
          displayName: user.displayName,
          studentId: user.studentId,
          college: user.verification?.college ?? '待填写',
          role: user.role,
          verificationStatus: user.verificationStatus ?? VerificationStatus.PENDING,
          accountStatus: user.accountStatus ?? AccountStatus.ACTIVE
        }),
        `sync user ${email}`
      );
      console.log(`[db:sync-default-accounts] synced ${email}`);
    } catch (error) {
      console.warn(`[db:sync-default-accounts] skip ${email}:`, error);
    }
  }

  const demoUser = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    include: { verification: true }
  });

  if (!demoUser) {
    try {
      console.log(`[db:sync-default-accounts] syncing ${DEMO_USER_EMAIL}`);
      await withTimeout(
        syncSuperTokensUser(prisma, {
          email: DEMO_USER_EMAIL,
          password: DEMO_USER_PASSWORD,
          displayName: 'QJinyu',
          studentId: DEMO_USER_STUDENT_ID,
          college: '工学院',
          role: UserRole.USER,
          verificationStatus: VerificationStatus.APPROVED,
          accountStatus: AccountStatus.ACTIVE
        }),
        `sync user ${DEMO_USER_EMAIL}`
      );
      console.log(`[db:sync-default-accounts] synced ${DEMO_USER_EMAIL}`);
    } catch (error) {
      console.warn(`[db:sync-default-accounts] skip ${DEMO_USER_EMAIL}:`, error);
    }
  }

  console.log('[db:sync-default-accounts] done');
}

main()
  .catch((error) => {
    console.error('[db:sync-default-accounts] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
