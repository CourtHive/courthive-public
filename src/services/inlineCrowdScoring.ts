/**
 * Inline crowd scoring on the published bracket.
 *
 * Mirrors TMX's pattern in `pages/tournament/tabs/eventsTab/renderDraws/renderDrawView.ts`
 * (`applyInlineScoringWrappers` + `markReadyMatchUpsInProgress`) but routes the
 * onSubmit / onScoreChange callbacks at courthive-public's local IndexedDB
 * (`crowdTracker`) instead of the server mutation pipeline.
 *
 * Phase 2 spirit: anonymous + local-only. Phase 3 will add a relay write
 * for signed-in users on top of these same callbacks.
 */
import { saveSession, listActiveSessions, CrowdTrackerSession } from 'src/services/crowdTracker';
import { InlineScoringManager, renderInlineMatchUp } from 'courthive-components';

const IRREGULAR_STATUSES = new Set(['RETIRED', 'DEFAULTED', 'WALKOVER', 'SUSPENDED', 'CANCELLED', 'ABANDONED']);
const PERSIST_DEBOUNCE_MS = 200;
/**
 * Hidden property used to remember a matchUp's pre-mutation status so we can
 * revert it when the user toggles Track OFF. Stored on the matchUp object
 * itself because matchUps are long-lived in the renderEvent closure and the
 * mutation needs to be reversible across re-renders.
 */
const ORIGINAL_STATUS_KEY = '__inlineOriginalStatus';
/**
 * Same idea for matchUp.score — `overlayLocalScores` overlays the engine's
 * current state onto matchUp.score so the locally-entered score is visible
 * regardless of toggle state. We stash the TD's published score here so we
 * can revert if the visitor clears their local score (drops out of the
 * scored set) and the engine ends up empty.
 */
const ORIGINAL_SCORE_KEY = '__inlineOriginalScore';
/**
 * Custom property attached to the InlineScoringManager that records every
 * matchUpId where actual scoring has happened (either via a hydrated
 * IndexedDB session or via an in-session onScoreChange). Lets the toggle-OFF
 * path keep [LIVE] on matchUps that have real scoring data while reverting
 * the rest.
 */
const SCORED_IDS_KEY = '__scoredMatchUpIds';

function matchUpHasScore(matchUp: any): boolean {
  return Boolean(matchUp?.score?.sets?.length) || Boolean(matchUp?.winningSide);
}

interface PrebuildParams {
  tournamentId: string;
  matchUps: any[];
}

interface BuildManagerParams {
  tournamentId: string;
  savedSessions: Map<string, CrowdTrackerSession>;
  matchUps: any[];
}

interface ApplyWrappersParams {
  container: HTMLElement;
  matchUps: any[];
  manager: InlineScoringManager;
  composition: any;
  initialRoundNumber?: number;
}

/**
 * Read every persisted crowd session for the given tournament and return a
 * Map keyed by matchUpId. The map is consumed by `buildInlineCrowdManager`
 * to pre-create engines mid-game so the user resumes where they left off.
 */
export async function loadSavedSessionsForTournament(
  tournamentId: string,
): Promise<Map<string, CrowdTrackerSession>> {
  const all = await listActiveSessions();
  const byMatchUpId = new Map<string, CrowdTrackerSession>();
  for (const session of all) {
    if (session.tournamentId === tournamentId) byMatchUpId.set(session.matchUpId, session);
  }
  return byMatchUpId;
}

/**
 * Mirror TMX's `markReadyMatchUpsInProgress`: any matchUp with both sides
 * resolved and no winner yet is treated as IN_PROGRESS so the inline-scoring
 * wrapper picks it up. Mutates the matchUps in place — same contract as TMX
 * — but stashes the pre-mutation status on `__inlineOriginalStatus` so the
 * toggle-OFF path (`unmarkReadyMatchUpsInProgress`) can revert.
 */
export function markReadyMatchUpsInProgress(matchUps: any[]): void {
  for (const m of matchUps || []) {
    const hasBothParticipants = m?.sides?.length === 2 && m.sides[0]?.participant && m.sides[1]?.participant;
    if (!hasBothParticipants) continue;
    if (m?.readyToScore && !m?.winningSide && (!m?.matchUpStatus || m.matchUpStatus === 'TO_BE_PLAYED')) {
      if (!(ORIGINAL_STATUS_KEY in m)) m[ORIGINAL_STATUS_KEY] = m.matchUpStatus;
      m.matchUpStatus = 'IN_PROGRESS';
    }
  }
}

/**
 * Revert the IN_PROGRESS mutation written by `markReadyMatchUpsInProgress`,
 * except for matchUps that have actually been scored — those keep their
 * IN_PROGRESS status (and therefore their [LIVE] badge) so the visitor can
 * see at a glance which matchUps they've engaged with locally.
 */
