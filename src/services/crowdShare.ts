/**
 * Crowd-score sharing shared by every courthive-public scoring surface.
 *
 * Both the `/track/:tournamentId/:matchUpId` page and the bracket's inline
 * Track toggle relay a signed-in visitor's locally-entered score to
 * score-relay's `/crowd` namespace, where TMX's crowd poller picks it up.
 * This module owns the parts they share: which sign-in a visitor shares as,
 * where the relay lives, the stable client id, and how a factory matchUp is
 * described to the relay.
 *
 * Sharing requires a sign-in (TMX or HiveID). The relay is JWT-gated and
 * attributes every session to a scorer; a signed-out visitor keeps scoring
 * locally and nothing is sent.
 *
 * `createCrowdShareHub` is the bracket's entry point: one relay connection per
 * rendered event, one session per matchUp, opened lazily on the first scored
 * change and resumable across page reloads.
 */

import type { CrowdRelayController, CrowdScoreSnapshot, SubmitParams } from 'src/services/crowdRelay';
import { getDisplayName, readHiveIDSession } from 'src/services/hiveidSession';
import { connectCrowdRelay, inferPointWinner } from 'src/services/crowdRelay';
import { getJwtTokenStorageKey } from 'src/config/localStorage';

const CROWD_RELAY_LOCAL_DEFAULT = 'http://localhost:8384';
const RELAY_SOCKET_PATH_DEFAULT = '/socket.io/';
const RELAY_SOCKET_PATH_PROXIED = '/relay/socket.io/';
const CLIENT_ID_KEY = 'courthive-public:clientId';
const SESSION_ID_KEY_PREFIX = 'courthive-public:crowdSession:';

/**
 * Relay rejections after which a session can never accept another point. The
 * hub forgets the session so the next scored change opens a fresh one.
 */
const TERMINAL_REJECTIONS = new Set([
  'not-owner',
  'session-not-found',
  'session-cancelled-by-user',
  'session-cancelled-by-inactivity',
  'session-cancelled-by-td-finalize',
]);

export type CrowdScorer = NonNullable<SubmitParams['scorer']>;

export interface ResolvedScorerToken {
  token: string;
  audience: 'admin' | 'hiveid';
  scorer?: CrowdScorer;
}

/**
 * Resolves a token for the /crowd relay handshake plus an optional
 * scorer attribution block:
 *
 *   - admin tmxToken wins when present (back-compat: existing TMX users
 *     on the public app keep their share path)
 *   - falls back to a HiveID session — Phase 5 of the integration —
 *     and stamps `personId` + display name so the relay can attribute
 *     each point to a real human and later run quorum / reconciliation
 *
 *   - returns `undefined` when neither path has a token: the visitor is
 *     signed out and scoring stays local-only.
 */
export function resolveShareToken(): ResolvedScorerToken | undefined {
  try {
    const key = getJwtTokenStorageKey();
    const value = globalThis.localStorage?.getItem(key);
    if (typeof value === 'string' && value.length > 0) {
      return { token: value, audience: 'admin' };
    }
  } catch (err) {
    console.warn('[crowdShare] reading tmxToken failed', err);
  }
  const hiveid = readHiveIDSession();
  if (hiveid?.token) {
    return {
      token: hiveid.token,
      audience: 'hiveid',
      scorer: {
        personId: hiveid.personId,
        displayName: getDisplayName(hiveid) || hiveid.personId || 'HiveID user',
        audience: 'hiveid',
      },
    };
  }
  return undefined;
}

function isLocalHost(): boolean {
  return globalThis.location.host.includes('localhost') || globalThis.location.hostname === '127.0.0.1';
}

export function resolveCrowdRelayBaseUrl(): string {
  const fromEnv = import.meta.env?.VITE_SCORE_RELAY_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');
  if (isLocalHost()) return CROWD_RELAY_LOCAL_DEFAULT;
  // Production fallback — same origin as the rest of courthive.net infrastructure.
  return 'https://courthive.net';
}

