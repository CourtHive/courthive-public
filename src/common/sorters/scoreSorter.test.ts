import { describe, it, expect } from 'vitest';
import { scoreSorter } from './scoreSorter';

describe('scoreSorter', () => {
  it('sorts scored before unscored', () => {
    expect(scoreSorter({ score: '6-4 6-3' }, { score: '' })).toBe(-1);
    expect(scoreSorter({ score: '' }, { score: '6-4 6-3' })).toBe(1);
  });

  it('returns 0 when both have scores', () => {
    expect(scoreSorter({ score: '6-4' }, { score: '7-5' })).toBe(0);
  });

  it('sorts readyToScore before not ready when both unscored', () => {
    expect(scoreSorter({ readyToScore: true }, { readyToScore: false })).toBe(-1);
    expect(scoreSorter({ readyToScore: false }, { readyToScore: true })).toBe(1);
  });

  it('returns 0 when neither has score or readyToScore', () => {
    expect(scoreSorter({}, {})).toBe(0);
  });

  it('ignores readyToScore when scores exist', () => {
    expect(scoreSorter({ score: '6-1', readyToScore: false }, { score: '6-2', readyToScore: true })).toBe(0);
  });
});
