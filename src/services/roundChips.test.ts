import { describe, expect, it } from 'vitest';

import { buildRoundChips, isRoundSelectable, resolveInitialRoundNumber } from './roundChips';

/** Shape mirrors `getEventData` structures: in-context matchUps per round. */
function matchUp(roundNumber: number, abbreviatedRoundName?: string, roundName?: string) {
  return { roundNumber, abbreviatedRoundName, roundName, matchUpId: `${roundNumber}-${Math.random()}` };
}

describe('buildRoundChips', () => {
  it('builds one ordered chip per round with the factory abbreviation', () => {
    const matchUps = [
      matchUp(2, 'SF'),
      matchUp(1, 'QF'),
      matchUp(1, 'QF'),
      matchUp(3, 'F'),
      matchUp(2, 'SF'),
      matchUp(1, 'QF'),
      matchUp(1, 'QF'),
    ];
    expect(buildRoundChips(matchUps)).toEqual([
      { roundNumber: 1, label: 'QF', matchUpCount: 4 },
      { roundNumber: 2, label: 'SF', matchUpCount: 2 },
      { roundNumber: 3, label: 'F', matchUpCount: 1 },
    ]);
  });

  it('falls back to roundName, then to R{n}', () => {
    const chips = buildRoundChips([matchUp(1, undefined, 'Round of 32'), matchUp(2, '   ', '  '), matchUp(3)]);
    expect(chips.map((c) => c.label)).toEqual(['Round of 32', 'R2', 'R3']);
  });

  it('ignores matchUps with no usable round number', () => {
    expect(buildRoundChips([{ matchUpId: 'x' }, { roundNumber: 0 }, { roundNumber: 'nope' }])).toEqual([]);
  });

  it('handles an empty / undefined input', () => {
    expect(buildRoundChips([])).toEqual([]);
    expect(buildRoundChips(undefined as any)).toEqual([]);
  });

  it('does not reorder the source array', () => {
    const matchUps = [matchUp(3, 'F'), matchUp(1, 'QF')];
    const firstId = matchUps[0].matchUpId;
    buildRoundChips(matchUps);
    expect(matchUps[0].matchUpId).toBe(firstId);
  });
});

describe('isRoundSelectable', () => {
  const chips = buildRoundChips([matchUp(1, 'QF'), matchUp(2, 'SF'), matchUp(3, 'F')]);

  it('selects on an elimination structure with 3+ rounds', () => {
    expect(isRoundSelectable({ chips })).toBe(true);
  });

  it('does not select with fewer than 3 rounds', () => {
    expect(isRoundSelectable({ chips: chips.slice(0, 2) })).toBe(false);
    expect(isRoundSelectable({ chips: [] })).toBe(false);
  });

  it('never selects for round robin or ad hoc', () => {
    expect(isRoundSelectable({ chips, isRoundRobin: true })).toBe(false);
    expect(isRoundSelectable({ chips, isAdHoc: true })).toBe(false);
  });
});

describe('resolveInitialRoundNumber', () => {
  const chips = buildRoundChips([matchUp(1, 'QF'), matchUp(2, 'SF'), matchUp(3, 'F')]);

  it('honours a selection that exists', () => {
    expect(resolveInitialRoundNumber({ chips, selectedRoundNumber: 2 })).toBe(2);
  });

  it('falls back to round 1 with no selection', () => {
    expect(resolveInitialRoundNumber({ chips })).toBe(1);
  });

  it('falls back to round 1 for a stale out-of-range selection', () => {
    // e.g. viewer was on SF of a 3-round structure, then switched to a
    // 1-round playoff — round 2 no longer exists.
    expect(resolveInitialRoundNumber({ chips: chips.slice(0, 1), selectedRoundNumber: 3 })).toBe(1);
  });

  it('resets to round 1 while a search is active, whatever was selected', () => {
    expect(resolveInitialRoundNumber({ chips, selectedRoundNumber: 3, searchActive: true })).toBe(1);
  });
});
