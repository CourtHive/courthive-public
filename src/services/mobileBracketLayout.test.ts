import { describe, expect, it, vi } from 'vitest';

// courthive-components touches `document` at module-import time. Mock it so
// this test can run in courthive-public's no-DOM vitest environment. The
// helper under test only imports DOM types from the shipped package
// indirectly (via TypeScript), but the bare-import path doesn't currently
// trigger any side-effects we need to load.
vi.mock('courthive-components', () => ({}));

import { __test__ } from './mobileBracketLayout';

const { resolveRoundLabel, MOBILE_QUERY, SNAP_CLASS, STACK_CLASS, TOGGLE_ACTIVE_CLASS } = __test__;

function buildContainer(headerText?: string): any {
  // Minimal stand-in for an HTMLElement.querySelector. Returns the same
  // header object regardless of selector so the helper's lookup matches.
  return {
    querySelector: () =>
      headerText
        ? { textContent: headerText }
        : null,
  };
}

describe('resolveRoundLabel', () => {
  it('prefers the existing round-header text content', () => {
    const container = buildContainer('  Round of 16  ');
    expect(resolveRoundLabel(container, 0, 4)).toBe('Round of 16');
  });

  it('falls back to F / SF / QF for the last three rounds in larger draws', () => {
    expect(resolveRoundLabel(buildContainer(), 4, 5)).toBe('F');
    expect(resolveRoundLabel(buildContainer(), 3, 5)).toBe('SF');
    expect(resolveRoundLabel(buildContainer(), 2, 5)).toBe('QF');
  });

  it('falls back to R{n} for early rounds', () => {
    expect(resolveRoundLabel(buildContainer(), 0, 5)).toBe('R1');
    expect(resolveRoundLabel(buildContainer(), 1, 5)).toBe('R2');
  });

  it('does not promote the QF / SF / F shorthand for tiny draws', () => {
    // Two-round bracket: should be R1 / R2, not SF / F (the shorthand only
    // helps when there are 3+ rounds and the user can mistake "R2" for
    // a quarterfinal).
    expect(resolveRoundLabel(buildContainer(), 0, 2)).toBe('R1');
    expect(resolveRoundLabel(buildContainer(), 1, 2)).toBe('R2');
  });

  it('treats an empty-text header as no header (uses fallback)', () => {
    const container = buildContainer('   ');
    expect(resolveRoundLabel(container, 0, 4)).toBe('R1');
  });
});

describe('module constants', () => {
  it('matches the CSS breakpoint', () => {
    expect(MOBILE_QUERY).toBe('(max-width: 768px)');
  });

  it('exposes the modifier class names CSS depends on', () => {
    expect(SNAP_CLASS).toBe('chp-mobile-bracket--snap');
    expect(STACK_CLASS).toBe('chp-mobile-bracket--stack');
    expect(TOGGLE_ACTIVE_CLASS).toBe('chp-round-nav__toggle--active');
  });
});
