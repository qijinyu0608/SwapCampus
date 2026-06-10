import { AccountStatus, PrismaClient, VerificationStatus } from '@prisma/client';
import { normalizeProductCategoryName, PRODUCT_CATEGORY_NAMES } from './product-category-migration';

const prisma = new PrismaClient();
const PRODUCT_CONDITION_VALUES = ['95新', '9成新', '8成新'] as const;
const LEGACY_CATEGORY_NAMES = ['数码', '教材', '考研资料', '生活用品', '宿舍好物', '小家电', '鞋服', '运动器材', '自行车', '文具'];
const VERIFICATION_STATUS_VALUES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

function sanitizeProductTitle(title: string) {
  return title.replace(/\s+(95新|9成新|8成新)$/u, '').replace(/\s+/g, ' ').trim();
}

function sanitizeProductTags(tags: unknown, category: string) {
  const blocked = new Set([
    ...PRODUCT_CATEGORY_NAMES,
    ...LEGACY_CATEGORY_NAMES,
    ...PRODUCT_CONDITION_VALUES,
    category
  ]);

  const rawTags = Array.isArray(tags) ? tags : [];

  return rawTags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index)
    .filter((tag) => !blocked.has(tag))
    .slice(0, 6);
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      category: true,
      condition: true,
      tags: true
    }
  });

  let cleanedProducts = 0;
  for (const product of products) {
    const category = normalizeProductCategoryName(product.category);
    const condition = PRODUCT_CONDITION_VALUES.includes(product.condition as (typeof PRODUCT_CONDITION_VALUES)[number])
      ? product.condition
      : '9成新';
    const title = sanitizeProductTitle(product.title);
    const tags = sanitizeProductTags(product.tags, category);

    if (
      category === product.category &&
      condition === product.condition &&
      title === product.title &&
      JSON.stringify(tags) === JSON.stringify(product.tags)
    ) {
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        title,
        category,
        condition,
        tags
      }
    });
    cleanedProducts += 1;
  }

  const users = await prisma.user.findMany({
    include: { verification: true }
  });

  let cleanedUsers = 0;
  for (const user of users) {
    const displayName = user.displayName.trim() || `用户${user.id}`;
    const email = user.email.trim().toLowerCase();
    const studentId = user.studentId?.trim() || null;
    const verificationStatus = VERIFICATION_STATUS_VALUES.includes(user.verificationStatus as (typeof VERIFICATION_STATUS_VALUES)[number])
      ? user.verificationStatus
      : VerificationStatus.PENDING;
    const realName = user.verification?.realName?.trim() || displayName;
    const college = user.verification?.college?.trim() || '待填写';
    const phone = user.verification?.phone?.trim() || '待填写';
    const accountStatus = user.accountStatus === AccountStatus.BANNED ? AccountStatus.BANNED : AccountStatus.ACTIVE;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName,
        email,
        studentId,
        verificationStatus,
        accountStatus,
        verification: {
          upsert: {
            update: {
              realName,
              college,
              phone
            },
            create: {
              realName,
              college,
              phone
            }
          }
        }
      }
    });
    cleanedUsers += 1;
  }

  console.log(`[db:clean-domain-data] cleaned ${cleanedProducts} products and ${cleanedUsers} users`);
}

main()
  .catch((error) => {
    console.error('[db:clean-domain-data] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