export function unmarkReadyMatchUpsInProgress(matchUps: any[], scoredIds?: Set<string>): void {
  for (const m of matchUps || []) {
    if (!(ORIGINAL_STATUS_KEY in m)) continue;
    if (scoredIds?.has(m.matchUpId)) continue;
    m.matchUpStatus = m[ORIGINAL_STATUS_KEY];
    delete m[ORIGINAL_STATUS_KEY];
  }
}

/**
 * Read the scored-matchUpIds Set off an InlineScoringManager built by
 * `buildInlineCrowdManager`. Returns an empty Set if absent (e.g., the
 * manager came from somewhere else).
 */
export function getScoredMatchUpIds(manager: InlineScoringManager): Set<string> {
  return ((manager as any)[SCORED_IDS_KEY] as Set<string> | undefined) ?? new Set();
}

/**
 * Overlay each scored matchUp's engine state onto matchUp.score / winningSide
 * so the locally-entered score is visible in the bracket regardless of toggle
 * state. For matchUps that drop out of the scored set (Clear pressed), revert
 * to the TD's published score that we stashed on first overlay.
 *
 * Mutation pattern mirrors `markReadyMatchUpsInProgress`: stashes original on
 * `__inlineOriginalScore` so the change is reversible across re-renders.
 */
export function overlayLocalScores(
  matchUps: any[],
  manager: InlineScoringManager,
  scoredIds: Set<string>,
): void {
  for (const m of matchUps || []) {
    const inScoredSet = m?.matchUpId && scoredIds.has(m.matchUpId);
    if (inScoredSet) {
      const engineMatchUp = manager.getMatchUp?.(m.matchUpId, m);
      if (matchUpHasScore(engineMatchUp)) {
        if (!(ORIGINAL_SCORE_KEY in m)) {
          m[ORIGINAL_SCORE_KEY] = { score: m.score, winningSide: m.winningSide };
        }
        m.score = engineMatchUp.score;
        if (engineMatchUp.winningSide !== undefined) m.winningSide = engineMatchUp.winningSide;
      }
    } else if (ORIGINAL_SCORE_KEY in m) {
      const original = m[ORIGINAL_SCORE_KEY];
      m.score = original.score;
      m.winningSide = original.winningSide;
      delete m[ORIGINAL_SCORE_KEY];
    }
  }
}

/**
 * Build the InlineScoringManager. onScoreChange + onMatchComplete + onEndMatch
 * persist to IndexedDB (debounced); onSubmit also flushes immediately.
 *
 * Pre-creates engines for any matchUp that has a saved crowd session OR that
 * has a server-side score already in flight, so resume works on the next
 * tap without losing in-progress state.
 */
export function buildInlineCrowdManager({
  tournamentId,
  savedSessions,
  matchUps,
}: BuildManagerParams): InlineScoringManager {
  const baseLookup = new Map<string, any>();
  for (const m of matchUps || []) {
    if (m?.matchUpId) baseLookup.set(m.matchUpId, m);
  }

  // matchUpIds that have actual scoring data — pre-populated from saved
  // IndexedDB sessions that contain real score state, then kept in sync
  // by every persist (add when a point lands, delete when the engine is
  // cleared back to empty) so toggle-OFF can preserve [LIVE] on engaged
  // matchUps only.
  const scoredMatchUpIds = new Set<string>(
    Array.from(savedSessions.entries())
      .filter(([, session]) => matchUpHasScore(session.matchUp))
      .map(([id]) => id),
  );

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingPersist: (() => Promise<void>) | null = null;

  const flushPersist = (): void => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    if (pendingPersist) {
      const fn = pendingPersist;
      pendingPersist = null;
      void fn();
    }
  };

  const schedulePersist = (matchUpId: string, scoredMatchUp: any): void => {
    if (matchUpHasScore(scoredMatchUp)) scoredMatchUpIds.add(matchUpId);
    else scoredMatchUpIds.delete(matchUpId);
    pendingPersist = async () => {
      const base = baseLookup.get(matchUpId);
      const matchUpFormat = scoredMatchUp?.matchUpFormat ?? base?.matchUpFormat ?? 'SET3-S:6/TB7';
      const side1Name = resolveSideName(base, 1);
      const side2Name = resolveSideName(base, 2);
      try {
        await saveSession({
          tournamentId,
          matchUpId,
          matchUpFormat,
          side1Name,
          side2Name,
          matchUp: scoredMatchUp,
        });
      } catch (err) {
        console.warn('[inlineCrowdScoring] saveSession failed', err);
      }
    };
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      flushPersist();
    }, PERSIST_DEBOUNCE_MS);
  };

  const manager = new InlineScoringManager({
    onScoreChange: ({ matchUpId, matchUp }) => schedulePersist(matchUpId, matchUp),
    onMatchComplete: ({ matchUpId }) => {
      const base = baseLookup.get(matchUpId);
      const current = manager.get(matchUpId)?.engine?.getMatchUp?.(base) ?? base;
      schedulePersist(matchUpId, current);
      flushPersist();
    },
    onEndMatch: ({ matchUpId }) => {
      const base = baseLookup.get(matchUpId);
      const current = manager.get(matchUpId)?.engine?.getMatchUp?.(base) ?? base;
      schedulePersist(matchUpId, current);
      flushPersist();
    },
    onSubmit: ({ matchUpId, matchUp }) => {
      schedulePersist(matchUpId, matchUp);
      flushPersist();
    },
  });

  // Seed engines from saved sessions first (so users resume mid-game),
  // then fall back to seeding from the published matchUp's score.
  for (const m of matchUps || []) {
    const matchUpId = m?.matchUpId;
    if (!matchUpId || !m.matchUpFormat) continue;
    const saved = savedSessions.get(matchUpId);
    const seed = (saved?.matchUp as any) ?? m;
    if (saved || (m.readyToScore && !m.winningSide)) {
      manager.getOrCreate(matchUpId, m.matchUpFormat, seed);
    }
  }

  (manager as any)[SCORED_IDS_KEY] = scoredMatchUpIds;
  return manager;
}

