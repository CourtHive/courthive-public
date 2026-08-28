import { beforeEach, describe, expect, it, vi } from 'vitest';

// courthive-components touches `document` at module-import time when its CSS
// side-effects load. courthive-public's vitest config has no DOM environment,
// so we mock the package down to just the symbols inlineCrowdScoring imports.
// Capture the handlers buildInlineCrowdManager passes in, so the persistence path can be driven.
const managerHandlers: any = {};
vi.mock('courthive-components', () => ({
  InlineScoringManager: vi.fn(function (this: any, handlers: any) {
    Object.assign(managerHandlers, handlers);
    this.get = () => undefined;
    return this;
  }),
  renderInlineMatchUp: vi.fn(),
}));

// crowdTracker calls indexedDB at runtime — mock it for these unit tests.
const saveSession = vi.fn();
vi.mock('src/services/crowdTracker', () => ({
  saveSession: (...a: any[]) => saveSession(...a),
  listActiveSessions: vi.fn(async () => []),
}));

import {
  applyInlineScoringWrappers,
  buildInlineCrowdManager,
  markReadyMatchUpsInProgress,
  registerMatchUps,
  withInlineScoringConfig,
  __test__,
} from './inlineCrowdScoring';

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


describe('base-matchUp lookup — the crowd-scoring persistence path', () => {
  const MATCH_UP_ID = 'm-lazy';
  const FORMAT = 'SET5-S:6/TB7-F:TB10';

  /** Non-degenerate on purpose: a format that is NOT the fallback, and names that are not placeholders. */
  const buildMatchUp = () => ({
    matchUpId: MATCH_UP_ID,
    matchUpFormat: FORMAT,
    sides: [
      { sideNumber: 1, participant: { participantName: 'Alfa' } },
      { sideNumber: 2, participant: { participantName: 'Bravo' } },
    ],
  });

  const build = (matchUps: any[]) =>
    buildInlineCrowdManager({ tournamentId: 't1', savedSessions: new Map(), matchUps });

  /** Drives onMatchComplete, which persists and flushes synchronously. */
  const completeMatch = async () => {
    managerHandlers.onMatchComplete({ matchUpId: MATCH_UP_ID });
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    saveSession.mockClear();
    for (const k of Object.keys(managerHandlers)) delete managerHandlers[k];
  });

  it('persists the real format and side names when the matchUp is known', async () => {
    build([buildMatchUp()]);
    await completeMatch();

    expect(saveSession).toHaveBeenCalledTimes(1);
    const saved = saveSession.mock.calls[0][0];
    expect(saved.matchUpFormat).toBe(FORMAT);
    expect(saved.side1Name).toBe('Alfa');
    expect(saved.side2Name).toBe('Bravo');
  });

  it('WARNS on a miss instead of silently persisting placeholders', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    build([]); // manager never saw this matchUp
    await completeMatch();

    // It still persists — losing the operator's score is worse than an imperfect record...
    expect(saveSession).toHaveBeenCalledTimes(1);
    const saved = saveSession.mock.calls[0][0];
    expect(saved.matchUpFormat).toBe(__test__.FALLBACK_MATCHUP_FORMAT);
    expect(saved.side1Name).toBe('Side 1');
    // ...but it must not do so silently. These are plausible values, not blanks, so nothing
    // downstream would ever flag them.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(MATCH_UP_ID);
    warn.mockRestore();
  });

  it('warns ONCE per matchUp — a miss recurs on every point and would bury its own signal', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    build([]);
    await completeMatch();
    await completeMatch();
    await completeMatch();

    expect(saveSession).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('registerMatchUps repairs a miss — the extension point progressive loading needs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const manager = build([]);

    registerMatchUps(manager, [buildMatchUp()]);
    await completeMatch();

    const saved = saveSession.mock.calls[0][0];
    expect(saved.matchUpFormat).toBe(FORMAT);
    expect(saved.side1Name).toBe('Alfa');
    expect(saved.side2Name).toBe('Bravo');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('applyInlineScoringWrappers registers what it renders — the invariant maintains itself', async () => {
    // This is the production wiring. Registering at the point of use means a matchUp the visitor can
    // score is in the lookup by construction, whatever fetched it — so progressive draw loading
    // cannot reintroduce the miss by forgetting to register.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const manager = build([]);

    applyInlineScoringWrappers({
      container: { querySelector: () => null } as any,
      matchUps: [buildMatchUp()],
      composition: {} as any,
      manager,
    });
    await completeMatch();

    expect(saveSession.mock.calls[0][0].matchUpFormat).toBe(FORMAT);
    expect(saveSession.mock.calls[0][0].side1Name).toBe('Alfa');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('registerMatchUps is a no-op on a manager it did not build', () => {
    expect(() => registerMatchUps({} as any, [buildMatchUp()])).not.toThrow();
  });
});
