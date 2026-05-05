import { describe, expect, it, vi } from 'vitest';

// courthive-components touches `document` at module-import time when its CSS
// side-effects load. courthive-public's vitest config has no DOM environment,
// so we mock the package down to just the symbols inlineCrowdScoring imports.
vi.mock('courthive-components', () => ({
  InlineScoringManager: vi.fn(),
  renderInlineMatchUp: vi.fn(),
}));

// crowdTracker calls indexedDB at runtime — mock it for these unit tests.
vi.mock('src/services/crowdTracker', () => ({
  saveSession: vi.fn(),
  listActiveSessions: vi.fn(async () => []),
}));

import { markReadyMatchUpsInProgress, withInlineScoringConfig, __test__ } from './inlineCrowdScoring';

describe('withInlineScoringConfig', () => {
  it('merges inlineScoring config without mutating the input composition', () => {
    const base = {
      configuration: { flags: true, genderColor: true },
      theme: { name: 'basicCard' },
    };
    const result = withInlineScoringConfig(base);
    expect(result.configuration.flags).toBe(true);
    expect(result.configuration.genderColor).toBe(true);
    expect(result.configuration.inlineScoring).toEqual({
      mode: 'games',
      showFooter: true,
      showSituation: true,
    });
    // Caller's input is preserved
    expect(base.configuration).not.toHaveProperty('inlineScoring');
    // Theme passes through
    expect(result.theme).toBe(base.theme);
  });
});

describe('markReadyMatchUpsInProgress', () => {
  const buildSide = (participantId: string) => ({
    sideNumber: 1,
    participantId,
    participant: { participantId, participantName: participantId },
  });

  it('marks ready, two-participant, not-yet-started matchUps as IN_PROGRESS', () => {
    const matchUp = {
      matchUpId: 'm1',
      readyToScore: true,
      matchUpStatus: 'TO_BE_PLAYED',
      sides: [buildSide('a'), { ...buildSide('b'), sideNumber: 2 }],
    };
    markReadyMatchUpsInProgress([matchUp]);
    expect(matchUp.matchUpStatus).toBe('IN_PROGRESS');
  });

  it('does not mark matchUps with a winningSide', () => {
    const matchUp = {
      matchUpId: 'm2',
      readyToScore: true,
      matchUpStatus: 'TO_BE_PLAYED',
      winningSide: 1,
      sides: [buildSide('a'), { ...buildSide('b'), sideNumber: 2 }],
    };
    markReadyMatchUpsInProgress([matchUp]);
    expect(matchUp.matchUpStatus).toBe('TO_BE_PLAYED');
  });

  it('does not mark matchUps missing a participant', () => {
    const matchUp = {
      matchUpId: 'm3',
      readyToScore: true,
      matchUpStatus: 'TO_BE_PLAYED',
      sides: [buildSide('a'), { sideNumber: 2 }],
    };
    markReadyMatchUpsInProgress([matchUp]);
    expect(matchUp.matchUpStatus).toBe('TO_BE_PLAYED');
  });

  it('preserves IN_PROGRESS status when already in progress', () => {
    const matchUp = {
      matchUpId: 'm4',
      readyToScore: true,
      matchUpStatus: 'IN_PROGRESS',
      sides: [buildSide('a'), { ...buildSide('b'), sideNumber: 2 }],
    };
    markReadyMatchUpsInProgress([matchUp]);
    expect(matchUp.matchUpStatus).toBe('IN_PROGRESS');
  });

  it('handles undefined matchUpStatus by promoting to IN_PROGRESS', () => {
    const matchUp = {
      matchUpId: 'm5',
      readyToScore: true,
      sides: [buildSide('a'), { ...buildSide('b'), sideNumber: 2 }],
    } as any;
    markReadyMatchUpsInProgress([matchUp]);
    expect(matchUp.matchUpStatus).toBe('IN_PROGRESS');
  });
});

describe('IRREGULAR_STATUSES', () => {
  it('covers the same statuses as TMX', () => {
    expect(__test__.IRREGULAR_STATUSES.has('RETIRED')).toBe(true);
    expect(__test__.IRREGULAR_STATUSES.has('DEFAULTED')).toBe(true);
    expect(__test__.IRREGULAR_STATUSES.has('WALKOVER')).toBe(true);
    expect(__test__.IRREGULAR_STATUSES.has('SUSPENDED')).toBe(true);
    expect(__test__.IRREGULAR_STATUSES.has('CANCELLED')).toBe(true);
    expect(__test__.IRREGULAR_STATUSES.has('ABANDONED')).toBe(true);
    expect(__test__.IRREGULAR_STATUSES.has('IN_PROGRESS')).toBe(false);
    expect(__test__.IRREGULAR_STATUSES.has('COMPLETED')).toBe(false);
  });
});
