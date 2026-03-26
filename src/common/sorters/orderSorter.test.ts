import { describe, it, expect } from 'vitest';
import { orderSorter } from './orderSorter';

describe('orderSorter', () => {
  it('sorts lower values first (ascending)', () => {
    expect(orderSorter(1, 5)).toBeLessThan(0);
    expect(orderSorter(10, 3)).toBeGreaterThan(0);
  });

  it('returns 0 for equal values', () => {
    expect(orderSorter(4, 4)).toBe(0);
  });

  it('sorts present before absent', () => {
    expect(orderSorter(3, 0)).toBe(-1);
    expect(orderSorter(0, 3)).toBe(1);
  });

  it('returns -1 when both absent', () => {
    expect(orderSorter(0, 0)).toBe(-1);
  });
});
