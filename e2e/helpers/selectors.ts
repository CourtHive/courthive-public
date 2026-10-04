/**
 * Stable DOM selectors for courthive-public e2e tests.
 *
 * Mirrors the id constants in `src/common/constants/elementConstants.ts` and
 * `routerConstants.ts`, plus a few literal ids assigned in render code
 * (`tournament-hero`, `eventButton`, `tournamentSchedule`). Kept here so a
 * markup id change breaks one file, not every spec.
 */
export const sel = {
  // Top-level view containers (rootBlock)
  splash: '#splash',
  tournaments: '#tournaments',
  tournament: '#tournament',

  // Tournament view
  titleBlock: '#tournament_title_block',
  logo: '#tournament_logo',
  hero: '#tournament-hero',

  // Events tab
  eventButton: '#eventButton',
  flightDisplay: '#flightDisplay',

  // Schedule tab
  scheduleHeader: '#scheduleHeader',
  scheduleGrid: '#tournamentSchedule',

  // Players tab
  playersTable: '#playersTable',

  // Nav
  back: '#back',
} as const;

type TabName = 'Info' | 'Events' | 'Schedule' | 'Matches' | 'Players' | 'Stats';

/** Tab <li> id — see `helpers/tabIds.ts` (`tab_tournament_<name>`). */
export function tabId(name: TabName) {
  return `#tab_tournament_${name.toLowerCase()}`;
}

/** Tab content <section> id — see `helpers/tabIds.ts` (`tournament_<name>`). */
export function tabContentId(name: TabName) {
  return `#tournament_${name.toLowerCase()}`;
}
