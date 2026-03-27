import { describe, it, expect } from 'vitest';
import { percentSorter } from './percentSorter';

describe('percentSorter', () => {
  it('sorts higher values first (descending)', () => {
    expect(percentSorter(80, 60)).toBeLessThan(0);
    expect(percentSorter(30, 90)).toBeGreaterThan(0);
  });

  it('returns 0 for equal values', () => {
    expect(percentSorter(50, 50)).toBe(0);
  });

  it('sorts present before absent', () => {
    expect(percentSorter(50, 0)).toBe(-1);
    expect(percentSorter(0, 50)).toBe(1);
  });

  it('returns -1 when both absent', () => {
    expect(percentSorter(0, 0)).toBe(-1);
  });
});
