import { describe, expect, it } from 'vitest';

import {
  buildAvailabilityPayload,
  buildSpan,
  cycleDayState,
  enumerateSpanDates,
  groupIntoWeeks,
} from './availabilityGrid';

const SPAN_FROM = '2026-08-10';
const SPAN_TO = '2026-09-06';
const UNAVAILABLE = 'UNAVAILABLE';

describe('availabilityGrid', () => {
  it('buildSpan spans 4 inclusive weeks from the reference day', () => {
    expect(buildSpan(new Date('2026-08-10T12:00:00Z'))).toEqual({ from: SPAN_FROM, to: SPAN_TO });
  });

  it('enumerateSpanDates is inclusive and groupIntoWeeks chunks by 7', () => {
    const dates = enumerateSpanDates(SPAN_FROM, SPAN_TO);
    expect(dates.length).toBe(28);
    expect(dates[0]).toBe(SPAN_FROM);
    expect(dates[dates.length - 1]).toBe(SPAN_TO);

    const weeks = groupIntoWeeks(dates);
    expect(weeks.length).toBe(4);
    expect(weeks[0].length).toBe(7);
  });

  it('enumerateSpanDates rejects reversed / invalid ranges', () => {
    expect(enumerateSpanDates('2026-08-12', SPAN_FROM)).toEqual([]);
    expect(enumerateSpanDates('bad', SPAN_FROM)).toEqual([]);
  });

  it('cycleDayState rotates NOT_SET → AVAILABLE → IF_NEEDED → UNAVAILABLE → NOT_SET', () => {
    expect(cycleDayState(undefined)).toBe('AVAILABLE');
    expect(cycleDayState('AVAILABLE')).toBe('IF_NEEDED');
    expect(cycleDayState('IF_NEEDED')).toBe(UNAVAILABLE);
    expect(cycleDayState(UNAVAILABLE)).toBeUndefined();
  });

  it('buildAvailabilityPayload keeps only explicitly-set days (sparse map)', () => {
    const payload = buildAvailabilityPayload(
      { from: SPAN_FROM, to: '2026-08-16' },
      { '2026-08-11': UNAVAILABLE, '2026-08-12': undefined },
    );
    expect(payload).toEqual({ span: { from: SPAN_FROM, to: '2026-08-16' }, days: { '2026-08-11': UNAVAILABLE } });
  });
});
