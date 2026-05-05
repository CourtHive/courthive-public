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
import { InlineScoringManager, renderInlineMatchUp } from 'courthive-components';

import { saveSession, listActiveSessions } from 'src/services/crowdTracker';
import type { CrowdTrackerSession } from 'src/services/crowdTracker';

const IRREGULAR_STATUSES = new Set(['RETIRED', 'DEFAULTED', 'WALKOVER', 'SUSPENDED', 'CANCELLED', 'ABANDONED']);
const PERSIST_DEBOUNCE_MS = 200;

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
 * wrapper picks it up. Mutates the matchUps in place — same contract as TMX.
 */
export function markReadyMatchUpsInProgress(matchUps: any[]): void {
  for (const m of matchUps || []) {
    const hasBothParticipants = m?.sides?.length === 2 && m.sides[0]?.participant && m.sides[1]?.participant;
    if (!hasBothParticipants) continue;
    if (m?.readyToScore && !m?.winningSide && (!m?.matchUpStatus || m.matchUpStatus === 'TO_BE_PLAYED')) {
      m.matchUpStatus = 'IN_PROGRESS';
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
 */
export function withInlineScoringConfig(composition: any): any {
  return {
    ...composition,
    configuration: {
      ...composition.configuration,
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
