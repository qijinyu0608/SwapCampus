import { AccountStatus, PrismaClient, UserRole, VerificationStatus } from '@prisma/client';
import { syncSuperTokensUser } from './supertokens-sync';

const prisma = new PrismaClient();

const DEMO_ACCOUNTS = [
  {
    email: 'admin@swapcampus.local',
    password: 'admin',
    displayName: 'ADMIN',
    studentId: 'admin',
    college: '信息学院',
    role: UserRole.ADMIN,
    creditScore: 100,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user01@swapcampus.local',
    password: 'user01',
    displayName: '林同学',
    studentId: '20260001',
    college: '林学院',
    role: UserRole.USER,
    creditScore: 92,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user02@swapcampus.local',
    password: 'user02',
    displayName: '信同学',
    studentId: '20260002',
    college: '信息学院',
    role: UserRole.USER,
    creditScore: 88,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user03@swapcampus.local',
    password: 'user03',
    displayName: '工同学',
    studentId: '20260003',
    college: '工学院',
    role: UserRole.USER,
    creditScore: 84,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user04@swapcampus.local',
    password: 'user04',
    displayName: '经同学',
    studentId: '20260004',
    college: '经济管理学院',
    role: UserRole.USER,
    creditScore: 79,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user05@swapcampus.local',
    password: 'user05',
    displayName: '园同学',
    studentId: '20260005',
    college: '园林学院',
    role: UserRole.USER,
    creditScore: 74,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user06@swapcampus.local',
    password: 'user06',
    displayName: '生同学',
    studentId: '20260006',
    college: '生物科学与技术学院',
    role: UserRole.USER,
    creditScore: 69,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user07@swapcampus.local',
    password: 'user07',
    displayName: '艺同学',
    studentId: '20260007',
    college: '艺术设计学院',
    role: UserRole.USER,
    creditScore: 65,
    verificationStatus: VerificationStatus.PENDING,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user08@swapcampus.local',
    password: 'user08',
    displayName: '外同学',
    studentId: '20260008',
    college: '外语学院',
    role: UserRole.USER,
    creditScore: 81,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user09@swapcampus.local',
    password: 'user09',
    displayName: '法同学',
    studentId: '20260009',
    college: '法学院',
    role: UserRole.USER,
    creditScore: 77,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user10@swapcampus.local',
    password: 'user10',
    displayName: '医同学',
    studentId: '20260010',
    college: '园艺园林学院',
    role: UserRole.USER,
    creditScore: 83,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user11@swapcampus.local',
    password: 'user11',
    displayName: '药同学',
    studentId: '20260011',
    college: '药学院',
    role: UserRole.USER,
    creditScore: 71,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user12@swapcampus.local',
    password: 'user12',
    displayName: '动同学',
    studentId: '20260012',
    college: '动物科技学院',
    role: UserRole.USER,
    creditScore: 76,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  }
] as const;

async function main() {
  const users = [];
  for (const account of DEMO_ACCOUNTS) {
    const user = await syncSuperTokensUser(prisma, {
      ...account,
      requireRemoteCore: true
    });
    users.push(user);
  }
  const userCount = users.filter((user) => user.role === UserRole.USER).length;
  const adminCount = users.filter((user) => user.role === UserRole.ADMIN).length;

  console.log(`[db:seed-demo-users] created ${users.length} users (${adminCount} admin, ${userCount} normal users)`);
}

main()
  .catch((error) => {
    console.error('[db:seed-demo-users] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
