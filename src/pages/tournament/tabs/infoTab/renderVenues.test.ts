import { describe, expect, it, vi } from 'vitest';

// courthive-components touches `document` at import time, and the stylesheet
// import is vite-only — both mocked for this repo's no-DOM vitest runner.
// `renderVenues` itself is DOM-bound and is covered by the Playwright suite.
vi.mock('./renderVenues.css', () => ({}));
// Mirrors the real helpers' behaviour closely enough to exercise precedence.
// `vi.hoisted` because `vi.mock` factories are lifted above top-level consts.
const { sportFromMatchUpFormat } = vi.hoisted(() => ({
  sportFromMatchUpFormat: (matchUpFormat?: string) => {
    if (typeof matchUpFormat !== 'string') return undefined;
    if (matchUpFormat.startsWith('SET') || matchUpFormat.startsWith('T')) {
      return matchUpFormat.includes('@RALLY') ? 'pickleball' : 'tennis';
    }
    if (matchUpFormat.startsWith('HAL')) return 'basketball';
    return undefined;
  },
}));

vi.mock('courthive-components', () => ({
  buildVenueCard: vi.fn(),
  mapVenueToCardData: vi.fn(),
  sportFromMatchUpFormat,
  // Mirrors the real helper: competitionFormat.sport, else matchUpFormat.
  resolveCourtSport: (event: any) => {
    const sport = event?.competitionFormat?.sport;
    if (sport === 'PICKLEBALL') return 'pickleball';
    if (sport === 'PADEL') return 'padel';
    if (sport === 'TENNIS') return 'tennis';
    return sportFromMatchUpFormat(event?.matchUpFormat);
  },
}));

import { resolveVenueSport } from './renderVenues';

const TENNIS_FORMAT = 'SET3-S:6/TB7';
const RALLY_FORMAT = 'SET3-S:11@RALLY';

describe('resolveVenueSport', () => {
  it('reads the sport from a competition format when one is published', () => {
    expect(resolveVenueSport([{ competitionFormat: { sport: 'PICKLEBALL' } }])).toBe('pickleball');
    expect(resolveVenueSport([{ competitionFormat: { sport: 'PADEL' } }])).toBe('padel');
  });

  it('falls back to the matchUpFormat when there is no competition format', () => {
    expect(resolveVenueSport([{ matchUpFormat: TENNIS_FORMAT }])).toBe('tennis');
  });

  it('takes the first event that resolves, skipping ones that do not', () => {
    const eventInfo = [{ eventName: 'no format data' }, { competitionFormat: { sport: 'PICKLEBALL' } }];
    expect(resolveVenueSport(eventInfo)).toBe('pickleball');
  });

  it('surveys matchUpFormats when the event declares no format of its own', () => {
    // The shape factory #4615 emits: nothing on the event, the code found on a
    // drawDefinition. This is the production path for the tournament surveyed.
    expect(resolveVenueSport([{ eventName: "Men's Singles", matchUpFormats: [TENNIS_FORMAT] }])).toBe('tennis');
    expect(resolveVenueSport([{ matchUpFormats: [RALLY_FORMAT] }])).toBe('pickleball');
  });

  it('lets a declared format outrank a surveyed one', () => {
    // matchUpFormats is a survey, not a resolution — a code found somewhere
    // inside the event must never override what the event declares for itself.
    const eventInfo = [{ competitionFormat: { sport: 'PADEL' }, matchUpFormats: [RALLY_FORMAT] }];
    expect(resolveVenueSport(eventInfo)).toBe('padel');

    const byEventFormat = [{ matchUpFormat: TENNIS_FORMAT, matchUpFormats: [RALLY_FORMAT] }];
    expect(resolveVenueSport(byEventFormat)).toBe('tennis');
  });

  it('prefers any declared format over an earlier event that only has a survey', () => {
    // The declared pass sweeps every event before the survey pass begins.
    const eventInfo = [{ matchUpFormats: [RALLY_FORMAT] }, { competitionFormat: { sport: 'TENNIS' } }];
    expect(resolveVenueSport(eventInfo)).toBe('tennis');
  });

  it('skips survey codes it cannot map and keeps looking', () => {
    const eventInfo = [{ matchUpFormats: ['NONSENSE', RALLY_FORMAT] }];
    expect(resolveVenueSport(eventInfo)).toBe('pickleball');
  });

  it('defaults to tennis when no event carries format data', () => {
    // Pre-#4615 payloads carry neither competitionFormat, matchUpFormat, nor
    // matchUpFormats — so this stays the behaviour until the factory publishes.
    expect(resolveVenueSport([{ eventName: "Men's Singles", entriesCount: 54 }])).toBe('tennis');
    expect(resolveVenueSport([{ matchUpFormats: [] }])).toBe('tennis');
    expect(resolveVenueSport([{ matchUpFormats: ['NONSENSE'] }])).toBe('tennis');
  });

  it('defaults to tennis for missing or empty event data', () => {
    expect(resolveVenueSport(undefined)).toBe('tennis');
    expect(resolveVenueSport([])).toBe('tennis');
  });
});
