import { describe, expect, it, vi } from 'vitest';

vi.mock('../renderRegistrationProfile.css', () => ({}));

import { renderRegistrationProfile, __test__ } from '../renderRegistrationProfile';

const { formatDate, formatFee, T } = __test__;

const echo = (key: string) => key;

/** A mid-month calendar day: far enough from either boundary that only a real zone shift moves it. */
const MID_MAY = '2026-05-15';

describe('formatDate', () => {
  it('returns empty string when value is undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('falls back to the raw value when not a parseable date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('renders a date-only ISO string without a time component', () => {
    const out = formatDate(MID_MAY);
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toMatch(/:\d{2}/);
  });

  /**
   * The prod bug: `new Date("2026-05-15")` parses as UTC **midnight** and reads
   * back in the viewer's zone, so everyone west of Greenwich saw May 14 — entry
   * and withdrawal deadlines a day early, for this site's main audience.
   *
   * The two assertions above could not see it. They check the length and the
   * absence of a colon, never WHICH DAY, and the suite runs `TZ=UTC` where the
   * broken and fixed implementations are identical. Both had to change to make
   * the bug expressible.
   */
  it('renders the exact calendar day — not the day before, west of UTC', () => {
    expect(formatDate(MID_MAY)).toContain('15');
    expect(formatDate(MID_MAY)).not.toContain('14');
    expect(formatDate('2026-01-01')).toContain('2026');
    // A year boundary is where the off-by-one is loudest: UTC midnight on Jan 1
    // is Dec 31 of the PREVIOUS year in the Americas.
    expect(formatDate('2026-01-01')).not.toContain('2025');
  });

  it('is timezone-independent for calendar days — never constructs a Date', () => {
    // Same guard `dateString.test.ts` uses, and for the same reason: stubbing
    // Date to throw fails a regression to any Date-based parse regardless of the
    // test TZ, which a value assertion under `TZ=UTC` cannot do.
    const OriginalDate = globalThis.Date;
    try {
      // @ts-expect-error — intentionally replacing Date for the duration of the test
      globalThis.Date = class {
        constructor() {
          throw new Error('formatDate must not construct a Date for a calendar day');
        }
      };
      expect(formatDate(MID_MAY)).toContain('15');
    } finally {
      globalThis.Date = OriginalDate;
    }
  });

  it('includes a time component when the input has one', () => {
    const out = formatDate('2026-05-15T14:30');
    expect(out).toMatch(/\d/);
  });
});

// `unit` states whether an amount is in the currency's smallest unit or whole units. Both fixtures
// below now state it; without it the amount cannot be placed on a scale at all, which the third
// test asserts.
describe('formatFee', () => {
  it('formats a USD amount using Intl', () => {
    const out = formatFee({ amount: 75, currencyCode: 'USD', unit: 'MAJOR' });
    expect(out).toContain('75');
    expect(out).toMatch(/\$|USD/);
  });

  it('falls back to plain string when currencyCode is invalid', () => {
    const out = formatFee({ amount: 50, currencyCode: 'INVALID_CODE_XYZ', unit: 'MAJOR' });
    expect(out).toContain('50');
    expect(out).toContain('INVALID_CODE_XYZ');
  });

  it('renders minor units at the right scale', () => {
    // The 100x bug: 6000 minor units is $60.00, and used to render as "$6,000.00".
    const out = formatFee({ amount: 6000, currencyCode: 'USD', unit: 'MINOR' });
    expect(out).toContain('60');
    expect(out).not.toContain('6,000');
  });

  it('declines to render a fee whose scale is unstated', () => {
    expect(formatFee({ amount: 6000, currencyCode: 'USD' })).toBe('Fee on request');
  });
});

describe('T (translation fallback)', () => {
  it('returns the fallback when the key is unknown (echo translator)', () => {
    expect(T(echo, 'unknown.key', 'Default text')).toBe('Default text');
  });

  it('returns the translation when one exists', () => {
    const translator = (key: string) => (key === 'foo.bar' ? 'Translated' : key);
    expect(T(translator, 'foo.bar', 'Fallback')).toBe('Translated');
  });
});

describe('renderRegistrationProfile (no-DOM cases)', () => {
  it('returns null when profile is undefined', () => {
    expect(renderRegistrationProfile(undefined, echo)).toBeNull();
  });
});
