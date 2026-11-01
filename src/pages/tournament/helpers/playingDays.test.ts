import { eventPlayingDates, formatPlayingDays, heroPlayingDayItems, playingDaysText } from './playingDays';
import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { describe, expect, it } from 'vitest';

/** Stand-in for i18next `t`, interpolating the en.json strings this module uses. */
const strings: Record<string, string> = {
  'events.plays': 'Plays: {{days}}',
  'events.playsNone': 'No playing days',
  'events.eventPlays': '{{eventName}}: {{days}}',
};
const t = (key: string, options?: Record<string, unknown>) =>
  (strings[key] ?? key).replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? ''));

const WEEKEND = 'Weekend Singles';
const OPEN = 'Open Singles';
const EN = 'en';
const START_DATE = '2026-11-09';
const END_DATE = '2026-11-15';

/** Published tournament info from the real engine, as the public site receives it. */
function publishedTournamentInfo(weekdays: any[]) {
  const { tournamentRecord } = mocksEngine.generateTournamentRecord({
    // 2026-11-09 is a Monday; the tournament runs Monday to Sunday.
    startDate: START_DATE,
    endDate: END_DATE,
    eventProfiles: [
      { eventName: WEEKEND, drawProfiles: [{ drawSize: 4 }] },
      { eventName: OPEN, drawProfiles: [{ drawSize: 4 }] },
    ],
    setState: true,
  });
  const weekend = tournamentRecord.events.find((event: any) => event.eventName === WEEKEND);
  const result: any = tournamentEngine.setEventDates({ eventId: weekend.eventId, weekdays });
  expect(result.success).toBe(true);
  for (const event of tournamentRecord.events) tournamentEngine.publishEvent({ eventId: event.eventId });
  return tournamentEngine.getTournamentInfo({ usePublishState: true, withVenueData: true }).tournamentInfo;
}

describe('event playing days (real engine payload)', () => {
  it('shows the playing days of a narrowed event and nothing for an event playing every day', () => {
    const tournamentInfo = publishedTournamentInfo(['FRI', 'SUN']);
    const weekend = tournamentInfo.eventInfo.find((event: any) => event.eventName === WEEKEND);
    const open = tournamentInfo.eventInfo.find((event: any) => event.eventName === OPEN);

    expect(eventPlayingDates(weekend)).toEqual(['2026-11-13', END_DATE]);
    expect(playingDaysText(weekend, t, EN)).toBe('Plays: Fri 13 · Sun 15');
    expect(eventPlayingDates(open)).toBeUndefined();
    expect(playingDaysText(open, t, EN)).toBeUndefined();

    expect(heroPlayingDayItems(tournamentInfo, t, EN)).toEqual([`${WEEKEND}: Fri 13 · Sun 15`]);
  });

  it('adds nothing to the hero when no event is narrowed', () => {
    const { tournamentRecord } = mocksEngine.generateTournamentRecord({
      startDate: START_DATE,
      endDate: END_DATE,
      eventProfiles: [{ eventName: OPEN, drawProfiles: [{ drawSize: 4 }] }],
      setState: true,
    });
    for (const event of tournamentRecord.events) tournamentEngine.publishEvent({ eventId: event.eventId });
    const { tournamentInfo } = tournamentEngine.getTournamentInfo({ usePublishState: true });
    expect(heroPlayingDayItems(tournamentInfo, t, EN)).toEqual([]);
  });
});

describe('formatPlayingDays', () => {
  it('adds the month when the days span more than one month', () => {
    expect(formatPlayingDays(['2026-10-31', '2026-11-01'], EN)).toBe('Sat 31 Oct · Sun 1 Nov');
  });

  it('never moves a day: the weekday comes from the calendar day itself, not the viewer zone', () => {
    // vitest runs under TZ=UTC; the formatter pins UTC, so a western zone cannot shift it either.
    expect(formatPlayingDays([END_DATE], EN)).toBe('Sun 15');
  });

  it('ignores values that are not calendar days and falls back for an unknown locale', () => {
    expect(eventPlayingDates({ playingDates: [END_DATE, 'nope'] })).toEqual([END_DATE]);
    expect(formatPlayingDays([END_DATE], 'not a locale!')).toBe('Sun 15');
  });

  it('says so when an event has no playing days', () => {
    expect(playingDaysText({ eventName: 'X', playingDates: [] }, t)).toBe('No playing days');
    expect(heroPlayingDayItems({ eventInfo: [{ eventName: 'X', playingDates: [] }] }, t)).toEqual([
      'X: No playing days',
    ]);
  });
});
