import { PrismaClient, ProductStatus } from '@prisma/client';
import { getLocalProductImage } from './product-image-pool';

const prisma = new PrismaClient();

const SAMPLE_CATALOG = [
  { title: '高数教材 A 版', category: '教材资料', condition: '九成', price: 18, tags: ['教材', '高数'], description: '少量笔记，期末复习可直接使用。' },
  { title: '离散数学笔记整套', category: '教材资料', condition: '九五成', price: 12, tags: ['笔记', '离散数学'], description: '按章节整理，适合考前突击。' },
  { title: '机械键盘 87 配列', category: '数码电子', condition: '八成', price: 86, tags: ['键盘', '宿舍桌搭'], description: '青轴手感清晰，接口正常。' },
  { title: '蓝牙鼠标', category: '数码电子', condition: '九成', price: 29, tags: ['鼠标', '蓝牙'], description: '轻度使用，电池仓正常。' },
  { title: '插电护眼台灯', category: '宿舍生活', condition: '九成', price: 35, tags: ['台灯', '书桌'], description: '插电款，亮度稳定，适合宿舍学习。' },
  { title: '宿舍收纳架', category: '宿舍生活', condition: '八成', price: 22, tags: ['收纳', '置物'], description: '层板稳固，适合桌面和床下整理。' },
  { title: '羽毛球拍单支', category: '运动出行', condition: '八五成', price: 48, tags: ['羽毛球', '球拍'], description: '拉线完整，适合日常训练。' },
  { title: '骑行头盔', category: '运动出行', condition: '九成', price: 40, tags: ['骑行', '头盔'], description: '通风款，校内通勤够用。' },
  { title: '双肩包 电脑仓', category: '鞋服箱包', condition: '八成', price: 55, tags: ['双肩包', '通勤'], description: '拉链顺滑，容量够装 15 寸电脑。' },
  { title: '运动外套', category: '鞋服箱包', condition: '八五成', price: 39, tags: ['外套', '运动'], description: '尺码标准，适合春秋。' },
  { title: '中性笔一盒', category: '办公文具', condition: '全新', price: 9, tags: ['文具', '中性笔'], description: '黑色 0.5mm，适合考试周囤货。' },
  { title: '文件收纳盒', category: '办公文具', condition: '九五成', price: 14, tags: ['文件', '整理'], description: '桌面文件分类更方便。' },
  { title: '电影兑换券', category: '卡券票务', condition: '全新', price: 25, tags: ['电影', '兑换券'], description: '有效期内可用，校内当面转。' },
  { title: '校园活动门票', category: '卡券票务', condition: '全新', price: 15, tags: ['活动', '门票'], description: '临时有事转让，信息真实。' },
  { title: '拼图玩具', category: '兴趣文娱', condition: '九成', price: 28, tags: ['拼图', '娱乐'], description: '零件齐全，周末放松用。' },
  { title: '毛绒抱枕', category: '兴趣文娱', condition: '九五成', price: 20, tags: ['毛绒', '抱枕'], description: '干净柔软，宿舍可直接摆放。' },
  { title: '移动电源 10000mAh', category: '数码电子', condition: '九成', price: 45, tags: ['充电宝', '数码'], description: '容量标注清晰，接口正常。' },
  { title: '小型置物推车', category: '其他', condition: '八成', price: 30, tags: ['置物', '推车'], description: '适合零食和杂物分类。' }
] as const;

function pickSellerIds(users: Array<{ id: number }>, limit = 12) {
  return users.slice(0, limit).map((user) => user.id);
}

async function main() {
  const requestedCount = Number(process.argv[2] ?? '60');
  const totalCount = Number.isFinite(requestedCount) && requestedCount > 0 ? Math.min(300, Math.floor(requestedCount)) : 60;

  const users = await prisma.user.findMany({
    where: { role: 'USER', accountStatus: 'ACTIVE' },
    select: { id: true },
    orderBy: { id: 'asc' }
  });

  const sellerIds = pickSellerIds(users);
  if (!sellerIds.length) {
    throw new Error('no active user found for sample product generation');
  }

  const existingSampleTitles = new Set(
    (await prisma.product.findMany({
      where: {
        OR: SAMPLE_CATALOG.map((item) => ({ title: { startsWith: item.title } }))
      },
      select: { title: true }
    })).map((item) => item.title)
  );

  let created = 0;
  for (let index = 0; index < totalCount; index += 1) {
    const base = SAMPLE_CATALOG[index % SAMPLE_CATALOG.length];
    const sellerId = sellerIds[index % sellerIds.length];
    const title = `${base.title} #${String(index + 1).padStart(3, '0')}`;

    if (existingSampleTitles.has(title)) {
      continue;
    }

    const imageUrl = getLocalProductImage(index);

    await prisma.product.create({
      data: {
        sellerId,
        title,
        description: `${base.description} 可校内面交，发布时间批次 ${index + 1}。`,
        price: base.price + (index % 5) * 3,
        category: base.category,
        condition: base.condition,
        tags: [...base.tags, `批次${(index % 10) + 1}`],
        status: ProductStatus.ON_SALE,
        images: {
          create: [
            { imageUrl, sortOrder: 0 }
          ]
        }
      }
    });

    created += 1;
  }

  console.log(`[db:generate-product-samples] created ${created} sample products`);
}

main()
  .catch((error) => {
    console.error('[db:generate-product-samples] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
