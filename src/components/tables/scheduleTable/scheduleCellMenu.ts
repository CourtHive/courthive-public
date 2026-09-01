import { openScoringLaunchMenu } from 'src/components/scoringLaunchMenu';
import { setPendingMatchUpFocus } from 'src/services/matchUpFocus';
import { navigateToTournamentPath } from 'src/router/router';
import { t } from 'src/i18n/i18n';

/**
 * Schedule-cell popover.
 *
 * TMX's grid cells open a sectioned popover whose "View draw" action navigates
 * to the matchUp *in context* — the right event, draw and structure — and pulses
 * the match once it renders. That is the affordance the public schedule was
 * missing: a spectator could see that Court 3 at 09:00 is a quarterfinal, and
 * had no way from there to the bracket it belongs to.
 *
 * The public version carries the two actions that make sense without a desk:
 * navigate into the draw, and launch scoring (the same crowd-scoring launch the
 * bracket already offers). It reuses `openScoringLaunchMenu`, so the launch
 * config resolution and the popover mechanics are one implementation.
 */

const POPOVER_ID = 'schedule-cell-popover';

export interface ScheduleCellMenuModel {
  /** Section label: the event and round this cell belongs to. */
  sectionLabel: string;
  /** A draw is addressable only with both an eventId and a drawId. */
  canNavigate: boolean;
}

/**
 * Pure model behind the popover.
 *
 * `roundName` is used here as a **label only, never as identity**. Round names
 * are policy-derived — a provider's naming policy can turn "Quarterfinal" into
 * "Round of 8" or a localized string, and the same round can be named
 * differently in two events of one tournament. Everything this popover *does*
 * is keyed on ids: navigation on `eventId` / `drawId` / `structureId`, focus on
 * `matchUpId`, and the bracket's own round selection on `roundNumber`.
 *
 * The label degrades in the order name → number → event alone, so a payload
 * without a `roundName` still says which round the viewer is looking at rather
 * than rendering a stray separator.
 */
function roundLabelOf(matchUp: any): string | undefined {
  const roundName = matchUp?.roundName;
  if (typeof roundName === 'string' && roundName.trim()) return roundName.trim();
  const roundNumber = Number(matchUp?.roundNumber);
  return Number.isFinite(roundNumber) && roundNumber > 0 ? `R${roundNumber}` : undefined;
}

export function buildScheduleCellMenuModel(matchUp: any): ScheduleCellMenuModel {
  const parts = [matchUp?.eventName, roundLabelOf(matchUp)].filter((part) => typeof part === 'string' && part.trim());
  return {
    sectionLabel: parts.join(' · '),
    canNavigate: !!(matchUp?.eventId && matchUp?.drawId),
  };
}

/**
 * Navigate to the matchUp inside its draw, stashing a focus so the bracket
 * scrolls to it and pulses once rendered. No-op (returns false) when the
 * matchUp cannot be addressed.
 */
export function navigateToMatchUpInDraw({ tournamentId, matchUp }: { tournamentId: string; matchUp: any }): boolean {
  if (!tournamentId || !buildScheduleCellMenuModel(matchUp).canNavigate) return false;
  setPendingMatchUpFocus(matchUp.matchUpId);
  navigateToTournamentPath({
    tournamentId,
    eventId: matchUp.eventId,
    drawId: matchUp.drawId,
    structureId: matchUp.structureId,
  });
  return true;
}

export async function openScheduleCellMenu({
  pointerEvent,
  matchUp,
  tournamentId,
}: {
  pointerEvent: MouseEvent;
  matchUp: any;
  tournamentId: string;
}): Promise<void> {
  if (!matchUp?.matchUpId || !tournamentId) return;
  const { sectionLabel, canNavigate } = buildScheduleCellMenuModel(matchUp);

  const extraItems = canNavigate
    ? [
        {
          label: t('schedule.viewInDraw'),
          onClick: () => {
            navigateToMatchUpInDraw({ tournamentId, matchUp });
          },
        },
      ]
    : [];

  await openScoringLaunchMenu({ pointerEvent, matchUp, tournamentId, extraItems, sectionLabel, id: POPOVER_ID });
}
