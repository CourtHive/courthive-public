import { describe, expect, it, vi } from 'vitest';

// Stylesheet import — vite resolves it, this repo's no-DOM vitest runner does
// not. `buildRosterGrid` is DOM-bound and is covered by the Playwright suite.
vi.mock('./rosterGrid.css', () => ({}));

import { GENDER_ORDER, groupByGender } from './rosterGrid';

const FEMALE = 'FEMALE';
const MALE = 'MALE';
const UNSPECIFIED = 'UNSPECIFIED';

const AGNEW = 'Kate Agnew';
const ALMALEH = 'Isaak Almaleh';

const entry = (name: string, sex?: string) => ({ name, sex });

describe('groupByGender', () => {
  it('splits a mixed field into sections, women first', () => {
    const sections = groupByGender([entry(ALMALEH, MALE), entry(AGNEW, FEMALE), entry('Yanni Anagnostopoulos', MALE)]);
    expect(sections.map((section) => section.key)).toEqual([FEMALE, MALE]);
    expect(sections[0].entries.map((e) => e.name)).toEqual([AGNEW]);
    expect(sections[1].entries.map((e) => e.name)).toEqual([ALMALEH, 'Yanni Anagnostopoulos']);
  });

  it('preserves the incoming order within a section', () => {
    // The caller has already sorted by family name; grouping must not reshuffle.
    const sections = groupByGender([entry('Aga', FEMALE), entry('Agnew', FEMALE), entry('Angus', FEMALE)]);
    expect(sections[0].entries.map((e) => e.name)).toEqual(['Aga', 'Agnew', 'Angus']);
  });

  it('collapses to one unlabelled section when everyone is the same gender', () => {
    // A women-only event should not render every name under a lone "Women"
    // heading that tells the reader nothing.
    const sections = groupByGender([entry(AGNEW, FEMALE), entry('Anya Aga', FEMALE)]);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('ALL');
    expect(sections[0].entries).toHaveLength(2);
  });

  it('collapses to one unlabelled section when nobody published a sex', () => {
    const sections = groupByGender([entry('A Player'), entry('B Player')]);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('ALL');
  });

  it('sorts participants with no sex into a trailing Unspecified section', () => {
    const sections = groupByGender([entry('No Sex'), entry(AGNEW, FEMALE), entry(ALMALEH, MALE)]);
    expect(sections.map((section) => section.key)).toEqual([FEMALE, MALE, UNSPECIFIED]);
    expect(sections[sections.length - 1].entries.map((e) => e.name)).toEqual(['No Sex']);
  });

  it('normalizes case and unrecognised values', () => {
    const sections = groupByGender([entry('a', 'female'), entry('b', ' Male '), entry('c', 'X')]);
    expect(sections.map((section) => section.key)).toEqual([FEMALE, MALE, UNSPECIFIED]);
    expect(sections[2].entries.map((e) => e.name)).toEqual(['c']);
  });

  it('returns nothing for an empty roster', () => {
    expect(groupByGender([])).toEqual([]);
  });

  it('declares Unspecified last in the section order', () => {
    expect(GENDER_ORDER[GENDER_ORDER.length - 1]).toBe(UNSPECIFIED);
  });
});
