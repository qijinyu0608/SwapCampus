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

export function isProductCategoryName(category?: string | null): category is ProductCategoryName {
  return Boolean(category) && PRODUCT_CATEGORY_NAMES.includes(category as ProductCategoryName);
}

export function normalizeProductCategoryName(category?: string | null): ProductCategoryName {
  return isProductCategoryName(category) ? category : '其他';
}
