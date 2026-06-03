import { PrismaClient, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

const categories = ['教材', '数码', '生活用品', '运动器材', '宿舍好物', '自行车', '文具', '小家电', '鞋服', '考研资料'] as const;

const imagePoolByCategory: Record<(typeof categories)[number], string[]> = {
  教材: ['/images/products/books-1.jpg', '/images/products/books-2.jpg'],
  数码: ['/images/products/keyboard.jpg', '/images/products/powerbank.png'],
  生活用品: ['/images/products/clothing-rack.jpg', '/images/products/storage-shelf.jpg', '/images/products/plush.jpg'],
  运动器材: ['/images/products/badminton.jpg'],
  宿舍好物: ['/images/products/lamp.jpg', '/images/products/fan.jpg', '/images/products/storage-shelf.jpg'],
  自行车: ['/images/products/badminton.jpg', '/images/products/storage-shelf.jpg'],
  文具: ['/images/products/books-1.jpg', '/images/products/books-2.jpg'],
  小家电: ['/images/products/fan.jpg', '/images/products/lamp.jpg'],
  鞋服: ['/images/products/clothing-rack.jpg', '/images/products/plush.jpg'],
  考研资料: ['/images/products/books-2.jpg', '/images/products/books-1.jpg']
};

const guaranteedTemplates: Record<(typeof categories)[number], { title: string; description: string; price: number; condition: string; tags: string[] }> = {
  教材: {
    title: '高数教材整套 9成新',
    description: '上学期课程结束后闲置，内容完整，少量标记，适合继续接着用。',
    price: 25,
    condition: '9成新',
    tags: ['教材', '高数', '校内面交']
  },
  数码: {
    title: '机械键盘宿舍自用款',
    description: '功能正常，接口和按键都没问题，可以当面试用。',
    price: 88,
    condition: '95新',
    tags: ['数码', '键盘', '可验货']
  },
  生活用品: {
    title: '宿舍三层收纳架',
    description: '搬宿舍整理出来的，放零食和日用品都方便。',
    price: 26,
    condition: '9成新',
    tags: ['生活用品', '收纳', '宿舍']
  },
  运动器材: {
    title: '羽毛球拍双拍套装',
    description: '社团活动后闲置，拍线状态正常，校内可约试看。',
    price: 52,
    condition: '9成新',
    tags: ['运动器材', '羽毛球', '社团']
  },
  宿舍好物: {
    title: '护眼宿舍台灯',
    description: '亮度稳定，晚自习和宿舍学习都很适合。',
    price: 29,
    condition: '95新',
    tags: ['宿舍好物', '台灯', '护眼']
  },
  自行车: {
    title: '校园骑行头盔',
    description: '平时骑车通勤用过，没有磕碰，内衬干净。',
    price: 35,
    condition: '9成新',
    tags: ['自行车', '头盔', '通勤']
  },
  文具: {
    title: '函数计算器考试版',
    description: '按键和显示都正常，考试周和课程作业都能继续用。',
    price: 46,
    condition: '95新',
    tags: ['文具', '计算器', '考试']
  },
  小家电: {
    title: '20000mAh 以下充电宝',
    description: '容量 10000mAh，接口和充电状态正常，宿舍和图书馆都方便备用。',
    price: 30,
    condition: '9成新',
    tags: ['小家电', '充电宝', '宿舍白名单']
  },
  鞋服: {
    title: '运动外套 M 码',
    description: '上课和晨跑穿过几次，洗净后一直放在柜子里。',
    price: 39,
    condition: '9成新',
    tags: ['鞋服', '外套', 'M码']
  },
  考研资料: {
    title: '考研政治冲刺资料',
    description: '重点内容完整，后期背诵和刷题都还能继续用。',
    price: 22,
    condition: '9成新',
    tags: ['考研资料', '政治', '冲刺']
  }
};

async function main() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true }
  });

  if (!users.length) {
    throw new Error('[db:ensure-category-products] no users found, cannot create products');
  }

  const grouped = await prisma.product.groupBy({
    by: ['category'],
    _count: { _all: true }
  });

  const countMap = new Map(grouped.map((item) => [item.category, item._count._all]));
  const missingCategories = categories.filter((category) => (countMap.get(category) ?? 0) < 1);

  if (!missingCategories.length) {
    console.log('[db:ensure-category-products] all categories already covered');
    return;
  }

  for (const [index, category] of missingCategories.entries()) {
    const seller = users[index % users.length];
    const template = guaranteedTemplates[category];
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        title: template.title,
        description: `${template.description} 默认约图书馆或学一食堂面交。`,
        price: template.price,
        category,
        condition: template.condition,
        tags: template.tags.join(','),
        status: ProductStatus.ON_SALE
      }
    });

    await prisma.productImage.createMany({
      data: imagePoolByCategory[category].map((imageUrl, sortOrder) => ({
        productId: product.id,
        imageUrl,
        sortOrder
      }))
    });

    console.log(`[db:ensure-category-products] created ${category}: ${template.title} (seller ${seller.name})`);
  }
}

main()
  .catch((error) => {
    console.error('[db:ensure-category-products] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
