import { describe, expect, it } from 'vitest';
import { mapRound } from './mapRound';

/**
 * A combined-point total that allows a tie (SET1-S:P32) can end 16-16, COMPLETED with no winner (CA,
 * 2026-10-11: ties are valid). The rounds table read "complete" as "has a winner", so a tie showed as
 * unfinished; and once the factory stops calling a finished tie ready to score, its score would vanish.
 */
const side = (participantId: string) => ({ participant: { participantId, participantName: participantId } });
const matchUp = (extra: Record<string, unknown>) => ({
  matchUpId: 'm1',
  drawId: 'd1',
  eventId: 'e1',
  sides: [side('a'), side('b')],
  ...extra,
});

describe('mapRound', () => {
  it('a completed tie is complete and shows its score, with no winner', () => {
    const row = mapRound(
      matchUp({ matchUpStatus: 'COMPLETED', readyToScore: false, score: { scoreStringSide1: '16-16' } }),
    );
    expect(row.complete).toBe(true);
    expect(row.readyToScore).toBe(true);
    expect(row.score).toBe('16-16');
    expect(row.winningSide).toBeUndefined();
  });

  it('control: a won result is complete; an unplayed one is not', () => {
    expect(mapRound(matchUp({ matchUpStatus: 'COMPLETED', winningSide: 1 })).complete).toBe(true);
    const unplayed = mapRound(matchUp({ matchUpStatus: 'TO_BE_PLAYED', readyToScore: true }));
    expect(unplayed.complete).toBe(false);
    expect(unplayed.readyToScore).toBe(true);
  });
});
