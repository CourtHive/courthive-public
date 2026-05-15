/**
 * courthive-public Phase 2 — interactive tracking page.
 *
 * Mounts the `buildInteractiveScoringShell` from courthive-components
 * into the `#track` view. Loads any persisted session from IndexedDB
 * via `crowdTracker`, subscribes to `stateChanged` events, and
 * persists on every change (debounced).
 *
 * Phase 3 slice 7 adds the "Sign in to share" toggle: when ON and a
 * JWT is present in `localStorage['tmxToken']`, every locally-entered
 * point is also relayed to score-relay's `/crowd` namespace via
 * `crowdRelay`. The local IndexedDB path keeps running regardless.
 * When OFF (or no JWT), behaviour is unchanged from Phase 2 — pure
 * local-only.
 */

import { buildInteractiveScoringShell } from 'courthive-components';
import type { InteractiveScoringShell, StateChangedDetail } from 'courthive-components';

import type { CrowdRelayController, CrowdScoreSnapshot } from 'src/services/crowdRelay';
import { connectCrowdRelay, inferPointWinner } from 'src/services/crowdRelay';
import { getTournamentInfo } from 'src/services/api/tournamentsApi';
import { saveSession, loadSession } from 'src/services/crowdTracker';
import { getJwtTokenStorageKey } from 'src/config/localStorage';

const PERSIST_DEBOUNCE_MS = 200;
const CROWD_RELAY_LOCAL_DEFAULT = 'http://localhost:8384';
const ARIA_PRESSED = 'aria-pressed';
const SHARE_LABEL_OFF = 'Sign in to share — OFF';

interface RenderTrackPageParams {
  container: HTMLElement;
  tournamentId: string;
  matchUpId: string;
}

let currentShell: InteractiveScoringShell | undefined;

interface ShareSessionState {
  controller: CrowdRelayController;
  sessionId: string;
  clientId: string;
  matchUpId: string;
  tournamentId: string;
  matchUpFormat: string;
  /** Last score snapshot we relayed — diffed against the next one to infer `point.winner`. */
  lastScore?: CrowdScoreSnapshot;
  /** True once a `version-conflict` rejection has surfaced for this session. */
  outOfSync: boolean;
}

let activeShare: ShareSessionState | undefined;

export async function renderTrackPage(params: RenderTrackPageParams): Promise<void> {
  const { container, tournamentId, matchUpId } = params;

  // Clean up any previous shell before mounting a new one
  destroyCurrentShell();

  container.innerHTML = '';

  // Tear down any previous share session before mounting a fresh shell
  teardownActiveShare();

  // Page chrome — share state is patched in after we know matchUpFormat
  const chrome = buildPageChrome(tournamentId, matchUpId);
  container.append(chrome.root);

  // Resolve the matchUp metadata (names, format) from either the
  // persisted session or the tournament info API
  const persisted = await loadSession(tournamentId, matchUpId);

  let matchUpFormat = persisted?.matchUpFormat ?? 'SET3-S:6/TB7';
  let side1Name = persisted?.side1Name ?? 'Side 1';
  let side2Name = persisted?.side2Name ?? 'Side 2';
  // persisted.matchUp is intentionally typed as `unknown` in crowdTracker
  // (opaque blob). The shell re-hydrates from whatever shape was
  // originally serialized, so we cast here at the boundary.
  const initialMatchUp = persisted?.matchUp as any;

  if (!persisted) {
    // Fresh session — look up the matchUp metadata from the server's
    // published tournament info
    try {
      const fromServer = await resolveMatchUpFromServer(tournamentId, matchUpId);
      if (fromServer) {
        matchUpFormat = fromServer.matchUpFormat ?? matchUpFormat;
        side1Name = fromServer.side1Name ?? side1Name;
        side2Name = fromServer.side2Name ?? side2Name;
      }
    } catch (err) {
      console.warn('[track] failed to resolve matchUp metadata', err);
    }
  }

  const shell = buildInteractiveScoringShell({
    matchUpId,
    matchUpFormat,
    tournamentId,
    side1Name,
    side2Name,
    initialMatchUp,
  });

  currentShell = shell;

  // Debounced persistence on every state change
  let persistTimeout: ReturnType<typeof setTimeout> | null = null;
  const persistNow = (detail: StateChangedDetail): void => {
    const cfg = {
      tournamentId,
      matchUpId,
      matchUpFormat,
      side1Name,
      side2Name,
      matchUp: detail.matchUp,
    };
    void saveSession(cfg).catch((err) => {
      console.warn('[track] saveSession failed', err);
    });
  };

  const onStateChanged = (event: CustomEvent<StateChangedDetail>): void => {
    if (persistTimeout) clearTimeout(persistTimeout);
    persistTimeout = setTimeout(() => {
      persistNow(event.detail);
      persistTimeout = null;
    }, PERSIST_DEBOUNCE_MS);
    // Relay the point (fire-and-forget) if a share session is active.
    relayPointIfSharing(event.detail);
  };
  shell.addEventListener('stateChanged', onStateChanged);

  // Wire the share toggle now that we know format + ids
  wireShareToggle({
    chrome,
    tournamentId,
    matchUpId,
    matchUpFormat,
  });

  // Mount the shell element into the page
  const shellContainer = document.createElement('div');
  shellContainer.className = 'track-page-shell-container';
  shellContainer.append(shell.element);
  container.append(shellContainer);
}

