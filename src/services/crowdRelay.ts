/**
 * /crowd Socket.IO client — Phase 3 slice 7.
 *
 * Companion to `inlineCrowdScoring.ts` / `renderTrackPage.ts`. Maintains a
 * second Socket.IO connection (alongside the existing `/public` namespace on
 * competition-factory-server) that talks to score-relay's `/crowd` namespace,
 * built in Phase 3 slice 2 (epixodic `e711361`).
 *
 * Protocol (mirrors `score-relay/src/crowd/crowdNamespace.ts`):
 *
 *   handshake auth: { token: localStorage['tmxToken'] }
 *
 *   client → 'submitCrowdScore' {
 *     sessionId, matchUpId, tournamentId, clientId,
 *     point: { winner: 1|2, server?, result?, recordedAt },
 *     currentScore: { sets?, pointDisplay?, winningSide?, scoreboard? },
 *     expectedVersion?, formatHint?
 *   }
 *   server → 'acked' { sessionId, version }
 *   server → 'rejected' { sessionId, reason, retryAfter? }
 *
 *   client → 'endSession' { sessionId }
 *   server → 'sessionEnded' { sessionId }
 *
 * Tracks `version` returned from each `acked` per-session and passes it back
 * as `expectedVersion` on the next submit. The first event for a session
 * omits `expectedVersion` (server auto-creates the session at version 0).
 *
 * Never throws out of `submit`/`end` — errors surface as `error` events on
 * the controller and via `lastError`.
 *
 * No login UI in this slice — if there is no JWT in `localStorage['tmxToken']`,
 * the caller (renderTrackPage) keeps the "Sign in to share" toggle OFF.
 */

import { io, Socket } from 'socket.io-client';

/** Shape of the per-point payload the relay accepts. */
export interface CrowdPoint {
  winner: 1 | 2;
  server?: 1 | 2;
  result?: string;
  recordedAt: string;
}

/** Shape of the running engine score the relay accepts. */
export interface CrowdScoreSnapshot {
  sets?: Array<{
    setNumber: number;
    side1Score: number;
    side2Score: number;
    side1TiebreakScore?: number;
    side2TiebreakScore?: number;
    winningSide?: 1 | 2;
  }>;
  pointDisplay?: [string, string];
  winningSide?: 1 | 2;
  scoreboard?: string;
}

export interface SubmitParams {
  sessionId: string;
  matchUpId: string;
  tournamentId: string;
  clientId: string;
  point: CrowdPoint;
  currentScore: CrowdScoreSnapshot;
  formatHint?: string;
}

export interface AckedEvent {
  sessionId: string;
  version: number;
}

export interface RejectedEvent {
  sessionId?: string;
  reason: string;
  retryAfter?: number;
  actualVersion?: number;
}

export interface SessionEndedEvent {
  sessionId: string;
}

export type CrowdRelayEvent = 'acked' | 'rejected' | 'sessionEnded' | 'connect' | 'disconnect' | 'error';

type Listener = (payload: any) => void;

export interface CrowdRelayController {
  /** Submit a single crowd-scored point for a session. Never throws. */
  submit(params: SubmitParams): void;
  /** End an active session — best-effort, never throws. */
  end(sessionId: string): void;
  /** Subscribe to relay events; returns an unsubscribe function. */
  on(event: CrowdRelayEvent, listener: Listener): () => void;
  /** Disconnect the underlying socket and clear all listeners. */
  disconnect(): void;
  /** Whether the underlying socket is currently connected. */
  isConnected(): boolean;
  /** The most recent error observed by the controller, if any. */
  lastError?: Error;
}

export interface ConnectCrowdRelayOptions {
  /** JWT, typically `localStorage['tmxToken']`. */
  token: string;
  /** Base URL for the score-relay server (no trailing slash, no namespace). */
  baseUrl: string;
}

const NAMESPACE_PATH = '/crowd';

/**
 * Open a Socket.IO connection to `${baseUrl}/crowd` and return a controller
 * that exposes `submit`, `end`, `disconnect`, and an event emitter.
 *
 * `socket.io-client` handles reconnection by default — we lean on its
 * exponential backoff rather than hand-rolling one. The version map is
 * preserved across reconnects so resume picks up where it left off.
 */
