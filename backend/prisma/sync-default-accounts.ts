import { PrismaClient, UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = 'admin@swapcampus.cn';
const DEFAULT_ADMIN_PASSWORD = 'SwapCampusAdmin2026';
const DEFAULT_USER_PASSWORD = 'SwapCampusUser2026';
const DEMO_USER_EMAIL = 'qjinyu0608@qq.com';
const DEMO_USER_PASSWORD = '123456';
const DEMO_USER_STUDENT_ID = '2026990608';

function isHashedPassword(passwordHash: string) {
  return passwordHash.startsWith('$2');
}

async function main() {
  const demoUser = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL }
  });

  if (!demoUser) {
    await prisma.user.create({
      data: {
        studentId: DEMO_USER_STUDENT_ID,
        name: 'QJinyu',
        email: DEMO_USER_EMAIL,
        passwordHash: hashSync(DEMO_USER_PASSWORD, 10),
        role: UserRole.USER,
        creditScore: 88,
        isVerified: true,
        verification: {
          create: {
            realName: 'QJinyu',
            college: '工学院',
            phone: '18800000608',
            status: 'APPROVED'
          }
        }
      }
    });
  } else if (!isHashedPassword(demoUser.passwordHash) || demoUser.passwordHash === DEMO_USER_PASSWORD) {
    await prisma.user.update({
      where: { id: demoUser.id },
      data: {
        passwordHash: hashSync(DEMO_USER_PASSWORD, 10)
      }
    });
  }

  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' }
  });

  for (const user of users) {
    const nextData: Record<string, string> = {};

    if (user.role === UserRole.ADMIN) {
      if (user.email !== DEFAULT_ADMIN_EMAIL) {
        nextData.email = DEFAULT_ADMIN_EMAIL;
      }

      if (!isHashedPassword(user.passwordHash) || user.passwordHash === 'admin123') {
        nextData.passwordHash = hashSync(DEFAULT_ADMIN_PASSWORD, 10);
      }
    } else {
      if (/^user\d+@swapcampus\.local$/.test(user.email)) {
        nextData.email = user.email.replace('@swapcampus.local', '@stu.swapcampus.cn');
      }

      if (!isHashedPassword(user.passwordHash) || user.passwordHash === '123456') {
        nextData.passwordHash = hashSync(DEFAULT_USER_PASSWORD, 10);
      }
    }

    if (Object.keys(nextData).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: nextData
      });
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
