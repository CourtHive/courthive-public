import { describe, it, expect } from 'vitest';
import { participantSorter } from './participantSorter';

describe('participantSorter', () => {
  it('sorts by standardFamilyName when persons exist', () => {
    const a = { person: { standardFamilyName: 'Adams' } };
    const b = { person: { standardFamilyName: 'Brown' } };
    expect(participantSorter(a, b)).toBeLessThan(0);
    expect(participantSorter(b, a)).toBeGreaterThan(0);
  });

  it('handles person nested under participant', () => {
    const a = { participant: { person: { standardFamilyName: 'Zverev' } } };
    const b = { participant: { person: { standardFamilyName: 'Alcaraz' } } };
    expect(participantSorter(a, b)).toBeGreaterThan(0);
  });

  it('sorts equal family names as 0', () => {
    const a = { person: { standardFamilyName: 'Smith' } };
    const b = { person: { standardFamilyName: 'Smith' } };
    expect(participantSorter(a, b)).toBe(0);
  });

  it('falls back to participantName when no person', () => {
    const a = { participantName: 'Team Alpha' };
    const b = { participantName: 'Team Beta' };
    expect(participantSorter(a, b)).toBeLessThan(0);
    expect(participantSorter(b, a)).toBeGreaterThan(0);
  });

  it('returns 1 when only one has standardFamilyName', () => {
    const withName = { person: { standardFamilyName: 'Adams' } };
    const withoutName = { person: {} };
    expect(participantSorter(withName, withoutName)).toBe(1);
    expect(participantSorter(withoutName, withName)).toBe(1);
  });

  it('returns 1 when neither has standardFamilyName', () => {
    const a = { person: {} };
    const b = { person: {} };
    expect(participantSorter(a, b)).toBe(1);
  });

  it('returns 1 when neither has participantName', () => {
    let result: any = participantSorter({}, {});
    expect(result).toBe(1);
  });
});
