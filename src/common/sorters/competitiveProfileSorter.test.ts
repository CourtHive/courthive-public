import { describe, it, expect } from 'vitest';
import { competitiveProfileSorter } from './competitiveProfileSorter';

describe('competitiveProfileSorter', () => {
  it('sorts higher pctSpread first (descending)', () => {
    expect(competitiveProfileSorter({ pctSpread: 0.8 }, { pctSpread: 0.5 })).toBeLessThan(0);
    expect(competitiveProfileSorter({ pctSpread: 0.3 }, { pctSpread: 0.9 })).toBeGreaterThan(0);
  });

  it('returns 0 for equal values', () => {
    expect(competitiveProfileSorter({ pctSpread: 0.5 }, { pctSpread: 0.5 })).toBe(0);
  });

  it('sorts present before absent', () => {
    expect(competitiveProfileSorter({ pctSpread: 0.5 }, {})).toBe(-1);
    expect(competitiveProfileSorter({}, { pctSpread: 0.5 })).toBe(1);
  });

  it('returns 0 when both absent', () => {
    expect(competitiveProfileSorter({}, {})).toBe(0);
  });
});
