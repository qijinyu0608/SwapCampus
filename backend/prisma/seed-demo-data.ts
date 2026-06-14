import { AccountStatus, PrismaClient, ProductStatus, UserRole, VerificationStatus } from '@prisma/client';
import { syncSuperTokensUser } from './supertokens-sync';

const prisma = new PrismaClient();

const PRODUCT_IMAGES = [
  '/images/products/archive/badminton.jpg',
  '/images/products/archive/books-1.jpg',
  '/images/products/archive/books-2.jpg',
  '/images/products/archive/clothing-rack.jpg',
  '/images/products/archive/fan.jpg',
  '/images/products/archive/keyboard.jpg',
  '/images/products/archive/lamp.jpg',
  '/images/products/archive/plush.jpg',
  '/images/products/archive/powerbank.png',
  '/images/products/archive/storage-shelf.jpg'
];

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
  }
] as const;

const SAMPLE_CATALOG = [
  { title: '高数教材 A 版', category: '教材资料', condition: '9成新', price: 18, tags: ['教材', '高数'], description: '少量笔记，期末复习可直接使用。' },
  { title: '离散数学笔记整套', category: '教材资料', condition: '95新', price: 12, tags: ['笔记', '离散数学'], description: '按章节整理，适合考前突击。' },
  { title: '机械键盘 87 配列', category: '数码电子', condition: '8成新', price: 86, tags: ['键盘', '桌搭'], description: '青轴手感清晰，接口正常。' },
  { title: '蓝牙鼠标', category: '数码电子', condition: '9成新', price: 29, tags: ['鼠标', '蓝牙'], description: '轻度使用，电池仓正常。' },
  { title: '插电护眼台灯', category: '宿舍生活', condition: '9成新', price: 35, tags: ['台灯', '书桌'], description: '亮度稳定，适合宿舍学习。' },
  { title: '宿舍收纳架', category: '宿舍生活', condition: '8成新', price: 22, tags: ['收纳', '置物'], description: '层板稳固，适合桌面和床下整理。' },
  { title: '羽毛球拍单支', category: '运动出行', condition: '85新', price: 48, tags: ['羽毛球', '球拍'], description: '拉线完整，适合日常训练。' },
  { title: '骑行头盔', category: '运动出行', condition: '9成新', price: 40, tags: ['骑行', '头盔'], description: '通风款，校内通勤够用。' },
  { title: '双肩包 电脑仓', category: '鞋服箱包', condition: '8成新', price: 55, tags: ['双肩包', '通勤'], description: '拉链顺滑，容量够装 15 寸电脑。' },
  { title: '运动外套', category: '鞋服箱包', condition: '85新', price: 39, tags: ['外套', '运动'], description: '尺码标准，适合春秋。' },
  { title: '中性笔一盒', category: '办公文具', condition: '全新', price: 9, tags: ['文具', '中性笔'], description: '黑色 0.5mm，适合考试周囤货。' },
  { title: '文件收纳盒', category: '办公文具', condition: '95新', price: 14, tags: ['文件', '整理'], description: '桌面文件分类更方便。' },
  { title: '电影兑换券', category: '卡券票务', condition: '全新', price: 25, tags: ['电影', '兑换券'], description: '有效期内可用，信息真实。' },
  { title: '校园活动门票', category: '卡券票务', condition: '全新', price: 15, tags: ['活动', '门票'], description: '临时有事转让。' },
  { title: '拼图玩具', category: '兴趣文娱', condition: '9成新', price: 28, tags: ['拼图', '娱乐'], description: '零件齐全，周末放松用。' },
  { title: '毛绒抱枕', category: '兴趣文娱', condition: '95新', price: 20, tags: ['毛绒', '抱枕'], description: '干净柔软，宿舍可直接摆放。' },
  { title: '移动电源 10000mAh', category: '数码电子', condition: '9成新', price: 45, tags: ['充电宝', '数码'], description: '容量标注清晰，接口正常。' },
  { title: '小型置物推车', category: '其他', condition: '8成新', price: 30, tags: ['置物', '推车'], description: '适合零食和杂物分类。' }
] as const;

async function createDemoAccounts() {
  const users = [];

  for (const account of DEMO_ACCOUNTS) {
    const user = await syncSuperTokensUser(prisma, {
      ...account,
      requireRemoteCore: true
    });
    users.push(user);
  }

  return users;
}

async function createDemoProducts(sellerIds: number[], totalCount = 48) {
  let created = 0;

  for (let index = 0; index < totalCount; index += 1) {
    const base = SAMPLE_CATALOG[index % SAMPLE_CATALOG.length];
    const sellerId = sellerIds[index % sellerIds.length];
    const title = `${base.title} #${String(index + 1).padStart(3, '0')}`;
    const imageUrl = PRODUCT_IMAGES[index % PRODUCT_IMAGES.length];

    await prisma.product.create({
      data: {
        sellerId,
        title,
        description: `${base.description} 发布批次 ${index + 1}。`,
        price: base.price + (index % 5) * 3,
        category: base.category,
        condition: base.condition,
        tags: [...base.tags, `批次${(index % 8) + 1}`],
        status: ProductStatus.ON_SALE,
        images: {
          create: [{ imageUrl, sortOrder: 0 }]
        }
      }
    });

    created += 1;
  }

  return created;
}

async function main() {
  const users = await createDemoAccounts();
  const sellerIds = users.filter((user) => user.role === UserRole.USER).map((user) => user.id);
  const createdProducts = await createDemoProducts(sellerIds);

  console.log('[db:seed-demo-data] seeded demo accounts:');
  for (const account of DEMO_ACCOUNTS) {
    console.log(`- ${account.email} / ${account.password} / ${account.displayName}`);
  }
  console.log(`[db:seed-demo-data] created ${users.length} users and ${createdProducts} products`);
}

main()
  .catch((error) => {
    console.error('[db:seed-demo-data] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
