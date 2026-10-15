/**
 * Inline crowd scoring on the published bracket.
 *
 * Mirrors TMX's pattern in `pages/tournament/tabs/eventsTab/renderDraws/renderDrawView.ts`
 * (`applyInlineScoringWrappers` + `markReadyMatchUpsInProgress`) but routes the
 * onSubmit / onScoreChange callbacks at courthive-public's local IndexedDB
 * (`crowdTracker`) instead of the server mutation pipeline.
 *
 * Every scored change is persisted locally. When the caller passes a
 * `crowdShare` hub, the same change is also relayed to score-relay's `/crowd`
 * namespace — the hub sends only for a signed-in visitor, so a signed-out
 * visitor stays local-only.
 */
import { InlineScoringManager, renderInlineMatchUp, isScorable, sideParticipantName } from 'courthive-components';
import { saveSession, deleteSession, listActiveSessions, CrowdTrackerSession } from 'src/services/crowdTracker';
import type { CrowdShareHub } from 'src/services/crowdShare';

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

/**
 * Attached alongside `SCORED_IDS_KEY` so a caller can extend the manager's base-matchUp lookup after
 * construction. Same attach-and-accessor idiom, for the same reason: `InlineScoringManager` is a
 * courthive-components type we do not own.
 */
const REGISTER_KEY = '__registerMatchUps';

function matchUpHasScore(matchUp: any): boolean {
  return Boolean(matchUp?.score?.sets?.length) || Boolean(matchUp?.winningSide);
}

/** Statuses that end a matchUp officially; SUSPENDED is a pause, not an ending. */
const OFFICIAL_ENDING_STATUSES = new Set([
  'COMPLETED',
  'RETIRED',
  'DEFAULTED',
  'WALKOVER',
  'DOUBLE_WALKOVER',
  'DOUBLE_DEFAULT',
  'CANCELLED',
  'ABANDONED',
]);

/**
 * Whether the published matchUp carries the TD's official result. Local Track scoring is kept on the
 * visitor's device only until this is true; after that the official result is what the bracket shows.
 */
export function hasOfficialResult(matchUp: any): boolean {
  return Boolean(matchUp?.winningSide) || OFFICIAL_ENDING_STATUSES.has(matchUp?.matchUpStatus);
}

interface PrebuildParams {
  tournamentId: string;
  matchUps: any[];
}

