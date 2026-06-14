export const PRODUCT_CONDITION_MIN = 0;
export const PRODUCT_CONDITION_MAX = 10;
export const PRODUCT_CONDITION_STEP = 0.1;

export function formatProductConditionValue(condition: number) {
  if (condition >= PRODUCT_CONDITION_MAX) {
    return '全新';
  }

  return `${condition.toFixed(1)}成`;
}

export function parseProductConditionValue(condition?: string | null) {
  if (!condition) {
    return null;
  }

  if (condition === '全新') {
    return PRODUCT_CONDITION_MAX;
  }

  const match = condition.match(/^(\d+(?:\.\d)?)成$/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
}

export function isProductConditionValue(condition?: string | null) {
  const parsed = parseProductConditionValue(condition);
  if (parsed === null) {
    return false;
  }

  if (parsed < PRODUCT_CONDITION_MIN || parsed > PRODUCT_CONDITION_MAX) {
    return false;
  }

  const scaled = Math.round(parsed * 10);
  return Math.abs(parsed * 10 - scaled) < 1e-8;
}
