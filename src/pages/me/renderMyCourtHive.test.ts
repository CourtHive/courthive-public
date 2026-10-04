/**
 * Tests for the personUpdate guard in renderMyCourtHive. The full DOM
 * render path is exercised by Playwright (out of band); here we lock
 * in the gating logic that prevents the re-render storm + listener leak
 * documented in the 2026-05-31 design-flaws punch list.
 */
import { describe, expect, it, vi } from 'vitest';

// courthive-components touches `document` at module-import time; mock
// to keep this test in the node-only vitest env. Same shape as
// services/mobileBracketLayout.test.ts.
vi.mock('courthive-components', () => ({}));

import { __shouldProcessMergedEvent } from './renderMyCourtHive';

function makeContainer(isConnected: boolean): HTMLElement {
  return { isConnected } as unknown as HTMLElement;
}

describe('__shouldProcessMergedEvent', () => {
  it('returns true when the container is connected and no refresh is in flight', () => {
    expect(__shouldProcessMergedEvent(makeContainer(true), false)).toBe(true);
  });

  it('returns false when the container has been detached (user navigated away from /me)', () => {
    expect(__shouldProcessMergedEvent(makeContainer(false), false)).toBe(false);
  });

  it('returns false when an identity refresh is already in flight (storm guard)', () => {
    expect(__shouldProcessMergedEvent(makeContainer(true), true)).toBe(false);
  });

  it('returns false when both gates fail — detach takes precedence over in-flight', () => {
    // Independent of the in-flight bit; a detached container always
    // short-circuits so the caller can unsubscribe lazily.
    expect(__shouldProcessMergedEvent(makeContainer(false), true)).toBe(false);
  });
});
