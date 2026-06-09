import { AccountStatus, PrismaClient, UserRole, VerificationStatus } from '@prisma/client';
import { syncSuperTokensUser } from './supertokens-sync';

const prisma = new PrismaClient();

export const TEST_ACCOUNT = {
  email: 'admin',
  password: 'admin',
  displayName: 'ADMIN',
  studentId: 'admin',
  college: '信息学院'
} as const;

async function main() {
  const user = await syncSuperTokensUser(prisma, {
    ...TEST_ACCOUNT,
    role: UserRole.ADMIN,
    creditScore: 100,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE,
    requireRemoteCore: true
  });

  console.log('[db:sync-test-account] synced test account', {
    id: user.id,
    email: user.email,
    studentId: user.studentId,
    displayName: user.displayName
  });
}

main()
  .catch((error) => {
    console.error('[db:sync-test-account] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
