export const PRODUCT_CATEGORY_NAMES = [
  '数码电子',
  '教材资料',
  '宿舍生活',
  '鞋服箱包',
  '运动出行',
  '美妆个护',
  '办公文具',
  '卡券票务',
  '兴趣文娱',
  '其他'
] as const;

export type ProductCategoryName = (typeof PRODUCT_CATEGORY_NAMES)[number];

const LEGACY_PRODUCT_CATEGORY_MAP: Record<string, ProductCategoryName> = {
  数码: '数码电子',
  教材: '教材资料',
  考研资料: '教材资料',
  生活用品: '宿舍生活',
  宿舍好物: '宿舍生活',
  小家电: '宿舍生活',
  鞋服: '鞋服箱包',
  运动器材: '运动出行',
  自行车: '运动出行',
  文具: '办公文具'
};

export function normalizeProductCategoryName(category?: string | null): ProductCategoryName {
  if (!category) {
    return '其他';
  }

  return LEGACY_PRODUCT_CATEGORY_MAP[category] ?? (
    PRODUCT_CATEGORY_NAMES.includes(category as ProductCategoryName)
      ? category as ProductCategoryName
      : '其他'
  );
}