/**
 * Resolve the Socket.IO transport path for the `/crowd` connection, branch-for-
 * branch with `resolveCrowdRelayBaseUrl`. In production the relay is exposed by
 * nginx ONLY under `/relay/`, so the transport path must carry that prefix; a
 * default-path handshake to `https://courthive.net` lands on CFS and fails with
 * "Invalid namespace" (no `/crowd` namespace there). An explicit
 * `VITE_SCORE_RELAY_URL` points straight at a relay origin serving the default
 * path, and localhost dev runs the relay standalone on :8384.
 */
export function resolveCrowdRelaySocketPath(): string {
  const fromEnv = import.meta.env?.VITE_SCORE_RELAY_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return RELAY_SOCKET_PATH_DEFAULT;
  if (isLocalHost()) return RELAY_SOCKET_PATH_DEFAULT;
  return RELAY_SOCKET_PATH_PROXIED;
}

export function generateId(prefix: string): string {
  const cryptoObj: any = (globalThis as any).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `${prefix}-${cryptoObj.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resolveClientId(): string {
  try {
    const existing = globalThis.localStorage?.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const fresh = generateId('client');
    globalThis.localStorage?.setItem(CLIENT_ID_KEY, fresh);
    return fresh;
  } catch {
    return generateId('client');
  }
}

export function toCrowdScoreSnapshot(matchUp: any): CrowdScoreSnapshot {
  const rawSets: any[] = Array.isArray(matchUp?.score?.sets) ? matchUp.score.sets : [];
  const sets = rawSets.length
    ? rawSets.map((s: any) => ({
        setNumber: s.setNumber,
        side1Score: s.side1Score ?? 0,
        side2Score: s.side2Score ?? 0,
        side1TiebreakScore: s.side1TiebreakScore,
        side2TiebreakScore: s.side2TiebreakScore,
        winningSide: s.winningSide,
      }))
    : undefined;
  // pointDisplay comes from the *raw* last set — the inline-scoring shell
  // injects side*PointScore onto the active set (see engineToMatchUp.ts in
  // courthive-components).
  const rawLastSet: any = rawSets[rawSets.length - 1];
  const pointDisplay: [string, string] | undefined =
    rawLastSet && rawLastSet.side1PointScore !== undefined && rawLastSet.side2PointScore !== undefined
      ? [String(rawLastSet.side1PointScore), String(rawLastSet.side2PointScore)]
      : undefined;
  return {
    sets,
    pointDisplay,
    winningSide: matchUp?.winningSide,
    scoreboard: matchUp?.score?.scoreStringSide1,
  };
}

/** Open a `/crowd` connection with the resolved relay location. */
export function connectCrowdShare(token: string): CrowdRelayController {
  return connectCrowdRelay({
    token,
    baseUrl: resolveCrowdRelayBaseUrl(),
    socketPath: resolveCrowdRelaySocketPath(),
  });
}

/**
 * Label and tooltip for the bracket's Track toggle. The tooltip used to promise
 * "Nothing is sent to the tournament", which stops being true once a signed-in
 * visitor's scores are relayed, so the copy follows the sign-in state.
 */
export function trackToggleCopy({ active, sharingAs }: { active: boolean; sharingAs?: ResolvedScorerToken }): {
  label: string;
  hint: string;
} {
  if (!sharingAs) {
    return {
      label: 'Track',
      hint: 'Score this draw on your device. Sign in with HiveID or TMX to share your scores with the tournament director.',
    };
  }
  const who = sharingAs.scorer?.displayName ? ` as ${sharingAs.scorer.displayName}` : '';
  return {
    label: active ? 'Track · Sharing' : 'Track',
    hint: `Scores you enter are shared with the tournament director${who} as an unofficial feed.`,
  };
}

export interface RelayScoreParams {
  matchUpId: string;
  matchUpFormat?: string;
  /** The engine's current matchUp, as handed to the inline scoring callbacks. */
  matchUp: any;
}

export interface CrowdShareHub {
  /**
   * Relay the matchUp's current score. Sends only when the visitor is signed in
   * and the score moved since the last relay for that matchUp. Never throws.
   */
  relayScore(params: RelayScoreParams): void;
  /** Who the visitor would share as, or `undefined` when signed out. */
  sharingAs(): ResolvedScorerToken | undefined;
  /** Close the relay connection. Sessions stay active and resume on the next relay. */
  disconnect(): void;
}

export interface CreateCrowdShareHubParams {
  tournamentId: string;
  /** Injected for tests; defaults to `connectCrowdShare`. */
  connect?: (token: string) => CrowdRelayController;
}

let activeHub: CrowdShareHub | undefined;

/**
 * One hub per rendered event. Creating a new hub disconnects the previous one,
 * so a re-render or a switch to another event never leaves a socket behind.
 */
export function createCrowdShareHub({
  tournamentId,
  connect = connectCrowdShare,
}: CreateCrowdShareHubParams): CrowdShareHub {
  activeHub?.disconnect();

  let controller: CrowdRelayController | undefined;
  let connectedToken: string | undefined;
  const lastScoreByMatchUp = new Map<string, CrowdScoreSnapshot>();

  const ensureController = (token: string): CrowdRelayController => {
    // A sign-in change (TMX ↔ HiveID, or a refreshed token) needs a new handshake.
    if (controller && connectedToken === token) return controller;
    controller?.disconnect();
    controller = connect(token);
    connectedToken = token;
    controller.on('rejected', (payload: any) => {
      const reason = payload?.reason;
      console.warn(`[crowdShare] relay rejected ${payload?.sessionId ?? ''}: ${reason}`);
      if (TERMINAL_REJECTIONS.has(reason) && payload?.sessionId) forgetSessionId(payload.sessionId);
    });
    return controller;
  };

  const hub: CrowdShareHub = {
    relayScore({ matchUpId, matchUpFormat, matchUp }) {
      try {
        const resolved = resolveShareToken();
        if (!resolved || !matchUpId) return;
        const currentScore = toCrowdScoreSnapshot(matchUp);
        const winner = inferPointWinner(lastScoreByMatchUp.get(matchUpId), currentScore);
        lastScoreByMatchUp.set(matchUpId, currentScore);
        if (!winner) return; // no detectable delta — undo / no-op state change
        ensureController(resolved.token).submit({
          sessionId: sessionIdFor(tournamentId, matchUpId),
          matchUpId,
          tournamentId,
          clientId: resolveClientId(),
          point: { winner, recordedAt: new Date().toISOString() },
          currentScore,
          formatHint: matchUpFormat ?? matchUp?.matchUpFormat,
          scorer: resolved.scorer,
        });
      } catch (err) {
        console.warn('[crowdShare] relayScore failed', err);
      }
    },
    sharingAs: () => resolveShareToken(),
    disconnect() {
      controller?.disconnect();
      controller = undefined;
      connectedToken = undefined;
      // The next relay after a reconnect re-baselines: a change made while
      // disconnected must not be diffed against a stale score.
      lastScoreByMatchUp.clear();
      if (activeHub === hub) activeHub = undefined;
    },
  };

  activeHub = hub;
  return hub;
}

/**
 * The relay session a visitor's scoring of one matchUp accumulates into.
 * Persisted so a reload resumes the same session (the relay accepts a submit
 * without `expectedVersion` against an existing session it owns) instead of
 * opening a second session the TD would see as another scorer.
 */
function sessionIdFor(tournamentId: string, matchUpId: string): string {
  const key = `${SESSION_ID_KEY_PREFIX}${tournamentId}:${matchUpId}`;
  try {
    const existing = globalThis.localStorage?.getItem(key);
    if (existing) return existing;
    const fresh = generateId('crowd-session');
    globalThis.localStorage?.setItem(key, fresh);
    return fresh;
  } catch {
    return generateId('crowd-session');
  }
}

function forgetSessionId(sessionId: string): void {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (key?.startsWith(SESSION_ID_KEY_PREFIX) && storage.getItem(key) === sessionId) storage.removeItem(key);
    }
  } catch {
    /* storage unavailable — the session id was never persisted */
  }
}

/**
 * Test seam — exposed for vitest only.
 */
export const __test__ = {
  CROWD_RELAY_LOCAL_DEFAULT,
  RELAY_SOCKET_PATH_DEFAULT,
  RELAY_SOCKET_PATH_PROXIED,
  SESSION_ID_KEY_PREFIX,
  TERMINAL_REJECTIONS,
};