/**
 * Find the rendered matchUp cells inside `container` and replace any that are
 * IN_PROGRESS / irregular-ending with `renderInlineMatchUp` output. Mirrors
 * TMX's `applyInlineScoringWrappers` so that the same renderInlineMatchUp UX
 * (point/game increment buttons, undo/redo, end-match popover) lights up on
 * the published bracket.
 */
export function applyInlineScoringWrappers({
  container,
  matchUps,
  manager,
  composition,
  initialRoundNumber = 1,
}: ApplyWrappersParams): void {
  for (const m of matchUps || []) {
    const isInProgress = m?.matchUpStatus === 'IN_PROGRESS' && !m?.winningSide;
    const isIrregularEnding = IRREGULAR_STATUSES.has(m?.matchUpStatus);
    if (!isInProgress && !isIrregularEnding) continue;
    if (!m?.sides?.length || !m.sides[0]?.participant || !m.sides[1]?.participant) continue;

    const existing = container.querySelector(`#${CSS.escape(m.matchUpId)}`);
    if (!existing?.parentElement) continue;

    const moiety = m.roundPosition ? m.roundPosition % 2 === 1 : undefined;
    const isFinalRound = m.finishingRound ? Number(m.finishingRound) === 1 : false;

    const inlineEl = renderInlineMatchUp({
      matchUp: m,
      composition,
      manager,
      matchUpFormat: m.matchUpFormat,
      initialRoundNumber,
      isFinalRound,
      moiety,
    });
    existing.parentElement.replaceChild(inlineEl, existing);
  }
}

/**
 * Merge the inlineScoring composition config onto a published composition.
 * Returns a shallow copy so we never mutate the cached published composition.
 *
 * `matchUpFooter: true` is the actual gate that lets `renderMatchUp` emit
 * the footer with Undo / Redo / Clear / Submit buttons; without it the
 * footer block is skipped entirely. (See renderMatchUp.ts:119.)
 */
export function withInlineScoringConfig(composition: any): any {
  return {
    ...composition,
    configuration: {
      ...composition.configuration,
      matchUpFooter: true,
      inlineScoring: {
        mode: 'games' as const,
        showFooter: true,
        showSituation: true,
      },
    },
  };
}

function resolveSideName(matchUp: any, sideNumber: number): string {
  if (!matchUp) return `Side ${sideNumber}`;
  const side = matchUp.sides?.find?.((s: any) => s?.sideNumber === sideNumber) ?? matchUp.sides?.[sideNumber - 1];
  if (!side) return `Side ${sideNumber}`;
  const direct = side?.participant?.participantName;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  const individuals = side?.participant?.individualParticipants ?? [];
  if (individuals.length > 0) {
    return individuals.map((p: any) => p?.participantName ?? '').filter(Boolean).join(' / ') || `Side ${sideNumber}`;
  }
  return `Side ${sideNumber}`;
}

/**
 * Test seam — exposed for vitest only.
 */
export const __test__ = {
  IRREGULAR_STATUSES,
  PERSIST_DEBOUNCE_MS,
};

export type {
  PrebuildParams,
  BuildManagerParams,
  ApplyWrappersParams,
};