export function destroyCurrentShell(): void {
  if (currentShell) {
    currentShell.destroy();
    currentShell = undefined;
  }
  teardownActiveShare();
}

interface TrackPageChrome {
  root: HTMLElement;
  shareToggle: HTMLButtonElement;
  shareStatus: HTMLElement;
}

function buildPageChrome(tournamentId: string, matchUpId: string): TrackPageChrome {
  const chrome = document.createElement('div');
  chrome.className = 'track-page-chrome';

  // Local-only practice banner
  const banner = document.createElement('div');
  banner.className = 'track-page-banner';
  banner.setAttribute('role', 'note');
  const bannerIcon = document.createElement('span');
  bannerIcon.className = 'track-page-banner-icon';
  bannerIcon.textContent = '\u{1F4F1}';
  const bannerText = document.createElement('span');
  bannerText.className = 'track-page-banner-text';
  bannerText.textContent =
    'Local-only practice scoring — nothing is sent to the tournament or saved on any server.';
  banner.append(bannerIcon, bannerText);

  // Sign-in-to-share toggle + status helper line
  const shareRow = document.createElement('div');
  shareRow.className = 'track-page-share-row';
  const shareToggle = document.createElement('button');
  shareToggle.type = 'button';
  shareToggle.className = 'track-page-share-toggle';
  shareToggle.setAttribute(ARIA_PRESSED, 'false');
  shareToggle.textContent = SHARE_LABEL_OFF;
  shareToggle.title =
    'When ON, each locally-entered point is also shared with the tournament director ' +
    'as an unofficial feed. Requires you to be signed in via TMX on this device.';
  const shareStatus = document.createElement('span');
  shareStatus.className = 'track-page-share-status';
  shareStatus.setAttribute('role', 'status');
  shareRow.append(shareToggle, shareStatus);

  // Back link to the tournament
  const back = document.createElement('a');
  back.className = 'track-page-back';
  back.href = `#/tournament/${encodeURIComponent(tournamentId)}`;
  back.textContent = '\u2190 Back to tournament';
  back.addEventListener('click', (e) => {
    e.preventDefault();
    const router = (globalThis as any).appRouter;
    if (router && typeof router.navigate === 'function') {
      router.navigate(`/tournament/${encodeURIComponent(tournamentId)}`);
    } else {
      globalThis.location.hash = `#/tournament/${encodeURIComponent(tournamentId)}`;
    }
  });

  // MatchUp context label
  const context = document.createElement('div');
  context.className = 'track-page-context';
  context.textContent = `MatchUp ${matchUpId}`;

  chrome.append(back, banner, shareRow, context);
  return { root: chrome, shareToggle, shareStatus };
}

