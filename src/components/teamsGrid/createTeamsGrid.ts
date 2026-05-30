/**
 * Teams Grid — renders a card-grid of TEAM participants above the Players
 * table. Consumes the `buildTeamCard` primitive from courthive-components so
 * the card visuals match the same primitive TMX uses for its team-profile
 * modal header — no markup duplicated across the public viewer.
 *
 * The grid is hidden entirely when the tournament has no team participants.
 * Coach / staff counts come from the same source TMX uses: individuals whose
 * `person.biographicalInformation.teamAttributes[0].teamName` matches the
 * team's `participantName`. The factory's
 * `createTeamsFromParticipantAttributes` only adds COMPETITORs to
 * `individualParticipantIds[]`, so coaches and physios are queried separately
 * by team-name match.
 *
 * Pure count logic lives in `teamsCountLogic.ts` so unit tests can exercise
 * the math without pulling in the courthive-components bundle (which assumes
 * a DOM at module load time).
 */
import './teams-grid.css';
import { CountParticipant, computeTeamCounts, indexIndividualsByTeamName } from './teamsCountLogic';
import { buildTeamCard } from 'courthive-components';
import { t } from 'src/i18n/i18n';

const ANCHOR_ID = 'teamsGrid';
const GRID_CLASS = 'chp-teams-grid';
const SECTION_HEADING_CLASS = 'chp-teams-grid-heading';

type GridParticipant = CountParticipant & {
  participantOtherName?: string;
};

export function createTeamsGrid({ participants = [] }: { participants?: GridParticipant[] }): void {
  const element = document.getElementById(ANCHOR_ID);
  if (!element) return;

  // Always clear the anchor before re-rendering — handles tab re-entry +
  // live-update refresh paths.
  element.innerHTML = '';

  const teams = participants.filter((p) => p.participantType === 'TEAM');
  if (!teams.length) {
    element.style.display = 'none';
    return;
  }
  element.style.display = '';

  const heading = document.createElement('div');
  heading.className = SECTION_HEADING_CLASS;
  heading.textContent = t('players.teamsHeading');
  element.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = GRID_CLASS;
  element.appendChild(grid);

  const individualsByTeamName = indexIndividualsByTeamName(participants);

  for (const team of teams) {
    const counts = formatCountSegments(team, individualsByTeamName);
    const card = buildTeamCard({
      teamId: team.participantId,
      teamName: team.participantName || team.participantId,
      nickname: team.participantOtherName || undefined,
      countSegments: counts,
    });
    grid.appendChild(card);
  }
}

function formatCountSegments(
  team: GridParticipant,
  index: Map<string, CountParticipant[]>,
): string[] {
  const { players, coaches, staff } = computeTeamCounts(team, index);
  const segments: string[] = [];
  if (players > 0) segments.push(t('players.teamCounts.players', { count: players }));
  if (coaches > 0) segments.push(t('players.teamCounts.coaches', { count: coaches }));
  if (staff > 0) segments.push(t('players.teamCounts.staff', { count: staff }));
  return segments;
}
