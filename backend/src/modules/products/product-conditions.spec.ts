import {
  formatProductConditionValue,
  parseProductConditionValue
} from './product-conditions';

describe('product condition helpers', () => {
  it('formats condition values into Chinese labels', () => {
    expect(formatProductConditionValue(10)).toBe('全新');
    expect(formatProductConditionValue(9)).toBe('九成');
    expect(formatProductConditionValue(9.5)).toBe('九五成');
    expect(formatProductConditionValue(8)).toBe('八成');
  });

  it('parses Chinese condition labels', () => {
    expect(parseProductConditionValue('全新')).toBe(10);
    expect(parseProductConditionValue('九成')).toBe(9);
    expect(parseProductConditionValue('九五成')).toBe(9.5);
    expect(parseProductConditionValue('八成')).toBe(8);
  });

  it('keeps compatibility with legacy numeric labels', () => {
    expect(parseProductConditionValue('9.5成')).toBe(9.5);
    expect(parseProductConditionValue('9成新')).toBe(9);
    expect(parseProductConditionValue('95新')).toBe(9.5);
  });
});
