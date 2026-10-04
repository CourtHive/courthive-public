import { fetchScoringLaunch, launchScoring } from 'src/services/scoringLaunch';
import { openFloatingMenu } from 'src/components/popovers/floatingMenu';
import { t } from 'src/i18n/i18n';

/**
 * A small floating popover, anchored at the click point, offering a
 * "Score this match" action that launches the provider's configured scoring
 * app (Epixodic by default; EMBEDDED /track or an EXTERNAL app — e.g. IONSport
 * — when the provider declares it). Consumers may inject `extraItems` (e.g.
 * "Open scorecard" for TEAM matchUps) and an optional section label.
 *
 * The popover mechanics (positioning, outside-click, Escape, single instance)
 * live in `popovers/floatingMenu.ts`, shared with the schedule cell menu.
 */

const POPOVER_ID = 'scoring-launch-popover';

export interface ScoringMenuItem {
  label: string;
  onClick: () => void;
}

export async function openScoringLaunchMenu({
  pointerEvent,
  matchUp,
  tournamentId,
  extraItems = [],
  sectionLabel,
  id = POPOVER_ID,
}: {
  pointerEvent: MouseEvent;
  matchUp: any;
  tournamentId: string;
  extraItems?: ScoringMenuItem[];
  sectionLabel?: string;
  id?: string;
}): Promise<void> {
  if (!matchUp?.matchUpId || !tournamentId) return;

  const config = await fetchScoringLaunch(tournamentId);
  const ctx = {
    tournamentId,
    matchUpId: matchUp.matchUpId,
    eventId: matchUp.eventId,
    drawId: matchUp.drawId,
  };

  const items = [
    ...extraItems.map((item) => ({ label: item.label, onClick: item.onClick })),
    { label: t('scoring.scoreThisMatch'), onClick: () => launchScoring(config, ctx) },
  ];

  openFloatingMenu({ pointerEvent, sections: [{ text: sectionLabel, items }], id });
}
