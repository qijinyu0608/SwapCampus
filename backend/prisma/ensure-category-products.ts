import { PrismaClient, ProductStatus } from '@prisma/client';
import { PRODUCT_CATEGORY_NAMES, type ProductCategoryName } from './product-category-migration';

const prisma = new PrismaClient();

const categories = [...PRODUCT_CATEGORY_NAMES];

const imagePoolByCategory: Record<ProductCategoryName, string[]> = {
  数码电子: ['/images/products/keyboard.jpg', '/images/products/powerbank.png'],
  教材资料: ['/images/products/books-1.jpg', '/images/products/books-2.jpg'],
  宿舍生活: ['/images/products/lamp.jpg', '/images/products/storage-shelf.jpg', '/images/products/fan.jpg'],
  鞋服箱包: ['/images/products/clothing-rack.jpg', '/images/products/plush.jpg'],
  运动出行: ['/images/products/badminton.jpg', '/images/products/storage-shelf.jpg'],
  美妆个护: ['/images/products/demo-square.png'],
  办公文具: ['/images/products/books-1.jpg', '/images/products/books-2.jpg'],
  卡券票务: ['/images/products/demo-square.png'],
  兴趣文娱: ['/images/products/demo-square.png'],
  其他: ['/images/products/demo-square.png']
};

const guaranteedTemplates: Record<ProductCategoryName, { title: string; description: string; price: number; condition: string; tags: string[] }> = {
  数码电子: {
    title: '机械键盘宿舍自用款',
    description: '功能正常，接口和按键都没问题，可以当面试用。',
    price: 88,
    condition: '95新',
    tags: ['键盘', '可验货']
  },
  教材资料: {
    title: '高数教材整套',
    description: '上学期课程结束后闲置，内容完整，少量标记，适合继续接着用。',
    price: 25,
    condition: '9成新',
    tags: ['高数', '校内面交']
  },
  宿舍生活: {
    title: '宿舍三层收纳架',
    description: '搬宿舍整理出来的，放零食和日用品都方便。',
    price: 26,
    condition: '9成新',
    tags: ['收纳', '宿舍']
  },
  鞋服箱包: {
    title: '运动外套 M 码',
    description: '上课和晨跑穿过几次，洗净后一直放在柜子里。',
    price: 39,
    condition: '9成新',
    tags: ['外套', 'M码']
  },
  运动出行: {
    title: '羽毛球拍双拍套装',
    description: '社团活动后闲置，拍线状态正常，校内可约试看。',
    price: 52,
    condition: '9成新',
    tags: ['羽毛球', '社团']
  },
  美妆个护: {
    title: '防晒霜全新未拆',
    description: '备份买多了，日期新，适合夏天通勤和军训备用。',
    price: 34,
    condition: '95新',
    tags: ['防晒', '全新']
  },
  办公文具: {
    title: '函数计算器考试版',
    description: '按键和显示都正常，考试周和课程作业都能继续用。',
    price: 46,
    condition: '95新',
    tags: ['计算器', '考试']
  },
  卡券票务: {
    title: '打印券打包转',
    description: '本学期没用完，适合期末打印资料，校内直接转给同学。',
    price: 18,
    condition: '95新',
    tags: ['打印券', '低价']
  },
  兴趣文娱: {
    title: '尤克里里入门套装',
    description: '买来练过一段时间，现在闲置，琴包和调音器一起出。',
    price: 96,
    condition: '9成新',
    tags: ['乐器', '入门']
  },
  其他: {
    title: '毕业清仓杂物打包',
    description: '一些宿舍闲置一起带走，适合顺路捡漏。',
    price: 20,
    condition: '8成新',
    tags: ['打包', '毕业清仓']
  }
};

async function main() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { id: 'asc' }],
    select: { id: true, displayName: true }
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
        tags: template.tags,
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

    console.log(`[db:ensure-category-products] created ${category}: ${template.title} (seller ${seller.displayName})`);
  }
}

main()
  .catch((error) => {
    console.error('[db:ensure-category-products] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