interface BuildManagerParams {
  tournamentId: string;
  savedSessions: Map<string, CrowdTrackerSession>;
  matchUps: any[];
  /** Relays each scored change to the TD's crowd feed; omit for local-only scoring. */
  crowdShare?: CrowdShareHub;
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
export async function loadSavedSessionsForTournament(tournamentId: string): Promise<Map<string, CrowdTrackerSession>> {
  const all = await listActiveSessions();
  const byMatchUpId = new Map<string, CrowdTrackerSession>();
  for (const session of all) {
    if (session.tournamentId === tournamentId) byMatchUpId.set(session.matchUpId, session);
  }
  return byMatchUpId;
}

// isScorable and sideParticipantName now come from courthive-components (>=4.0.0), where the gate
// sits beside renderInlineMatchUp — the single place a scoring affordance is minted. Keeping local
// copies risked the two drifting while both existed.

/**
 * Mirror TMX's `markReadyMatchUpsInProgress`: any matchUp with both sides
 * resolved and no winner yet is treated as IN_PROGRESS so the inline-scoring
 * wrapper picks it up. Mutates the matchUps in place — same contract as TMX
 * — but stashes the pre-mutation status on `__inlineOriginalStatus` so the
 * toggle-OFF path (`unmarkReadyMatchUpsInProgress`) can revert.
 */
export function markReadyMatchUpsInProgress(matchUps: any[]): void {
  for (const m of matchUps || []) {
    // Same gate as the scoring UI. Marking something IN_PROGRESS is what makes the wrapper pick it up,
    // so a looser rule here would re-open the hole the wrapper closes.
    const hasBothParticipants = isScorable(m);
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
 * Add matchUps to a manager's base lookup after it was built.
 *
 * The lookup is what supplies `matchUpFormat` and both side names when a session is persisted, and it
 * is populated once at construction from whatever matchUps the caller had then. That is correct while
 * one `getEventData` call returns every matchUp in the event — but it makes ANY change that renders a
 * matchUp the manager has not seen a silent data-quality bug, because the persistence path falls back
 * rather than failing (see `resolveBase`).
 *
 * Progressive/lazy loading of draws is the concrete case: call this as each draw's matchUps arrive.
 * Idempotent, so re-registering the same matchUps is free.
 *
 * A no-op if the manager did not come from `buildInlineCrowdManager` — mirrors `getScoredMatchUpIds`.
 */
export function registerMatchUps(manager: InlineScoringManager, matchUps: any[]): void {
  ((manager as any)[REGISTER_KEY] as ((m: any[]) => void) | undefined)?.(matchUps);
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
export function overlayLocalScores(matchUps: any[], manager: InlineScoringManager, scoredIds: Set<string>): void {
  // Register first: that is what seeds a saved session's engine for a draw that loaded after the
  // manager was built. Without it the overlay below finds no engine and shows the TD's score.
  registerMatchUps(manager, matchUps);
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
  crowdShare,
}: BuildManagerParams): InlineScoringManager {
  const baseLookup = new Map<string, any>();
  // matchUpIds already seeded, so a re-registration never re-seeds an engine the visitor is using.
  const seededMatchUpIds = new Set<string>();

  // Seed engines from saved sessions first (so users resume mid-game),
  // then fall back to seeding from the published matchUp's score.
  //
  // Runs whenever a matchUp first becomes known, not only at construction: production serves draw
  // STUBS and loads each draw's structures later, so at construction there are often no matchUps at
  // all. Seeding only then left every lazily-loaded saved session without its engine, and a reload
  // lost the visitor's local scoring.
  const seed = (m: any): void => {
    const matchUpId = m?.matchUpId;
    if (seededMatchUpIds.has(matchUpId)) return;
    const saved = savedSessions.get(matchUpId);
    if (saved && hasOfficialResult(m)) {
      seededMatchUpIds.add(matchUpId);
      // The TD's result supersedes local tracking — drop the session rather than overlay it.
      savedSessions.delete(matchUpId);
      scoredMatchUpIds.delete(matchUpId);
      deleteSession(tournamentId, matchUpId).catch(() => undefined);
      return;
    }
    // Not marked as seeded: a matchUp that is not scorable YET (sides still unhydrated) gets another
    // chance when it is registered again.
    if (!isScorable(m)) return;
    seededMatchUpIds.add(matchUpId);
    // A completed tie (COMPLETED, no winner) is finished: no live engine for it.
    if (saved || (m.readyToScore && !m.winningSide && m.matchUpStatus !== 'COMPLETED')) {
      manager.getOrCreate(matchUpId, m.matchUpFormat, (saved?.matchUp as any) ?? m);
    }
  };

  const addToBaseLookup = (additional: any[]): void => {
    for (const m of additional || []) {
      if (!m?.matchUpId) continue;
      baseLookup.set(m.matchUpId, m);
      seed(m);
    }
  };

  // Warn ONCE per matchUpId. A miss recurs on every point of a game, and a per-point warning would
  // bury the signal it exists to raise.
  const warnedMissingBase = new Set<string>();

  /**
   * The base matchUp behind a persisted session, or `undefined` with a warning.
   *
   * A miss is NOT harmless and must never pass silently. Nothing is substituted for it any more: the
   * persist path REFUSES when the format or either side name cannot be resolved from real data, so a
   * miss costs the session rather than producing a record that reads as genuine.
   *
   * `isScorable` should make this unreachable — a matchUp that cannot be named or formatted is never
   * offered for scoring. Reaching it means something upstream bypassed the gate, and the fix is to
   * `registerMatchUps` on load, not to relax the refusal.
   */
  const resolveBase = (matchUpId: string): any => {
    const base = baseLookup.get(matchUpId);
    if (!base && !warnedMissingBase.has(matchUpId)) {
      warnedMissingBase.add(matchUpId);
      console.warn(
        `[inlineCrowdScoring] no base matchUp for ${matchUpId} — the persist below will REFUSE ` +
          `unless the engine's own matchUp carries a format and names. ` +
          `Call registerMatchUps(manager, matchUps) when the draw containing it loads.`,
      );
    }
    return base;
  };

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
    // Relay immediately, not on the persist debounce: the hub diffs successive
    // scores to attribute each change, so coalescing two changes would hide one.
    crowdShare?.relayScore({
      matchUpId,
      matchUpFormat: scoredMatchUp?.matchUpFormat ?? baseLookup.get(matchUpId)?.matchUpFormat,
      matchUp: scoredMatchUp,
    });
    if (matchUpHasScore(scoredMatchUp)) scoredMatchUpIds.add(matchUpId);
    else scoredMatchUpIds.delete(matchUpId);
    pendingPersist = async () => {
      const base = resolveBase(matchUpId);
      const matchUpFormat = scoredMatchUp?.matchUpFormat ?? base?.matchUpFormat;
      const side1Name = sideParticipantName(base, 1);
      const side2Name = sideParticipantName(base, 2);

      // REFUSE rather than substitute. `isScorable` means this is unreachable in normal operation, so
      // reaching it is an invariant violation — something upstream offered scoring on a matchUp that
      // should not have been offered. Writing a guessed format or a "Side 1" placeholder would launder
      // that bug into a record indistinguishable from a real one; skipping the write leaves the engine
      // state in memory and the defect visible.
      if (!matchUpFormat || !side1Name || !side2Name) {
        console.error(
          `[inlineCrowdScoring] refusing to persist ${matchUpId} — ` +
            `matchUpFormat=${matchUpFormat ?? 'MISSING'}, side1=${side1Name ?? 'MISSING'}, ` +
            `side2=${side2Name ?? 'MISSING'}. A scorable matchUp must carry the factory's ` +
            `matchUpFormat and hydrated participants; this one was offered for scoring anyway.`,
        );
        return;
      }

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
      const base = resolveBase(matchUpId);
      const current = manager.get(matchUpId)?.engine?.getMatchUp?.(base) ?? base;
      schedulePersist(matchUpId, current);
      flushPersist();
    },
    onEndMatch: ({ matchUpId }) => {
      const base = resolveBase(matchUpId);
      const current = manager.get(matchUpId)?.engine?.getMatchUp?.(base) ?? base;
      schedulePersist(matchUpId, current);
      flushPersist();
    },
    onSubmit: ({ matchUpId, matchUp }) => {
      schedulePersist(matchUpId, matchUp);
      flushPersist();
    },
  });

  addToBaseLookup(matchUps);

  (manager as any)[SCORED_IDS_KEY] = scoredMatchUpIds;
  (manager as any)[REGISTER_KEY] = addToBaseLookup;
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
  // Register at the POINT OF USE, not at load time. Anything that gets an inline scoring wrapper is
  // something the visitor can score, so this makes "every scorable matchUp is in the base lookup" an
  // invariant the render path maintains itself — rather than a rule each caller has to remember when
  // it fetches. Idempotent, and it is what keeps progressive draw loading safe by construction.
  registerMatchUps(manager, matchUps);

  for (const m of matchUps || []) {
    const isInProgress = m?.matchUpStatus === 'IN_PROGRESS' && !m?.winningSide;
    const isIrregularEnding = IRREGULAR_STATUSES.has(m?.matchUpStatus);
    if (!isInProgress && !isIrregularEnding) continue;
    // The gate. Anything that fails it gets no scoring affordance at all, so no engine is created,
    // no session is persisted, and there is nothing to substitute a value into.
    if (!isScorable(m)) continue;

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
    // The library refuses a matchUp it cannot score correctly and returns null (courthive-components
    // #540). courthive-public does NOT set strictNullChecks, so nothing here would catch that at
    // compile time — the guard is the only thing standing between a refusal and replaceChild(null).
    if (!inlineEl) continue;
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

/**
 * Test seam — exposed for vitest only.
 */
export const __test__ = {
  IRREGULAR_STATUSES,
  PERSIST_DEBOUNCE_MS,
};

export type { PrebuildParams, BuildManagerParams, ApplyWrappersParams };