export function connectCrowdRelay(options: ConnectCrowdRelayOptions): CrowdRelayController {
  const { token, baseUrl } = options;
  const listeners = new Map<CrowdRelayEvent, Set<Listener>>();
  const versionBySession = new Map<string, number>();
  const controller: CrowdRelayController = createControllerSkeleton();

  const socket = io(`${baseUrl}${NAMESPACE_PATH}`, {
    auth: { token },
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
  });

  bindSocketLifecycle(socket, controller, listeners);
  bindSocketProtocol(socket, controller, listeners, versionBySession);

  controller.submit = (params) => safeSubmit(socket, params, versionBySession, controller, listeners);
  controller.end = (sessionId) => safeEnd(socket, sessionId, controller, listeners);
  controller.on = (event, listener) => addListener(listeners, event, listener);
  controller.disconnect = () => {
    listeners.clear();
    versionBySession.clear();
    socket.removeAllListeners();
    socket.disconnect();
  };
  controller.isConnected = () => socket.connected;

  return controller;
}

/**
 * Pure helper: derive `point.winner` (1 or 2) by comparing the previous score
 * snapshot to the current one. Returns `undefined` when no delta is detectable
 * (the caller should skip emitting in that case).
 *
 * The shell's `stateChanged` event doesn't include a "who scored this point"
 * signal, so we diff sets to figure it out:
 *   - if either side's current-set games count went up, that side won the
 *     point that closed the game;
 *   - else if a set just got a `winningSide`, that side won;
 *   - else if `winningSide` (match) just appeared, that side won;
 *   - else if `pointDisplay` differs, infer from which side's display tick
 *     went up (typical 0 → 15 → 30 → 40).
 *
 * Returns `undefined` if no progress is detectable.
 */
export function inferPointWinner(
  prev: CrowdScoreSnapshot | undefined,
  next: CrowdScoreSnapshot,
): 1 | 2 | undefined {
  const fromSetDelta = inferFromSetGames(prev, next);
  if (fromSetDelta) return fromSetDelta;

  const fromSetWinner = inferFromSetWinner(prev, next);
  if (fromSetWinner) return fromSetWinner;

  if (next.winningSide && prev?.winningSide !== next.winningSide) {
    return next.winningSide;
  }

  return inferFromPointDisplay(prev, next);
}

function inferFromSetGames(
  prev: CrowdScoreSnapshot | undefined,
  next: CrowdScoreSnapshot,
): 1 | 2 | undefined {
  const nextSets = next.sets ?? [];
  const prevSets = prev?.sets ?? [];
  for (let i = 0; i < nextSets.length; i += 1) {
    const cur: any = nextSets[i];
    const before: any = prevSets[i] ?? {};
    if ((cur.side1Score ?? 0) > (before.side1Score ?? 0)) return 1;
    if ((cur.side2Score ?? 0) > (before.side2Score ?? 0)) return 2;
    if ((cur.side1TiebreakScore ?? 0) > (before.side1TiebreakScore ?? 0)) return 1;
    if ((cur.side2TiebreakScore ?? 0) > (before.side2TiebreakScore ?? 0)) return 2;
  }
  return undefined;
}

function inferFromSetWinner(
  prev: CrowdScoreSnapshot | undefined,
  next: CrowdScoreSnapshot,
): 1 | 2 | undefined {
  const nextSets = next.sets ?? [];
  const prevSets = prev?.sets ?? [];
  for (let i = 0; i < nextSets.length; i += 1) {
    const cur = nextSets[i];
    const before = prevSets[i];
    if (cur.winningSide && (!before || before.winningSide !== cur.winningSide)) {
      return cur.winningSide;
    }
  }
  return undefined;
}

function inferFromPointDisplay(
  prev: CrowdScoreSnapshot | undefined,
  next: CrowdScoreSnapshot,
): 1 | 2 | undefined {
  const cur = next.pointDisplay;
  const before = prev?.pointDisplay;
  if (!cur || !before) return undefined;
  if (cur[0] !== before[0] && cur[1] === before[1]) return 1;
  if (cur[1] !== before[1] && cur[0] === before[0]) return 2;
  return undefined;
}

