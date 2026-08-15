import { describe, expect, it, vi } from 'vitest';

// courthive-components touches `document` at import time, and the stylesheet
// import is vite-only — both mocked for this repo's no-DOM vitest runner.
// `renderVenues` itself is DOM-bound and is covered by the Playwright suite.
vi.mock('./renderVenues.css', () => ({}));
vi.mock('courthive-components', () => ({
  buildVenueCard: vi.fn(),
  mapVenueToCardData: vi.fn(),
  // Mirrors the real helper: competitionFormat.sport, else matchUpFormat.
  resolveCourtSport: (event: any) => {
    const sport = event?.competitionFormat?.sport;
    if (sport === 'PICKLEBALL') return 'pickleball';
    if (sport === 'PADEL') return 'padel';
    if (sport === 'TENNIS') return 'tennis';
    if (typeof event?.matchUpFormat === 'string' && event.matchUpFormat.startsWith('SET')) return 'tennis';
    return undefined;
  },
}));

import { resolveVenueSport } from './renderVenues';

describe('resolveVenueSport', () => {
  it('reads the sport from a competition format when one is published', () => {
    expect(resolveVenueSport([{ competitionFormat: { sport: 'PICKLEBALL' } }])).toBe('pickleball');
    expect(resolveVenueSport([{ competitionFormat: { sport: 'PADEL' } }])).toBe('padel');
  });

  it('falls back to the matchUpFormat when there is no competition format', () => {
    expect(resolveVenueSport([{ matchUpFormat: 'SET3-S:6/TB7' }])).toBe('tennis');
  });

  it('takes the first event that resolves, skipping ones that do not', () => {
    const eventInfo = [{ eventName: 'no format data' }, { competitionFormat: { sport: 'PICKLEBALL' } }];
    expect(resolveVenueSport(eventInfo)).toBe('pickleball');
  });

  it('defaults to tennis when no event carries format data', () => {
    // The live public `eventInfo` projection carries neither
    // `competitionFormat` nor `matchUpFormat`, so this is the production path.
    expect(resolveVenueSport([{ eventName: "Men's Singles", entriesCount: 54 }])).toBe('tennis');
  });

  it('defaults to tennis for missing or empty event data', () => {
    expect(resolveVenueSport(undefined)).toBe('tennis');
    expect(resolveVenueSport([])).toBe('tennis');
  });
});
