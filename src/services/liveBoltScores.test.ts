import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetLiveBoltScoresForTests,
  applyLiveScorePayload,
  clearLiveScores,
  getAllLiveScores,
  getLiveScore,
  getLiveScoresForTournament,
  LIVE_BOLT_SCORE_EVENT,
  LiveBoltScoreEventDetail,
} from './liveBoltScores';
import type { PublicLivePayload } from './publicLiveTypes';

const buildPayload = (overrides: Partial<PublicLivePayload> = {}): PublicLivePayload => ({
  matchUpId: 'tie-1',
  tournamentId: 'tour-1',
  format: 'INTENNSE',
  status: 'in_progress',
  side1: { teamName: 'A', playerName: 'A', setScores: [5], gameScore: 1, isServing: true },
  side2: { teamName: 'B', playerName: 'B', setScores: [3], gameScore: 0, isServing: false },
  intennseBolt: { number: 1, state: 'play', boltClockMs: 600000, serveClockMs: 25000 },
  generatedAt: '2026-04-10T10:00:00.000Z',
  ...overrides,
});

describe('liveBoltScores', () => {
  beforeEach(() => {
    __resetLiveBoltScoresForTests();
  });

  afterEach(() => {
    __resetLiveBoltScoresForTests();
  });

  describe('applyLiveScorePayload', () => {
    it('stores the payload by matchUpId', () => {
      applyLiveScorePayload(buildPayload({ matchUpId: 'tie-1' }));
      expect(getLiveScore('tie-1')?.matchUpId).toBe('tie-1');
    });

    it('replaces the previous payload for the same matchUpId', () => {
      applyLiveScorePayload(buildPayload({ matchUpId: 'tie-1', side1: { teamName: 'A', playerName: 'A', setScores: [5], isServing: true } }));
      applyLiveScorePayload(buildPayload({ matchUpId: 'tie-1', side1: { teamName: 'A', playerName: 'A', setScores: [5, 6], isServing: true } }));
      expect(getLiveScore('tie-1')?.side1.setScores).toEqual([5, 6]);
    });

    it('skips payloads without matchUpId', () => {
      applyLiveScorePayload({ ...buildPayload(), matchUpId: '' });
      expect(getAllLiveScores()).toHaveLength(0);
    });

    it('dispatches a liveBoltScoreUpdated CustomEvent on window with the payload detail', () => {
      // Stub `window` and `CustomEvent` because vitest runs in the node
      // environment here and jsdom is not available.
      const dispatchSpy = vi.fn();
      const originalWindow = (globalThis as any).window;
      const originalCustomEvent = (globalThis as any).CustomEvent;
      (globalThis as any).window = { dispatchEvent: dispatchSpy };
      class FakeCustomEvent {
        type: string;
        detail: LiveBoltScoreEventDetail;
        constructor(type: string, init: { detail: LiveBoltScoreEventDetail }) {
          this.type = type;
          this.detail = init.detail;
        }
      }
      (globalThis as any).CustomEvent = FakeCustomEvent;

      try {
        applyLiveScorePayload(buildPayload({ matchUpId: 'tie-1' }));
        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        const event = dispatchSpy.mock.calls[0][0] as FakeCustomEvent;
        expect(event.type).toBe(LIVE_BOLT_SCORE_EVENT);
        expect(event.detail.matchUpId).toBe('tie-1');
        expect(event.detail.payload.tournamentId).toBe('tour-1');
      } finally {
        (globalThis as any).window = originalWindow;
        (globalThis as any).CustomEvent = originalCustomEvent;
      }
    });
  });

  describe('getAllLiveScores', () => {
    it('returns all stored payloads', () => {
      applyLiveScorePayload(buildPayload({ matchUpId: 'tie-a' }));
      applyLiveScorePayload(buildPayload({ matchUpId: 'tie-b' }));
      applyLiveScorePayload(buildPayload({ matchUpId: 'tie-c' }));
      expect(getAllLiveScores()).toHaveLength(3);
    });
  });

  describe('getLiveScoresForTournament', () => {
    it('returns only payloads for the given tournament', () => {
      applyLiveScorePayload(buildPayload({ matchUpId: 'tie-a', tournamentId: 'tour-1' }));
      applyLiveScorePayload(buildPayload({ matchUpId: 'tie-b', tournamentId: 'tour-2' }));
      applyLiveScorePayload(buildPayload({ matchUpId: 'tie-c', tournamentId: 'tour-1' }));

      const result = getLiveScoresForTournament('tour-1');
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.matchUpId).sort()).toEqual(['tie-a', 'tie-c']);
    });
  });

  describe('clearLiveScores', () => {
    it('empties the store', () => {
      applyLiveScorePayload(buildPayload({ matchUpId: 'tie-a' }));
      applyLiveScorePayload(buildPayload({ matchUpId: 'tie-b' }));
      clearLiveScores();
      expect(getAllLiveScores()).toHaveLength(0);
    });
  });
});
