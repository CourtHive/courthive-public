/**
 * courthive-public Phase 2 — interactive tracking page.
 *
 * Mounts the `buildInteractiveScoringShell` from courthive-components
 * into the `#track` view. Loads any persisted session from IndexedDB
 * via `crowdTracker`, subscribes to `stateChanged` events, and
 * persists on every change (debounced).
 *
 * Pure-local per Decision 3 — nothing leaves the device. The
 * "Sign in to share" toggle is disabled and shows a tooltip
 * explaining that Phase 3 (server-side sharing) is not yet
 * available.
 */

import { buildInteractiveScoringShell } from 'courthive-components';
import type { InteractiveScoringShell, StateChangedDetail } from 'courthive-components';

import { saveSession, loadSession } from 'src/services/crowdTracker';
import { getTournamentInfo } from 'src/services/api/tournamentsApi';

const PERSIST_DEBOUNCE_MS = 200;

interface RenderTrackPageParams {
  container: HTMLElement;
  tournamentId: string;
  matchUpId: string;
}

let currentShell: InteractiveScoringShell | undefined;

export async function renderTrackPage(params: RenderTrackPageParams): Promise<void> {
  const { container, tournamentId, matchUpId } = params;

  // Clean up any previous shell before mounting a new one
  destroyCurrentShell();

  container.innerHTML = '';

  // Page chrome
  const chrome = buildPageChrome(tournamentId, matchUpId);
  container.append(chrome);

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
  };
  shell.addEventListener('stateChanged', onStateChanged);

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
}

function buildPageChrome(tournamentId: string, matchUpId: string): HTMLElement {
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

  // "Sign in to share" disabled toggle
  const shareRow = document.createElement('div');
  shareRow.className = 'track-page-share-row';
  const shareToggle = document.createElement('button');
  shareToggle.type = 'button';
  shareToggle.className = 'track-page-share-toggle';
  shareToggle.disabled = true;
  shareToggle.textContent = 'Sign in to share (coming soon)';
  shareToggle.title =
    'In a future release, signed-in users will be able to share their practice scoring ' +
    'with the tournament director as an informational feed. For now, sessions are local-only.';
  shareRow.append(shareToggle);

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
  return chrome;
}

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