interface WireShareToggleParams {
  chrome: TrackPageChrome;
  tournamentId: string;
  matchUpId: string;
  matchUpFormat: string;
}

function wireShareToggle({ chrome, tournamentId, matchUpId, matchUpFormat }: WireShareToggleParams): void {
  const { shareToggle, shareStatus } = chrome;
  shareToggle.disabled = false;
  shareToggle.addEventListener('click', () => {
    const isCurrentlyOn = shareToggle.getAttribute(ARIA_PRESSED) === 'true';
    if (isCurrentlyOn) {
      // Toggle OFF — end the active share session, keep local-only running
      teardownActiveShare();
      shareToggle.setAttribute(ARIA_PRESSED, 'false');
      shareToggle.textContent = SHARE_LABEL_OFF;
      shareStatus.textContent = '';
      return;
    }
    // Toggle ON — read JWT, connect relay
    const token = readJwtToken();
    if (!token) {
      shareToggle.setAttribute(ARIA_PRESSED, 'false');
      shareToggle.textContent = SHARE_LABEL_OFF;
      shareStatus.textContent = 'Sign in via TMX first';
      return;
    }
    const baseUrl = resolveCrowdRelayBaseUrl();
    const session = startShareSession({ token, baseUrl, tournamentId, matchUpId, matchUpFormat, shareStatus });
    activeShare = session;
    shareToggle.setAttribute(ARIA_PRESSED, 'true');
    shareToggle.textContent = 'Sign in to share — ON';
    shareStatus.textContent = 'Sharing with tournament director';
  });
}

interface StartShareSessionParams {
  token: string;
  baseUrl: string;
  tournamentId: string;
  matchUpId: string;
  matchUpFormat: string;
  shareStatus: HTMLElement;
}

function startShareSession(params: StartShareSessionParams): ShareSessionState {
  const { token, baseUrl, tournamentId, matchUpId, matchUpFormat, shareStatus } = params;
  const controller = connectCrowdRelay({ token, baseUrl });
  const sessionId = generateId('crowd-session');
  const clientId = resolveClientId();
  const state: ShareSessionState = {
    controller,
    sessionId,
    clientId,
    matchUpId,
    tournamentId,
    matchUpFormat,
    outOfSync: false,
  };
  controller.on('rejected', (payload: any) => {
    if (payload?.reason === 'version-conflict') {
      state.outOfSync = true;
      shareStatus.textContent =
        'Your shared score is out of sync; turn off Sign in to share and back on to start a new session.';
    } else if (payload?.reason) {
      shareStatus.textContent = `Sharing paused (${payload.reason})`;
    }
  });
  controller.on('disconnect', () => {
    if (activeShare?.sessionId === sessionId) {
      shareStatus.textContent = 'Sharing reconnecting...';
    }
  });
  controller.on('connect', () => {
    if (activeShare?.sessionId === sessionId && !state.outOfSync) {
      shareStatus.textContent = 'Sharing with tournament director';
    }
  });
  return state;
}

function teardownActiveShare(): void {
  if (!activeShare) return;
  const { controller, sessionId } = activeShare;
  try {
    controller.end(sessionId);
  } catch (err) {
    console.warn('[track] crowdRelay.end failed', err);
  }
  controller.disconnect();
  activeShare = undefined;
}

