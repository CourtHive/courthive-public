type CalendarDate = { year: number; month: number; day: number };

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Parse a calendar-day string ("YYYY-MM-DD") into plain year/month/day
 * components WITHOUT constructing a `Date`.
 *
 * `new Date("2026-07-13")` parses the string as UTC midnight and is then read
 * back through the viewer's local zone, so any viewer west of UTC sees the
 * PREVIOUS calendar day (e.g. "July 13" renders as "July 12" in the Americas) —
 * the production off-by-one on the public tournament splash. Tournament
 * start/end dates are calendar days, not instants, so the timezone must never
 * enter the calculation: parse the components directly and format them as-is.
 */
function parseCalendarDate(input?: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(input ?? ''));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function dateString({ startDate, endDate }: { startDate?: string; endDate?: string }): string {
  const start = parseCalendarDate(startDate);
  const end = parseCalendarDate(endDate) ?? start;
  if (!start || !end) return '';

  const sameYear = start.year === end.year;
  const sameMonth = sameYear && start.month === end.month;
  const sameDay = sameMonth && start.day === end.day;

  const monthName = (date: CalendarDate) => monthNames[date.month - 1];
  const numeric = (date: CalendarDate) => `${date.year}/${date.month}/${date.day}`;

  if (sameDay) {
    return `${monthName(start)} ${start.day}, ${start.year}`;
  } else if (sameMonth) {
    return `${monthName(start)} ${start.day}-${end.day}, ${start.year}`;
  } else if (sameYear) {
    return `${monthName(start)} ${start.day} - ${monthName(end)} ${end.day}, ${start.year}`;
  } else {
    return `${numeric(start)} - ${numeric(end)}`;
  }
}
