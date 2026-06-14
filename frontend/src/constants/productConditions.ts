export const PRODUCT_CONDITION_VALUES = [
  '未说明',
  '全新',
  '95新',
  '9成新',
  '85新',
  '8成新',
  '7成新',
  '6成新'
] as const;

export type ProductConditionValue = (typeof PRODUCT_CONDITION_VALUES)[number];
