import { describe, expect, it } from 'vitest';

import {
  filterRoundMatchUps,
  matchUpMatchesSearch,
  matchUpParticipantNames,
  normalizeSearch,
} from './participantMatch';

const ADA = 'Ada Lovelace';

const singlesMatchUp = {
  matchUpId: 'm1',
  sides: [{ participant: { participantName: ADA } }, { participant: { participantName: 'Alan Turing' } }],
};

const doublesMatchUp = {
  matchUpId: 'm2',
  sides: [
    {
      participant: {
        participantName: 'Lovelace/Babbage',
        individualParticipants: [{ participantName: ADA }, { participantName: 'Charles Babbage' }],
      },
    },
    { participant: { participantName: 'Turing/Hopper' } },
  ],
};

const byeMatchUp = { matchUpId: 'm3', matchUpStatus: 'BYE', sides: [{ participant: { participantName: ADA } }, {}] };

describe('normalizeSearch', () => {
  it('lower-cases and trims', () => {
    expect(normalizeSearch('  Ada  ')).toBe('ada');
  });

  it('treats null / undefined / whitespace as no filter', () => {
    expect(normalizeSearch(undefined)).toBe('');
    expect(normalizeSearch(null)).toBe('');
    expect(normalizeSearch('   ')).toBe('');
  });
});

describe('matchUpParticipantNames', () => {
  it('collects side names', () => {
    expect(matchUpParticipantNames(singlesMatchUp)).toEqual([ADA, 'Alan Turing']);
  });

  it('collects pair names AND their individuals', () => {
    expect(matchUpParticipantNames(doublesMatchUp)).toEqual([
      'Lovelace/Babbage',
      ADA,
      'Charles Babbage',
      'Turing/Hopper',
    ]);
  });

  it('returns [] for a matchUp with no sides', () => {
    expect(matchUpParticipantNames({})).toEqual([]);
    expect(matchUpParticipantNames(undefined)).toEqual([]);
  });
});

describe('matchUpMatchesSearch', () => {
  it('matches case-insensitively on a partial name', () => {
    expect(matchUpMatchesSearch(singlesMatchUp, 'lovel')).toBe(true);
    expect(matchUpMatchesSearch(singlesMatchUp, 'TURING')).toBe(true);
  });

  it('matches an individual inside a pair', () => {
    // The pair name is "Lovelace/Babbage" — searching "charles" only hits via
    // the individual participants, which is the whole reason they are read.
    expect(matchUpMatchesSearch(doublesMatchUp, 'charles')).toBe(true);
  });

  it('does not match an absent name', () => {
    expect(matchUpMatchesSearch(singlesMatchUp, 'hopper')).toBe(false);
  });

  it('matches everything when the search is empty', () => {
    expect(matchUpMatchesSearch(singlesMatchUp, '')).toBe(true);
    expect(matchUpMatchesSearch({}, '   ')).toBe(true);
  });

  it('does not match a matchUp with no names against a real search', () => {
    expect(matchUpMatchesSearch({ sides: [{}, {}] }, 'ada')).toBe(false);
  });
});

describe('filterRoundMatchUps', () => {
  const roundMatchUps = { 1: [singlesMatchUp, doublesMatchUp], 2: [byeMatchUp] };

  it('keeps only matching matchUps, preserving round keys', () => {
    const filtered = filterRoundMatchUps(roundMatchUps, 'babbage');
    expect(Object.keys(filtered)).toEqual(['1', '2']);
    expect(filtered['1'].map((m) => m.matchUpId)).toEqual(['m2']);
    expect(filtered['2']).toEqual([]);
  });

  it('copies rather than mutates when there is no filter', () => {
    const filtered = filterRoundMatchUps(roundMatchUps, '');
    expect(filtered['1']).toHaveLength(2);
    expect(filtered['1']).not.toBe(roundMatchUps[1]);
    expect(roundMatchUps['1']).toHaveLength(2);
  });

  it('does not mutate the source when filtering', () => {
    filterRoundMatchUps(roundMatchUps, 'nobody-by-this-name');
    expect(roundMatchUps['1']).toHaveLength(2);
    expect(roundMatchUps['2']).toHaveLength(1);
  });

  it('handles an undefined map', () => {
    expect(filterRoundMatchUps(undefined, 'ada')).toEqual({});
  });
});
