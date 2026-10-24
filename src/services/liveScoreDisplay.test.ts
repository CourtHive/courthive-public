import { formatLiveScore, hasOfficialScore, sanitizeLiveScore, withLiveScore } from './liveScoreDisplay';
import { describe, expect, it } from 'vitest';

describe('formatLiveScore', () => {
  it('formats sets and game points from side 1', () => {
    const score = {
      sets: [
        { setNumber: 1, side1Score: 6, side2Score: 3 },
        { setNumber: 2, side1Score: 2, side2Score: 1, side1PointScore: '30', side2PointScore: '15' },
      ],
    };
    expect(formatLiveScore(score)).toBe('6-3 2-1 (30-15)');
  });

  it("formats from side 2's perspective, with the loser's tiebreak points", () => {
    const score = { sets: [{ side1Score: 6, side2Score: 7, side1TiebreakScore: 4, side2TiebreakScore: 7 }] };
    expect(formatLiveScore(score, 1)).toBe('6-7(4)');
    expect(formatLiveScore(score, 2)).toBe('7-6(4)');
  });

  it("falls back to the producer's string, and is empty for no score", () => {
    expect(formatLiveScore({ sets: [], scoreStringSide1: '6-4 1-0' })).toBe('6-4 1-0');
    expect(formatLiveScore(undefined)).toBe('');
  });
});

describe('sanitizeLiveScore', () => {
  it('keeps display fields of the right type and drops everything else', () => {
    expect(
      sanitizeLiveScore({ sets: [{ setNumber: 1, side1Score: 2, side2Score: '<img>', injected: 'x' }], extra: 1 }),
    ).toEqual({ sets: [{ setNumber: 1, side1Score: 2 }] });
  });

  it('is undefined for a frame with nothing to show', () => {
    expect(sanitizeLiveScore({ sets: [] })).toBeUndefined();
    expect(sanitizeLiveScore('6-4')).toBeUndefined();
  });
});

describe('hasOfficialScore', () => {
  it('is true for a winner, an ending status, or entered games', () => {
    expect(hasOfficialScore({ winningSide: 1 })).toBe(true);
    expect(hasOfficialScore({ matchUpStatus: 'WALKOVER' })).toBe(true);
    expect(hasOfficialScore({ score: { sets: [{ side1Score: 0, side2Score: 1 }] } })).toBe(true);
  });

  it('is false for an unscored matchUp', () => {
    expect(hasOfficialScore({ matchUpStatus: 'TO_BE_PLAYED' })).toBe(false);
  });
});

describe('withLiveScore', () => {
  const live = { sets: [{ setNumber: 1, side1Score: 4, side2Score: 3 }] };

  it('returns an IN_PROGRESS display copy with both side strings, never a winner', () => {
    const original = { matchUpId: 'm1', matchUpStatus: 'TO_BE_PLAYED' };
    const copy: any = withLiveScore(original, live);
    expect(copy).not.toBe(original);
    expect(copy.matchUpStatus).toBe('IN_PROGRESS');
    expect(copy.score).toEqual({ sets: live.sets, scoreStringSide1: '4-3', scoreStringSide2: '3-4' });
    expect(copy.liveTracked).toBe(true);
    expect(copy.winningSide).toBeUndefined();
    expect(original).toEqual({ matchUpId: 'm1', matchUpStatus: 'TO_BE_PLAYED' });
  });

  it('leaves an officially scored or untracked matchUp as the same object', () => {
    const official = { matchUpId: 'm1', winningSide: 2, matchUpStatus: 'COMPLETED' };
    expect(withLiveScore(official, live)).toBe(official);
    const untracked = { matchUpId: 'm2' };
    expect(withLiveScore(untracked, undefined)).toBe(untracked);
  });
});
