import { seatUpdatedDrawPositions, resolveSeating } from './seatUpdatedDrawPositions';
import { describe, it, expect } from 'vitest';

/**
 * The live `matchUpUpdate` payload carries a raw matchUp with no `sides`, and its `drawPositions`
 * is COMPACTED. Seating by array index therefore put an arrival on side 1 whenever it belonged on
 * side 2 — overwriting, with a guess, the correct binding this view already held from getEventData.
 *
 * The cases below are the ones a replay of 10 draw types x 3 sizes produced, rounds played in
 * REVERSE roundPosition order so the upper source finishes first. Played in ascending order the
 * defect is invisible, because side 1 coincides with index 0.
 */
describe('seating a live update onto sides', () => {
  const priorRound = [
    { roundPosition: 1, drawPositions: [1, 2] },
    { roundPosition: 2, drawPositions: [3, 4] },
    { roundPosition: 3, drawPositions: [5, 6] },
    { roundPosition: 4, drawPositions: [7, 8] },
  ];

  it('seats both positions by the numerically lower rule', () => {
    const seating = resolveSeating({ drawPositions: [4, 3] });
    expect(seating?.get(1)).toEqual(3);
    expect(seating?.get(2)).toEqual(4);
  });

  it('puts an arrival from the UPPER source on side 2 — where the index said side 1', () => {
    // SINGLE_ELIMINATION 8, round 2 roundPosition 1: dp3 won round 1 roundPosition 2.
    const seating = resolveSeating({
      priorRoundMatchUps: priorRound,
      thisRoundMatchUpsCount: 2,
      drawPositions: [3],
      roundPosition: 1,
    });
    expect(seating?.get(2)).toEqual(3);
    expect(seating?.has(1)).toEqual(false);
  });

  it('puts an arrival from the lower source on side 1', () => {
    const seating = resolveSeating({
      priorRoundMatchUps: priorRound,
      thisRoundMatchUpsCount: 2,
      drawPositions: [1],
      roundPosition: 1,
    });
    expect(seating?.get(1)).toEqual(1);
  });

  it('keeps the seat a position already holds, whatever the index would say', () => {
    const seating = resolveSeating({
      existingSides: [{ sideNumber: 1 }, { sideNumber: 2, drawPosition: 4 }],
      drawPositions: [4],
    });
    expect(seating?.get(2)).toEqual(4);
    expect(seating?.has(1)).toEqual(false);
  });

  it('declines where the round does not halve', () => {
    // DOUBLE_ELIMINATION's Main final: the second side arrives over a WINNER link from the
    // Backdraw, so the two prior-round sources cannot account for both sides.
    const seating = resolveSeating({
      priorRoundMatchUps: [{ roundPosition: 1, drawPositions: [1, 2] }],
      thisRoundMatchUpsCount: 1,
      drawPositions: [1],
      roundPosition: 1,
    });
    expect(seating).toBeUndefined();
  });

  it('declines when no source uniquely holds the arriving position', () => {
    expect(
      resolveSeating({
        priorRoundMatchUps: priorRound,
        thisRoundMatchUpsCount: 2,
        drawPositions: [99],
        roundPosition: 1,
      }),
    ).toBeUndefined();
    expect(resolveSeating({ drawPositions: [] })).toBeUndefined();
  });

  it('reports a decline instead of mutating the matchUp', () => {
    const sides = [{ sideNumber: 1, drawPosition: 5 }, { sideNumber: 2 }];
    const matchUp: any = { roundNumber: 4, roundPosition: 1, drawPositions: [5], sides };
    const result = seatUpdatedDrawPositions({
      priorRoundMatchUps: [{ roundPosition: 1, drawPositions: [7, 8] }],
      thisRoundMatchUpsCount: 1,
      drawPositions: [1],
      matchUp,
    });
    expect(result.seated).toEqual(false);
    expect(matchUp.drawPositions).toEqual([5]);
    expect(matchUp.sides).toBe(sides);
  });

  it('empties a side the update no longer seats, rather than leaving the previous occupant', () => {
    const matchUp: any = {
      roundNumber: 2,
      roundPosition: 1,
      sides: [
        { sideNumber: 1, drawPosition: 1, participantId: 'p1', participant: { participantId: 'p1' } },
        { sideNumber: 2, drawPosition: 3, participantId: 'p3', participant: { participantId: 'p3' } },
      ],
    };
    const result = seatUpdatedDrawPositions({
      participantByDrawPosition: new Map([[3, { participantId: 'p3' }]]),
      drawPositions: [3],
      matchUp,
    });
    expect(result.seated).toEqual(true);
    expect(matchUp.sides[0]).toEqual({ sideNumber: 1 });
    expect(matchUp.sides[1].drawPosition).toEqual(3);
    expect(matchUp.sides[1].participantId).toEqual('p3');
  });

  it('attaches the participant for a newly seated position', () => {
    const matchUp: any = { roundNumber: 2, roundPosition: 1, sides: [{ sideNumber: 1 }, { sideNumber: 2 }] };
    seatUpdatedDrawPositions({
      participantByDrawPosition: new Map([[3, { participantId: 'p3' }]]),
      priorRoundMatchUps: priorRound,
      thisRoundMatchUpsCount: 2,
      drawPositions: [3],
      matchUp,
    });
    expect(matchUp.sides.find((s: any) => s.sideNumber === 2)).toEqual({
      sideNumber: 2,
      drawPosition: 3,
      participantId: 'p3',
      participant: { participantId: 'p3' },
    });
  });
});

describe('participants on a seat that changed', () => {
  it('does not carry the previous occupant onto a different drawPosition', () => {
    const matchUp: any = {
      roundNumber: 2,
      roundPosition: 1,
      sides: [
        { sideNumber: 1, drawPosition: 1, participantId: 'p1', participant: { participantId: 'p1' } },
        { sideNumber: 2 },
      ],
    };
    // dp2 arrives on side 1 and no participant is known for it
    seatUpdatedDrawPositions({ participantByDrawPosition: new Map(), drawPositions: [2, 5], matchUp });
    expect(matchUp.sides[0]).toEqual({ sideNumber: 1, drawPosition: 2 });
    expect(matchUp.sides[0].participantId).toBeUndefined();
  });

  it('keeps a known participant when the position is unchanged', () => {
    const matchUp: any = {
      roundNumber: 2,
      roundPosition: 1,
      sides: [
        { sideNumber: 1, drawPosition: 1, participantId: 'p1', participant: { participantId: 'p1' } },
        { sideNumber: 2 },
      ],
    };
    seatUpdatedDrawPositions({ participantByDrawPosition: new Map(), drawPositions: [1, 5], matchUp });
    expect(matchUp.sides[0].participantId).toEqual('p1');
  });
});