function relayPointIfSharing(detail: StateChangedDetail): void {
  if (!activeShare || activeShare.outOfSync) return;
  const currentScore = toCrowdScoreSnapshot(detail.matchUp);
  const winner = inferPointWinner(activeShare.lastScore, currentScore);
  activeShare.lastScore = currentScore;
  if (!winner) return; // no detectable delta — undo / no-op state change
  activeShare.controller.submit({
    sessionId: activeShare.sessionId,
    matchUpId: activeShare.matchUpId,
    tournamentId: activeShare.tournamentId,
    clientId: activeShare.clientId,
    point: {
      winner,
      recordedAt: new Date().toISOString(),
    },
    currentScore,
    formatHint: activeShare.matchUpFormat,
  });
}

function toCrowdScoreSnapshot(matchUp: any): CrowdScoreSnapshot {
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

function readJwtToken(): string | undefined {
  try {
    const key = getJwtTokenStorageKey();
    const value = globalThis.localStorage?.getItem(key);
    if (typeof value === 'string' && value.length > 0) return value;
  } catch (err) {
    console.warn('[track] reading tmxToken failed', err);
  }
  return undefined;
}

function resolveCrowdRelayBaseUrl(): string {
  const fromEnv = import.meta.env?.VITE_SCORE_RELAY_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');
  const local =
    globalThis.location.host.includes('localhost') || globalThis.location.hostname === '127.0.0.1';
  if (local) return CROWD_RELAY_LOCAL_DEFAULT;
  // Production fallback — same origin as the rest of courthive.net infrastructure.
  return 'https://courthive.net';
}

function resolveClientId(): string {
  try {
    const KEY = 'courthive-public:clientId';
    const existing = globalThis.localStorage?.getItem(KEY);
    if (existing) return existing;
    const fresh = generateId('client');
    globalThis.localStorage?.setItem(KEY, fresh);
    return fresh;
  } catch {
    return generateId('client');
  }
}

function generateId(prefix: string): string {
  const cryptoObj: any = (globalThis as any).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `${prefix}-${cryptoObj.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Test seam — pure-logic helpers exposed for vitest only.
 */
export const __test__ = {
  readJwtToken,
  resolveCrowdRelayBaseUrl,
  toCrowdScoreSnapshot,
  CROWD_RELAY_LOCAL_DEFAULT,
};

interface ResolvedMatchUpMetadata {
  matchUpFormat?: string;
  side1Name?: string;
  side2Name?: string;
}

async function resolveMatchUpFromServer(
  tournamentId: string,
  matchUpId: string,
): Promise<ResolvedMatchUpMetadata | undefined> {
  const info: any = await getTournamentInfo({ tournamentId });
  const tournament = info?.tournamentRecord ?? info;
  if (!tournament) return undefined;

  // Walk the tournament's matchUps to find the one we want.
  // Published tournament info typically surfaces matchUps in several places;
  // this is a best-effort lookup that doesn't need to be exhaustive.
  const allMatchUps: any[] = collectMatchUps(tournament);
  const matchUp = allMatchUps.find((m) => m?.matchUpId === matchUpId);
  if (!matchUp) return undefined;

  return {
    matchUpFormat: matchUp.matchUpFormat,
    side1Name: resolveSideName(matchUp?.sides?.[0]),
    side2Name: resolveSideName(matchUp?.sides?.[1]),
  };
}

function collectMatchUps(tournament: any): any[] {
  const results: any[] = [];
  const events: any[] = tournament?.events ?? [];
  for (const event of events) {
    const drawDefinitions: any[] = event?.drawDefinitions ?? [];
    for (const draw of drawDefinitions) {
      const structures: any[] = draw?.structures ?? [];
      for (const structure of structures) {
        const matchUps: any[] = structure?.matchUps ?? [];
        results.push(...matchUps);
      }
    }
  }
  return results;
}

function resolveSideName(side: any): string {
  if (!side) return '';
  const direct = side?.participant?.participantName;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  const individuals: any[] = side?.participant?.individualParticipants ?? [];
  if (individuals.length > 0) {
    return individuals.map((p) => p?.participantName ?? '').filter(Boolean).join(' / ');
  }
  return '';
}
