import { parseCalendarDate } from './dateString';

type TFunction = (key: string, options?: Record<string, unknown>) => string;

/**
 * An event's playing days, as the factory publishes them: `eventInfo.playingDates` is present only
 * when the event's own dates narrow the tournament's. Absent means the event plays every tournament
 * day, which the tournament's own date range already says, so nothing is shown.
 */
export function eventPlayingDates(eventInfo: any): string[] | undefined {
  const playingDates = eventInfo?.playingDates;
  return Array.isArray(playingDates) ? playingDates.filter((date) => !!parseCalendarDate(date)) : undefined;
}

/**
 * "Fri 13 · Sun 15", or "Sat 31 Oct · Sun 1 Nov" when the days span more than one month. Weekday and
 * month names follow `locale`; the order is fixed so the line reads the same in every language.
 *
 * The weekday is computed from the calendar day's own components at UTC noon and formatted in UTC,
 * so the viewer's time zone never moves a day (the off-by-one `parseCalendarDate` exists to avoid).
 */
export function formatPlayingDays(playingDates: string[], locale?: string): string {
  const days = playingDates.map(parseCalendarDate).filter(Boolean);
  if (!days.length) return '';
  const withMonth = new Set(days.map(({ year, month }) => `${year}-${month}`)).size > 1;
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', timeZone: 'UTC' };
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat(locale, options);
  } catch {
    format = new Intl.DateTimeFormat('en', options);
  }
  return days
    .map(({ year, month, day }) => {
      const parts = format.formatToParts(new Date(Date.UTC(year, month - 1, day, 12)));
      const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
      return [part('weekday'), String(day), withMonth ? part('month') : ''].filter(Boolean).join(' ');
    })
    .join(' · ');
}

/**
 * The line shown for one event: "Plays: Fri 13 · Sun 15", "No playing days" when the event's dates
 * leave it none, or `undefined` when the event plays every tournament day.
 */
export function playingDaysText(eventInfo: any, t: TFunction, locale?: string): string | undefined {
  const playingDates = eventPlayingDates(eventInfo);
  if (!playingDates) return undefined;
  if (!playingDates.length) return t('events.playsNone');
  return t('events.plays', { days: formatPlayingDays(playingDates, locale) });
}

/**
 * The hero's per-event playing days: one "Event name: Fri 13 · Sun 15" entry for each event whose
 * days are narrower than the tournament's. Events playing every day add nothing.
 */
export function heroPlayingDayItems(tournamentInfo: any, t: TFunction, locale?: string): string[] {
  const items: string[] = [];
  for (const eventInfo of tournamentInfo?.eventInfo ?? []) {
    const playingDates = eventPlayingDates(eventInfo);
    if (!playingDates) continue;
    const days = playingDates.length ? formatPlayingDays(playingDates, locale) : t('events.playsNone');
    items.push(t('events.eventPlays', { eventName: eventInfo.eventName ?? '', days }));
  }
  return items;
}
