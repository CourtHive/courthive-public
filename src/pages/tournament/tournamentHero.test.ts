import { describe, expect, it, vi } from 'vitest';

// `tournamentHero.ts` imports its stylesheet, which vite handles but the
// no-DOM vitest runner does not. Only the pure helpers are exercised here;
// `buildTournamentHero` is DOM-bound and is covered by the Playwright suite.
vi.mock('./tournament-hero.css', () => ({}));

import {
  BANNER_MIN_WIDTH,
  BANNER_MIN_ASPECT,
  heroVariantForArtwork,
  shouldShowEyebrow,
  heroMetaItems,
} from './tournamentHero';

/** Stand-in for i18next `t` — renders the `_one`/`_other` plural forms. */
const t = (key: string, options?: Record<string, unknown>) => {
  const count = Number(options?.count ?? 0);
  const noun = key.replace(/^hero\./, '');
  const singular = noun.replace(/(ie)?s$/, (match) => (match === 'ies' ? 'y' : ''));
  return `${count} ${count === 1 ? singular : noun}`;
};

describe('heroVariantForArtwork', () => {
  it('treats the live Battle of Boca poster as a banner', () => {
    // 1659x906 — ratio 1.83, which an aspect-only rule set at 2:1 would have
    // misread as a logo mark. This is the artwork from the reported defect.
    expect(heroVariantForArtwork(1659, 906)).toBe('banner');
  });

  it('requires both the aspect and the width threshold', () => {
    // Wide enough, but too narrow in absolute terms to be poster art.
    expect(heroVariantForArtwork(BANNER_MIN_WIDTH - 1, 100)).toBe('mark');
    // Large, but too square.
    expect(heroVariantForArtwork(1600, 1200)).toBe('mark');
    // Both cleared.
    expect(heroVariantForArtwork(BANNER_MIN_WIDTH, BANNER_MIN_WIDTH / BANNER_MIN_ASPECT)).toBe('banner');
  });

  it('keeps a small wide wordmark as a logo mark', () => {
    // 300x100 is 3:1 — wider than any poster, but plainly a wordmark.
    expect(heroVariantForArtwork(300, 100)).toBe('mark');
  });

  it('treats square and portrait artwork as a logo mark', () => {
    expect(heroVariantForArtwork(800, 800)).toBe('mark');
    expect(heroVariantForArtwork(600, 1200)).toBe('mark');
  });

  it('falls back to a mark when the dimensions are unusable', () => {
    // An image that failed to decode reports naturalWidth/naturalHeight of 0.
    expect(heroVariantForArtwork(0, 0)).toBe('mark');
    expect(heroVariantForArtwork(undefined, undefined)).toBe('mark');
    expect(heroVariantForArtwork(NaN, NaN)).toBe('mark');
    expect(heroVariantForArtwork(1659, 0)).toBe('mark');
  });
});

describe('shouldShowEyebrow', () => {
  it('suppresses an organisation name already carried by the title', () => {
    expect(shouldShowEyebrow('Battle of Boca', 'Battle of Boca - August 15')).toBe(false);
  });

  it('ignores punctuation and case when comparing', () => {
    expect(shouldShowEyebrow('BATTLE OF BOCA!', 'Battle of Boca — August 15')).toBe(false);
  });

  it('shows an organisation that adds information', () => {
    expect(shouldShowEyebrow('Intercollegiate Tennis Association', 'Fall Regional Championships')).toBe(true);
  });

  it('shows nothing when there is no organisation', () => {
    expect(shouldShowEyebrow(undefined, 'Fall Regional')).toBe(false);
    expect(shouldShowEyebrow('', 'Fall Regional')).toBe(false);
  });

  it('shows the organisation when the tournament is unnamed', () => {
    expect(shouldShowEyebrow('Boca Raton Tennis', undefined)).toBe(true);
  });
});

describe('heroMetaItems', () => {
  const DATES = 'August 15-19, 2026';
  const VENUE = 'Rick Macci Tennis Academy';
  const ENTRIES = '139 entries';

  const tournamentInfo = {
    startDate: '2026-08-15',
    endDate: '2026-08-19',
    venues: [{ venueName: VENUE }],
    eventInfo: [
      { eventName: "Men's Singles", entriesCount: 54 },
      { eventName: "Women's Singles", entriesCount: 71 },
      { eventName: "Men's Doubles", entriesCount: 7 },
      { eventName: "Women's Doubles", entriesCount: 7 },
    ],
  };

  it('builds dates, venue, events and entries in priority order', () => {
    expect(heroMetaItems(tournamentInfo, t)).toEqual([DATES, VENUE, '4 events', ENTRIES]);
  });

  it('counts entries rather than players', () => {
    // 54+71+7+7 sums per-event entries; a competitor in singles AND doubles is
    // two entries, so this must never be labelled a player count.
    const [, , , entries] = heroMetaItems(tournamentInfo, t);
    expect(entries).toBe(ENTRIES);
  });

  it('names up to two venues and counts beyond that', () => {
    const twoVenues = { ...tournamentInfo, venues: [{ venueName: 'North Club' }, { venueName: 'South Club' }] };
    expect(heroMetaItems(twoVenues, t)[1]).toBe('North Club & South Club');

    const threeVenues = { ...tournamentInfo, venues: [...twoVenues.venues, { venueName: 'East Club' }] };
    expect(heroMetaItems(threeVenues, t)[1]).toBe('3 venues');
  });

  it('omits every item it has no data for', () => {
    expect(heroMetaItems({}, t)).toEqual([]);
    expect(heroMetaItems(undefined, t)).toEqual([]);
  });

  it('omits an entries item when events report no entries', () => {
    const noEntries = { ...tournamentInfo, eventInfo: [{ eventName: "Men's Singles" }] };
    expect(heroMetaItems(noEntries, t)).toEqual([DATES, VENUE, '1 event']);
  });

  it('skips venues that carry no name', () => {
    const unnamed = { ...tournamentInfo, venues: [{ venueId: 'abc' }] };
    expect(heroMetaItems(unnamed, t)).toEqual([DATES, '4 events', ENTRIES]);
  });
});
