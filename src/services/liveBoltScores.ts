/**
 * In-memory store for live `liveScore` payloads received via the
 * `/public` Socket.IO namespace from competition-factory-server.
 *
 * One entry per matchUpId, always the latest received. The store is
 * intentionally simple — no history, no sorting, no cross-tournament
 * partitioning. Higher-level views can subscribe via the
 * `liveBoltScoreUpdated` DOM CustomEvent fired on `window` whenever
 * a new payload arrives.
 *
 * Listeners can use either:
 *   - Direct read: `getLiveScore(matchUpId)` for the latest snapshot
 *   - Event-driven: `window.addEventListener('liveBoltScoreUpdated', handler)`
 *
 * The store and the event are both populated by `applyLiveScorePayload`
 * which is called from `liveUpdates.ts` when the socket receives the
 * `liveScore` event. Phase 1 leaves the visual rendering to a future
 * deliverable; this scaffolding lets that work hang off a stable seam.
 */

import type { PublicLivePayload } from './publicLiveTypes';

const scores = new Map<string, PublicLivePayload>();

export const LIVE_BOLT_SCORE_EVENT = 'liveBoltScoreUpdated';

export interface LiveBoltScoreEventDetail {
  matchUpId: string;
  payload: PublicLivePayload;
}

export function applyLiveScorePayload(payload: PublicLivePayload): void {
  if (!payload?.matchUpId) return;
  scores.set(payload.matchUpId, payload);
  if (typeof globalThis.window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    const detail: LiveBoltScoreEventDetail = { matchUpId: payload.matchUpId, payload };
    globalThis.window.dispatchEvent(new CustomEvent(LIVE_BOLT_SCORE_EVENT, { detail }));
  }
}

export function getLiveScore(matchUpId: string): PublicLivePayload | undefined {
  return scores.get(matchUpId);
}

export function getAllLiveScores(): PublicLivePayload[] {
  return Array.from(scores.values());
}

export function getLiveScoresForTournament(tournamentId: string): PublicLivePayload[] {
  return Array.from(scores.values()).filter((p) => p.tournamentId === tournamentId);
}

export function clearLiveScores(): void {
  scores.clear();
}

// Test helper — clears the in-memory store between tests.
export function __resetLiveBoltScoresForTests(): void {
  scores.clear();
}
