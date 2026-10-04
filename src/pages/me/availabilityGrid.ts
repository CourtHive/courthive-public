/**
 * Pure helpers for the /me availability grid — span/week layout, the 4-state
 * day-toggle cycle, and payload assembly. Kept free of the DOM so they can be
 * unit-tested deterministically (all take an explicit reference date).
 */
import { DayState, AvailabilityPayload } from 'src/services/declarationsApi';

export const DAY_STATE_CYCLE: (DayState | undefined)[] = [undefined, 'AVAILABLE', 'IF_NEEDED', 'UNAVAILABLE'];

const DAYS_PER_WEEK = 7;

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Rolling span starting at `today` (inclusive) for `weeks` full weeks. */
export function buildSpan(today: Date, weeks = 4): { from: string; to: string } {
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + weeks * DAYS_PER_WEEK - 1);
  return { from: toISODate(from), to: toISODate(to) };
}

/** Inclusive list of 'YYYY-MM-DD' between from and to. */
export function enumerateSpanDates(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toISODate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Chunk a flat date list into calendar-ordered weeks of 7. */
export function groupIntoWeeks(dates: string[]): string[][] {
  const weeks: string[][] = [];
  for (let i = 0; i < dates.length; i += DAYS_PER_WEEK) {
    weeks.push(dates.slice(i, i + DAYS_PER_WEEK));
  }
  return weeks;
}

/** Advance a day through NOT_SET → AVAILABLE → IF_NEEDED → UNAVAILABLE → NOT_SET. */
export function cycleDayState(current: DayState | undefined): DayState | undefined {
  const index = DAY_STATE_CYCLE.indexOf(current ?? undefined);
  const next = DAY_STATE_CYCLE[(index + 1) % DAY_STATE_CYCLE.length];
  return next;
}

/**
 * Assemble the payload from the current day-state map. Only explicitly-set days
 * (the three positive states) are written; NOT_SET days are omitted so the map
 * stays sparse (absent = NOT_SET), matching the service/factory contract.
 */
export function buildAvailabilityPayload(
  span: { from: string; to: string },
  dayStates: Record<string, DayState | undefined>,
): AvailabilityPayload {
  const days: { [date: string]: DayState } = {};
  for (const [date, state] of Object.entries(dayStates)) {
    if (state) days[date] = state;
  }
  return { span, days };
}
