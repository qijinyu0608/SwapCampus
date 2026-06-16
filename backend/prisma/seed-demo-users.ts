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
  },
  {
    email: 'user13@swapcampus.local',
    password: 'user13',
    displayName: '资同学',
    studentId: '20260013',
    college: '资源与环境学院',
    role: UserRole.USER,
    creditScore: 82,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user14@swapcampus.local',
    password: 'user14',
    displayName: '食同学',
    studentId: '20260014',
    college: '食品科学技术学院',
    role: UserRole.USER,
    creditScore: 73,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user15@swapcampus.local',
    password: 'user15',
    displayName: '机同学',
    studentId: '20260015',
    college: '机电工程学院',
    role: UserRole.USER,
    creditScore: 78,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user16@swapcampus.local',
    password: 'user16',
    displayName: '植同学',
    studentId: '20260016',
    college: '植物保护学院',
    role: UserRole.USER,
    creditScore: 80,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user17@swapcampus.local',
    password: 'user17',
    displayName: '水同学',
    studentId: '20260017',
    college: '水利与土木工程学院',
    role: UserRole.USER,
    creditScore: 75,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user18@swapcampus.local',
    password: 'user18',
    displayName: '经同学二',
    studentId: '20260018',
    college: '经济管理学院',
    role: UserRole.USER,
    creditScore: 72,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user19@swapcampus.local',
    password: 'user19',
    displayName: '材同学',
    studentId: '20260019',
    college: '材料科学与工程学院',
    role: UserRole.USER,
    creditScore: 74,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user20@swapcampus.local',
    password: 'user20',
    displayName: '国同学',
    studentId: '20260020',
    college: '国际学院',
    role: UserRole.USER,
    creditScore: 79,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user21@swapcampus.local',
    password: 'user21',
    displayName: '理同学',
    studentId: '20260021',
    college: '理学院',
    role: UserRole.USER,
    creditScore: 77,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user22@swapcampus.local',
    password: 'user22',
    displayName: '草同学',
    studentId: '20260022',
    college: '草业与草原学院',
    role: UserRole.USER,
    creditScore: 70,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user23@swapcampus.local',
    password: 'user23',
    displayName: '土同学',
    studentId: '20260023',
    college: '水土保持学院',
    role: UserRole.USER,
    creditScore: 76,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user24@swapcampus.local',
    password: 'user24',
    displayName: '马同学',
    studentId: '20260024',
    college: '马克思主义学院',
    role: UserRole.USER,
    creditScore: 81,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user25@swapcampus.local',
    password: 'user25',
    displayName: '环同学',
    studentId: '20260025',
    college: '环境科学与工程学院',
    role: UserRole.USER,
    creditScore: 74,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user26@swapcampus.local',
    password: 'user26',
    displayName: '计同学',
    studentId: '20260026',
    college: '计算机与控制工程学院',
    role: UserRole.USER,
    creditScore: 86,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user27@swapcampus.local',
    password: 'user27',
    displayName: '英同学',
    studentId: '20260027',
    college: '英语学院',
    role: UserRole.USER,
    creditScore: 73,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user28@swapcampus.local',
    password: 'user28',
    displayName: '机同学二',
    studentId: '20260028',
    college: '机械与电气工程学院',
    role: UserRole.USER,
    creditScore: 78,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user29@swapcampus.local',
    password: 'user29',
    displayName: '数同学',
    studentId: '20260029',
    college: '数学与统计学院',
    role: UserRole.USER,
    creditScore: 80,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user30@swapcampus.local',
    password: 'user30',
    displayName: '新同学',
    studentId: '20260030',
    college: '新能源学院',
    role: UserRole.USER,
    creditScore: 76,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user31@swapcampus.local',
    password: 'user31',
    displayName: '化同学',
    studentId: '20260031',
    college: '化学与化工学院',
    role: UserRole.USER,
    creditScore: 84,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user32@swapcampus.local',
    password: 'user32',
    displayName: '地同学',
    studentId: '20260032',
    college: '地理科学学院',
    role: UserRole.USER,
    creditScore: 72,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user33@swapcampus.local',
    password: 'user33',
    displayName: '金同学',
    studentId: '20260033',
    college: '金融学院',
    role: UserRole.USER,
    creditScore: 79,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user34@swapcampus.local',
    password: 'user34',
    displayName: '旅同学',
    studentId: '20260034',
    college: '旅游管理学院',
    role: UserRole.USER,
    creditScore: 68,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user35@swapcampus.local',
    password: 'user35',
    displayName: '传同学',
    studentId: '20260035',
    college: '传媒学院',
    role: UserRole.USER,
    creditScore: 87,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user36@swapcampus.local',
    password: 'user36',
    displayName: '海同学',
    studentId: '20260036',
    college: '海洋学院',
    role: UserRole.USER,
    creditScore: 75,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user37@swapcampus.local',
    password: 'user37',
    displayName: '文同学',
    studentId: '20260037',
    college: '人文社会科学学院',
    role: UserRole.USER,
    creditScore: 78,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user38@swapcampus.local',
    password: 'user38',
    displayName: '继同学',
    studentId: '20260038',
    college: '继续教育学院',
    role: UserRole.USER,
    creditScore: 71,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user39@swapcampus.local',
    password: 'user39',
    displayName: '保同学',
    studentId: '20260039',
    college: '生态与自然保护学院',
    role: UserRole.USER,
    creditScore: 82,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user40@swapcampus.local',
    password: 'user40',
    displayName: '材同学二',
    studentId: '20260040',
    college: '材料科学与技术学院',
    role: UserRole.USER,
    creditScore: 69,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user41@swapcampus.local',
    password: 'user41',
    displayName: '继同学二',
    studentId: '20260041',
    college: '继续教育学院',
    role: UserRole.USER,
    creditScore: 80,
    verificationStatus: VerificationStatus.APPROVED,
    accountStatus: AccountStatus.ACTIVE
  },
  {
    email: 'user42@swapcampus.local',
    password: 'user42',
    displayName: '国同学二',
    studentId: '20260042',
    college: '国际学院',
    role: UserRole.USER,
    creditScore: 77,
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
