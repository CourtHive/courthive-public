/**
 * Cross-render matchUp focus for the public viewer.
 *
 * Mirrors TMX's `services/dom/matchUpFocus.ts`. A matchUpId is not part of the
 * draw route, so "open this match in its draw and show me where it is" needs a
 * stash that survives the navigate → fetch → render round-trip: the Schedule tab
 * sets it, `renderEvent` consumes it once the target structure is in the DOM.
 *
 * The stash is deliberately module state rather than a query parameter: the
 * highlight is a one-shot gesture, and a reload should land on the draw without
 * re-pulsing a match the viewer has already found.
 */

const HIGHLIGHT_CLASS = 'chp-matchup-highlight';
const HIGHLIGHT_MS = 4000;

let pendingMatchUpId: string | undefined;

export function setPendingMatchUpFocus(matchUpId?: string): void {
  pendingMatchUpId = matchUpId || undefined;
}

export function peekPendingMatchUpFocus(): string | undefined {
  return pendingMatchUpId;
}

export function clearPendingMatchUpFocus(): void {
  pendingMatchUpId = undefined;
}

/**
 * Scroll the rendered matchUp into view and pulse it. Returns false when the
 * element is not in the DOM (the wrong structure or view rendered), so the
 * caller can leave the pending focus in place for a later render.
 */
export function highlightMatchUp(matchUpId: string, container?: ParentNode): boolean {
  if (!matchUpId) return false;
  const root: ParentNode = container ?? document.getElementById('flightDisplay') ?? document;
  const el = (root.querySelector(`#${CSS.escape(matchUpId)}`) ??
    root.querySelector(`[data-matchup-id="${matchUpId}"]`)) as HTMLElement | null;
  if (!el) return false;

  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  el.classList.add(HIGHLIGHT_CLASS);
  setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_MS);
  return true;
}

/**
 * Apply the pending focus, if any, to the just-rendered draw. Clears it once
 * the matchUp has been found and highlighted; leaves it in place otherwise so a
 * later render (the correct structure) can still consume it.
 */
export function consumePendingMatchUpFocus(container?: ParentNode): void {
  if (pendingMatchUpId && highlightMatchUp(pendingMatchUpId, container)) clearPendingMatchUpFocus();
}

/**
 * Test seam — exposed for vitest only.
 */
export const __test__ = { HIGHLIGHT_CLASS, HIGHLIGHT_MS };
