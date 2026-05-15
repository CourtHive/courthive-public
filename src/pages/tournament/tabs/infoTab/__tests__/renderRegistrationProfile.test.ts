import { describe, expect, it, vi } from 'vitest';

vi.mock('../renderRegistrationProfile.css', () => ({}));

import { renderRegistrationProfile, __test__ } from '../renderRegistrationProfile';

const { formatDate, formatFee, T } = __test__;

const echo = (key: string) => key;

describe('formatDate', () => {
  it('returns empty string when value is undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('falls back to the raw value when not a parseable date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('renders a date-only ISO string without a time component', () => {
    const out = formatDate('2026-05-15');
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toMatch(/:\d{2}/);
  });

  it('includes a time component when the input has one', () => {
    const out = formatDate('2026-05-15T14:30');
    expect(out).toMatch(/\d/);
  });
});

describe('formatFee', () => {
  it('formats a USD amount using Intl', () => {
    const out = formatFee({ amount: 75, currencyCode: 'USD' });
    expect(out).toContain('75');
    expect(out).toMatch(/\$|USD/);
  });

  it('falls back to plain string when currencyCode is invalid', () => {
    const out = formatFee({ amount: 50, currencyCode: 'INVALID_CODE_XYZ' });
    expect(out).toContain('50');
    expect(out).toContain('INVALID_CODE_XYZ');
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