function createControllerSkeleton(): CrowdRelayController {
  return {
    submit: () => undefined,
    end: () => undefined,
    on: () => () => undefined,
    disconnect: () => undefined,
    isConnected: () => false,
  };
}

function bindSocketLifecycle(
  socket: Socket,
  controller: CrowdRelayController,
  listeners: Map<CrowdRelayEvent, Set<Listener>>,
): void {
  socket.on('connect', () => emit(listeners, 'connect', { id: socket.id }));
  socket.on('disconnect', (reason: string) => emit(listeners, 'disconnect', { reason }));
  socket.on('connect_error', (err: Error) => {
    controller.lastError = err;
    emit(listeners, 'error', { error: err, kind: 'connect_error' });
  });
}

function bindSocketProtocol(
  socket: Socket,
  controller: CrowdRelayController,
  listeners: Map<CrowdRelayEvent, Set<Listener>>,
  versionBySession: Map<string, number>,
): void {
  socket.on('acked', (payload: AckedEvent) => {
    if (payload?.sessionId && typeof payload.version === 'number') {
      versionBySession.set(payload.sessionId, payload.version);
    }
    emit(listeners, 'acked', payload);
  });

  socket.on('rejected', (payload: RejectedEvent) => {
    if (payload?.reason === 'version-conflict' && payload.sessionId) {
      // Drop our cached version so a subsequent submit on this session
      // omits expectedVersion — the user-facing remediation is to toggle
      // sharing OFF then back ON, which creates a new sessionId.
      versionBySession.delete(payload.sessionId);
    }
    controller.lastError = new Error(`crowd-relay rejected: ${payload?.reason ?? 'unknown'}`);
    emit(listeners, 'rejected', payload);
  });

  socket.on('sessionEnded', (payload: SessionEndedEvent) => {
    if (payload?.sessionId) versionBySession.delete(payload.sessionId);
    emit(listeners, 'sessionEnded', payload);
  });
}

function safeSubmit(
  socket: Socket,
  params: SubmitParams,
  versionBySession: Map<string, number>,
  controller: CrowdRelayController,
  listeners: Map<CrowdRelayEvent, Set<Listener>>,
): void {
  try {
    const expectedVersion = versionBySession.get(params.sessionId);
    const payload: any = {
      sessionId: params.sessionId,
      matchUpId: params.matchUpId,
      tournamentId: params.tournamentId,
      clientId: params.clientId,
      point: params.point,
      currentScore: params.currentScore,
    };
    if (params.formatHint) payload.formatHint = params.formatHint;
    if (typeof expectedVersion === 'number') payload.expectedVersion = expectedVersion;
    socket.emit('submitCrowdScore', payload);
  } catch (err: any) {
    controller.lastError = err instanceof Error ? err : new Error(String(err));
    emit(listeners, 'error', { error: controller.lastError, kind: 'submit-throw' });
  }
}

function safeEnd(
  socket: Socket,
  sessionId: string,
  controller: CrowdRelayController,
  listeners: Map<CrowdRelayEvent, Set<Listener>>,
): void {
  try {
    socket.emit('endSession', { sessionId });
  } catch (err: any) {
    controller.lastError = err instanceof Error ? err : new Error(String(err));
    emit(listeners, 'error', { error: controller.lastError, kind: 'end-throw' });
  }
}

function addListener(
  listeners: Map<CrowdRelayEvent, Set<Listener>>,
  event: CrowdRelayEvent,
  listener: Listener,
): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set<Listener>();
    listeners.set(event, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

function emit(
  listeners: Map<CrowdRelayEvent, Set<Listener>>,
  event: CrowdRelayEvent,
  payload: any,
): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(payload);
    } catch (err) {
      console.warn('[crowdRelay] listener threw', err);
    }
  }
}

/**
 * Test seam — exposed for vitest only.
 */
export const __test__ = {
  inferPointWinner,
  NAMESPACE_PATH,
};
