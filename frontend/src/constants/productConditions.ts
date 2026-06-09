export const PRODUCT_CONDITION_VALUES = [
  '95新',
  '9成新',
  '8成新'
] as const;

export type ProductConditionValue = (typeof PRODUCT_CONDITION_VALUES)[number];
