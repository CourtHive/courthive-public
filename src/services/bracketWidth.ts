/**
 * Room for a bracket with more rounds than the page container fits.
 *
 * The tournament page is held to the container width (1344px at most), so on a
 * wide screen a 64- or 128-draw is squeezed — schedule headers truncate and the
 * last round scrolls — while the sides of the screen sit empty. Recording the
 * number of round columns on screen lets `.section.is-fluid` (layout.css) widen
 * past the container, centred, by just what those rounds need. A draw that
 * already fits does not move, and choosing a later starting round with the
 * round chips shrinks the section back.
 */

export const BRACKET_ROUNDS_PROPERTY = '--chp-bracket-rounds';

export function fitBracketWidth(flightDisplay: HTMLElement): void {
  const section = flightDisplay.closest<HTMLElement>('.section.is-fluid');
  if (!section) return;
  const rounds = flightDisplay.querySelectorAll('.chc-round-container').length;
  if (rounds) section.style.setProperty(BRACKET_ROUNDS_PROPERTY, String(rounds));
  else section.style.removeProperty(BRACKET_ROUNDS_PROPERTY);
}
