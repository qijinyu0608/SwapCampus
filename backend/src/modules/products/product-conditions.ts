export const PRODUCT_CONDITION_MIN = 0;
export const PRODUCT_CONDITION_MAX = 10;
export const PRODUCT_CONDITION_STEP = 0.1;

const CHINESE_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const;

function toChineseDigit(value: number) {
  return CHINESE_DIGITS[value as keyof typeof CHINESE_DIGITS] ?? String(value);
}

export function formatProductConditionValue(condition: number) {
  if (condition >= PRODUCT_CONDITION_MAX) {
    return '全新';
  }

  const normalized = Math.round(condition * 10) / 10;
  const integerPart = Math.floor(normalized);
  const decimalPart = Math.round((normalized - integerPart) * 10);
  const integerLabel = toChineseDigit(integerPart);

  if (decimalPart === 0) {
    return `${integerLabel}成`;
  }

  return `${integerLabel}${toChineseDigit(decimalPart)}成`;
}

export function parseProductConditionValue(condition?: string | null) {
  if (!condition) {
    return null;
  }

  const normalized = condition.trim();

  if (normalized === '全新') {
    return PRODUCT_CONDITION_MAX;
  }

  const decimalMatch = normalized.match(/^([零一二三四五六七八九])点([零一二三四五六七八九])成?新?$/);
  if (decimalMatch) {
    const major = CHINESE_DIGITS.indexOf(decimalMatch[1] as (typeof CHINESE_DIGITS)[number]);
    const minor = CHINESE_DIGITS.indexOf(decimalMatch[2] as (typeof CHINESE_DIGITS)[number]);
    if (major >= 0 && minor >= 0) {
      return major + minor / 10;
    }
  }

  const compactDecimalMatch = normalized.match(/^([零一二三四五六七八九])([零一二三四五六七八九])新$/);
  if (compactDecimalMatch) {
    const major = CHINESE_DIGITS.indexOf(compactDecimalMatch[1] as (typeof CHINESE_DIGITS)[number]);
    const minor = CHINESE_DIGITS.indexOf(compactDecimalMatch[2] as (typeof CHINESE_DIGITS)[number]);
    if (major >= 0 && minor >= 0) {
      return major + minor / 10;
    }
  }

  const compactConditionMatch = normalized.match(/^([零一二三四五六七八九])([零一二三四五六七八九])成$/);
  if (compactConditionMatch) {
    const major = CHINESE_DIGITS.indexOf(compactConditionMatch[1] as (typeof CHINESE_DIGITS)[number]);
    const minor = CHINESE_DIGITS.indexOf(compactConditionMatch[2] as (typeof CHINESE_DIGITS)[number]);
    if (major >= 0 && minor >= 0) {
      return major + minor / 10;
    }
  }

  const wholeMatch = normalized.match(/^([零一二三四五六七八九十])成?新?$/);
  if (wholeMatch) {
    if (wholeMatch[1] === '十') {
      return PRODUCT_CONDITION_MAX;
    }

    const value = CHINESE_DIGITS.indexOf(wholeMatch[1] as (typeof CHINESE_DIGITS)[number]);
    if (value >= 0) {
      return value;
    }
  }

  const match = normalized.match(/^(\d+(?:\.\d)?)成(?:新)?$/);
  if (match) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  const legacyMatch = normalized.match(/^(\d{2})新$/);
  if (legacyMatch) {
    const value = Number(legacyMatch[1]) / 10;
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
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

export function normalizeProductConditionValue(condition?: string | null) {
  const parsed = parseProductConditionValue(condition);
  if (parsed === null) {
    return condition?.trim() ?? '';
  }

  return formatProductConditionValue(parsed);
}
