export const PRODUCT_CONDITION_MIN = 0;
export const PRODUCT_CONDITION_MAX = 10;
export const PRODUCT_CONDITION_STEP = 0.1;

export function formatProductConditionValue(condition: number) {
  if (condition >= PRODUCT_CONDITION_MAX) {
    return '全新';
  }

  return `${condition.toFixed(1)}成`;
}
