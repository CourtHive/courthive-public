/**
 * Live scores from the score-relay's `/live` namespace — what a tracker (epixodic, a provider's own app such as
 * IONSport) streams point by point, and what a crowd session carries once a TD promotes it.
 *
 * Separate from `liveUpdates.ts`, which listens to the factory server's `/public` namespace for OFFICIAL changes.
 * This is the unofficial, in-flight score: kept per matchUp until the official result arrives, shown as a
 * display copy (`liveScoreDisplay.withLiveScore`), never written into the published data.
 *
 * One socket, one tournament at a time: `connectLiveRelay` on tournament open, `disconnectLiveRelay` on leave.
 * Each frame updates the store and fires a `liveRelayScoreUpdated` DOM event on `window`, so a view can re-render
 * without coupling to the socket. Reaching the relay reuses the `/crowd` client's resolution (in production the
 * relay is only exposed under `/relay/`, so the transport path must carry that prefix).
 */
import { sanitizeLiveScore, withLiveScore, type LiveScore } from './liveScoreDisplay';
import { resolveCrowdRelayBaseUrl, resolveCrowdRelaySocketPath } from './crowdShare';
import { io, Socket } from 'socket.io-client';

export const LIVE_RELAY_SCORE_EVENT = 'liveRelayScoreUpdated';

export interface LiveRelayScoreEventDetail {
  matchUpId: string;
}

const scores = new Map<string, LiveScore>();
let socket: Socket | undefined;
let currentTournamentId: string | undefined;

/** Store a `/live` score frame; returns whether it changed what the matchUp shows. */
export function applyLiveRelayFrame(frame: any): boolean {
  const matchUpId = typeof frame?.matchUpId === 'string' ? frame.matchUpId : undefined;
  if (!matchUpId) return false;
  if (frame.tournamentId && currentTournamentId && frame.tournamentId !== currentTournamentId) return false;
  const score = sanitizeLiveScore(frame.score);
  if (!score) return false;
  scores.set(matchUpId, score);
  if (typeof globalThis.window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    const detail: LiveRelayScoreEventDetail = { matchUpId };
    globalThis.window.dispatchEvent(new CustomEvent(LIVE_RELAY_SCORE_EVENT, { detail }));
  }
  return true;
}

export function getLiveRelayScore(matchUpId: string | undefined): LiveScore | undefined {
  return matchUpId ? scores.get(matchUpId) : undefined;
}

/**
 * The matchUps with each one's live relay score overlaid as a display copy — except those in `keepOwn`, whose score
 * the visitor is keeping on this device (their own scoring is what they are watching).
 */
export function withLiveRelayScores<T extends { matchUpId?: string }>(matchUps: T[], keepOwn?: Set<string>): T[] {
  return matchUps.map((matchUp) =>
    keepOwn?.has(matchUp.matchUpId) ? matchUp : withLiveScore(matchUp, getLiveRelayScore(matchUp.matchUpId)),
  );
}

export function connectLiveRelay(tournamentId: string): void {
  if (!tournamentId) return;
  if (currentTournamentId === tournamentId && socket) return;
  disconnectLiveRelay();
  currentTournamentId = tournamentId;

  socket = io(`${resolveCrowdRelayBaseUrl()}/live`, {
    path: resolveCrowdRelaySocketPath(),
    transports: ['websocket'],
    reconnectionDelay: 2000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
  });
  // (Re)subscribe on every connect: the relay replays the tournament's current scores on subscribe, so a
  // reconnect catches up on whatever was scored while the socket was down.
  socket.on('connect', () => socket?.emit('subscribe:tournament', tournamentId));
  socket.on('score', (frame: unknown) => applyLiveRelayFrame(frame));
  // A relay that is down is not an error for a spectator: there is simply no live score to show.
  socket.on('connect_error', () => undefined);
}

export function disconnectLiveRelay(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = undefined;
  currentTournamentId = undefined;
  scores.clear();
}

// Test helper — clears the store and sets the tournament frames are accepted for.
export function __resetLiveRelayScoresForTests(tournamentId?: string): void {
  scores.clear();
  currentTournamentId = tournamentId;
}
