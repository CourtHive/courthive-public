/**
 * Pure decisions behind the public schedule grid.
 *
 * Kept out of `createScheduleTable.ts` because this repo's vitest runs without
 * a DOM: anything asserted has to be a function over data, not over elements.
 */

import { matchUpMatchesSearch, normalizeSearch } from 'src/common/filters/participantMatch';

/**
 * Today, as the ISO calendar day the viewer is on.
 *
 * Deliberately the *device's* local day rather than UTC: "today" on a schedule
 * is the day the person reading it is living through. Venue-local would be
 * better still, but the tournament's zone is optional data (`localTimeZone` is
 * unset on most records — see the zone-label note in `createScheduleTable`), and
 * a guessed zone would move the boundary for the wrong viewers. Where the zone
 * *is* known the difference only shows within a few hours of midnight.
 */
export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * The "Now" strip belongs only on today's page.
 *
 * On any other date it is a category error: it pins a live-play row above a
 * grid of matches that either finished days ago or have not started, and the
 * public viewer has no desk actions to justify it (TMX keeps the strip on other
 * dates because an operator drags matchUps onto it; it gates only the auto-call
 * on `date === todayIso()`). Reading a tournament's Saturday order of play on
 * Thursday should not show a "Now" row at all.
 */
export function shouldShowActiveStrip({
  scheduledDate,
  today = todayIso(),
}: {
  scheduledDate?: string;
  today?: string;
}): boolean {
  return !!scheduledDate && scheduledDate === today;
}

export interface ScheduleSearchOutcome {
  /** matchUpIds that match the search (empty when no search is active). */
  matchedIds: Set<string>;
  /** True while a non-empty search is applied. */
  active: boolean;
  /** Number of matchUps on the current date that matched. */
  matchCount: number;
}

/**
 * Which of the date's matchUps match the search.
 *
 * The grid *dims* non-matching cells rather than removing them: a court grid is
 * a spatial statement — Court 3 at 10:00 — and dropping cells out of it would
 * shift every neighbour and destroy the very layout the viewer is scanning.
 */
export function computeScheduleSearch({
  matchUps,
  search,
}: {
  matchUps: any[];
  search?: string;
}): ScheduleSearchOutcome {
  const needle = normalizeSearch(search);
  if (!needle) return { matchedIds: new Set<string>(), active: false, matchCount: 0 };

  const matchedIds = new Set<string>();
  for (const matchUp of matchUps ?? []) {
    if (matchUp?.matchUpId && matchUpMatchesSearch(matchUp, needle)) matchedIds.add(matchUp.matchUpId);
  }
  return { matchedIds, active: true, matchCount: matchedIds.size };
}
