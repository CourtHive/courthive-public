/**
 * Room for a bracket with more rounds than the page container fits.
 *
 * The tournament page is held to the container width (1344px at most), so on a
 * wide screen a 64- or 128-draw is squeezed — schedule headers truncate and the
 * last round scrolls — while the sides of the screen sit empty. Recording the
 * number of round columns on screen lets `.section.is-fluid` (layout.css) widen
 * past the container, centred, by what those rounds need. A draw that already
 * fits does not move, and choosing a later starting round with the round chips
 * shrinks the section back.
 *
 * The per-round pitch in layout.css is an estimate: a column's natural width
 * depends on the composition and the fonts. Whatever the bracket still
 * overflows once the estimate is applied is measured and added on top.
 */

export const BRACKET_ROUNDS_PROPERTY = '--chp-bracket-rounds';
export const BRACKET_OVERFLOW_PROPERTY = '--chp-bracket-overflow';

export function fitBracketWidth(flightDisplay: HTMLElement): void {
  const section = flightDisplay.closest<HTMLElement>('.section.is-fluid');
  if (!section) return;
  section.style.removeProperty(BRACKET_OVERFLOW_PROPERTY);
  const rounds = flightDisplay.querySelectorAll('.chc-round-container').length;
  if (!rounds) {
    section.style.removeProperty(BRACKET_ROUNDS_PROPERTY);
    return;
  }
  section.style.setProperty(BRACKET_ROUNDS_PROPERTY, String(rounds));

  // Reading scrollWidth lays out the estimate first; a hidden section measures 0 and gets nothing added. The round
  // columns share the width equally, so each is short by what the last one shows past the edge: the bracket needs
  // that much again per round.
  const bracket = flightDisplay.querySelector<HTMLElement>('.chc-container');
  const overflow = bracket ? bracket.scrollWidth - bracket.clientWidth : 0;
  if (overflow > 0) section.style.setProperty(BRACKET_OVERFLOW_PROPERTY, `${overflow * rounds}px`);
}
