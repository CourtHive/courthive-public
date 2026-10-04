import { describe, it, expect } from 'vitest';
import { dateString } from './dateString';

describe('dateString', () => {
  it('formats same day', () => {
    let result: any = dateString({ startDate: '2025-03-15', endDate: '2025-03-15' });
    expect(result).toBe('March 15, 2025');
  });

  it('formats same month different days', () => {
    let result: any = dateString({ startDate: '2025-06-10', endDate: '2025-06-15' });
    expect(result).toBe('June 10-15, 2025');
  });

  it('formats same year different months', () => {
    let result: any = dateString({ startDate: '2025-06-28', endDate: '2025-07-04' });
    expect(result).toBe('June 28 - July 4, 2025');
  });

  it('formats different years', () => {
    let result: any = dateString({ startDate: '2025-12-28', endDate: '2026-01-04' });
    expect(result).toBe('2025/12/28 - 2026/1/4');
  });

  it('handles January (month index 0)', () => {
    let result: any = dateString({ startDate: '2025-01-01', endDate: '2025-01-01' });
    expect(result).toBe('January 1, 2025');
  });

  it('handles December (month index 11)', () => {
    let result: any = dateString({ startDate: '2025-12-25', endDate: '2025-12-31' });
    expect(result).toBe('December 25-31, 2025');
  });

  it('renders the exact calendar days (prod repro: Jul 13-14, not 12-13)', () => {
    let result: any = dateString({ startDate: '2026-07-13', endDate: '2026-07-14' });
    expect(result).toBe('July 13-14, 2026');
  });

  it('is timezone-independent — never constructs a Date (guards the UTC-midnight regression)', () => {
    // The bug was `new Date("YYYY-MM-DD")` (UTC midnight) read back in the
    // viewer's local zone, shifting the day west of UTC. Stub Date to throw so a
    // regression to any Date-based parse fails here regardless of the test TZ.
    const OriginalDate = globalThis.Date;
    // @ts-expect-error — intentionally replacing Date for the duration of the test
    globalThis.Date = class {
      constructor() {
        throw new Error('dateString must not construct a Date (calendar days are timezone-independent)');
      }
    };
    try {
      let result: any = dateString({ startDate: '2026-07-13', endDate: '2026-07-14' });
      expect(result).toBe('July 13-14, 2026');
    } finally {
      globalThis.Date = OriginalDate;
    }
  });

  it('returns empty string for missing/malformed input', () => {
    expect(dateString({ startDate: undefined, endDate: undefined } as any)).toBe('');
    expect(dateString({ startDate: 'not-a-date', endDate: 'x' } as any)).toBe('');
  });
});
