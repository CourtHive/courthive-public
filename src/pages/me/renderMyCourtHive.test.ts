/**
 * Tests for the personUpdate guard in renderMyCourtHive. The full DOM
 * render path is exercised by Playwright (out of band); here we lock
 * in the gating logic that prevents the re-render storm + listener leak
 * documented in the 2026-05-31 design-flaws punch list.
 */
import { describe, expect, it, vi } from 'vitest';

// courthive-components touches `document` at module-import time; mock
// to keep this test in the node-only vitest env. Same shape as
// services/mobileBracketLayout.test.ts.
vi.mock('courthive-components', () => ({}));

import { __formatMatchOutcome, __shouldProcessMergedEvent } from './renderMyCourtHive';

function makeContainer(isConnected: boolean): HTMLElement {
  return { isConnected } as unknown as HTMLElement;
}

describe('__shouldProcessMergedEvent', () => {
  it('returns true when the container is connected and no refresh is in flight', () => {
    expect(__shouldProcessMergedEvent(makeContainer(true), false)).toBe(true);
  });

  it('returns false when the container has been detached (user navigated away from /me)', () => {
    expect(__shouldProcessMergedEvent(makeContainer(false), false)).toBe(false);
  });

  it('returns false when an identity refresh is already in flight (storm guard)', () => {
    expect(__shouldProcessMergedEvent(makeContainer(true), true)).toBe(false);
  });

  it('returns false when both gates fail — detach takes precedence over in-flight', () => {
    // Independent of the in-flight bit; a detached container always
    // short-circuits so the caller can unsubscribe lazily.
    expect(__shouldProcessMergedEvent(makeContainer(false), true)).toBe(false);
  });
});

describe('the outcome text on a competitor’s match row', () => {
  const row = (extra: Partial<Parameters<typeof __formatMatchOutcome>[0]>) => ({
    tournamentId: 't1',
    tournamentName: 'T',
    startDate: null,
    matchUpId: 'm1',
    eventType: null,
    roundName: null,
    matchUpStatus: 'COMPLETED',
    winningSide: null,
    scoreString: null,
    sideNumber: 1,
    ...extra,
  });

  it('a completed tie (no winner) reads as tied, with its score', () => {
    expect(__formatMatchOutcome(row({ scoreString: '16-16' }))).toBe('Tied 16-16');
  });

  it('control: a decided match reads Won/Lost, an undecided one its status', () => {
    expect(__formatMatchOutcome(row({ winningSide: 1, scoreString: '17-15' }))).toBe('Won 17-15');
    expect(__formatMatchOutcome(row({ winningSide: 2, scoreString: '15-17' }))).toBe('Lost 15-17');
    expect(__formatMatchOutcome(row({ matchUpStatus: 'TO_BE_PLAYED' }))).toBe('To Be Played');
  });
});
