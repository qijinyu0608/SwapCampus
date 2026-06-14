export const PRODUCT_CONDITION_MIN = 0;
export const PRODUCT_CONDITION_MAX = 10;
export const PRODUCT_CONDITION_STEP = 0.1;

const CHINESE_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const;

function toChineseDigit(value: number) {
  return CHINESE_DIGITS[value as keyof typeof CHINESE_DIGITS] ?? String(value);
}

function parseChineseDigit(value: string) {
  const index = CHINESE_DIGITS.indexOf(value as (typeof CHINESE_DIGITS)[number]);
  return index >= 0 ? index : null;
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
    const major = parseChineseDigit(decimalMatch[1]);
    const minor = parseChineseDigit(decimalMatch[2]);
    if (major !== null && minor !== null) {
      return major + minor / 10;
    }
  }

  const compactDecimalMatch = normalized.match(/^([零一二三四五六七八九])([零一二三四五六七八九])新$/);
  if (compactDecimalMatch) {
    const major = parseChineseDigit(compactDecimalMatch[1]);
    const minor = parseChineseDigit(compactDecimalMatch[2]);
    if (major !== null && minor !== null) {
      return major + minor / 10;
    }
  }

  const compactConditionMatch = normalized.match(/^([零一二三四五六七八九])([零一二三四五六七八九])成$/);
  if (compactConditionMatch) {
    const major = parseChineseDigit(compactConditionMatch[1]);
    const minor = parseChineseDigit(compactConditionMatch[2]);
    if (major !== null && minor !== null) {
      return major + minor / 10;
    }
  }

  const wholeMatch = normalized.match(/^([零一二三四五六七八九十])成?新?$/);
  if (wholeMatch) {
    if (wholeMatch[1] === '十') {
      return PRODUCT_CONDITION_MAX;
    }

    const value = parseChineseDigit(wholeMatch[1]);
    if (value !== null) {
      return value;
    }
  }

  const numberMatch = normalized.match(/^(\d+(?:\.\d)?)成(?:新)?$/);
  if (numberMatch) {
    const value = Number(numberMatch[1]);
    return Number.isFinite(value) ? value : null;
  }

  const legacyMatch = normalized.match(/^(\d{2})新$/);
  if (legacyMatch) {
    const value = Number(legacyMatch[1]) / 10;
    return Number.isFinite(value) ? value : null;
  }

  return null;
}
