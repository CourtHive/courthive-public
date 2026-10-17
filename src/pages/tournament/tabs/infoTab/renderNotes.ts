import DOMPurify from 'dompurify';
import './renderNotes.css';

/**
 * Colour declarations authored against an unknown background.
 *
 * Tournament notes are provider-authored HTML pasted from whatever editor the
 * director used, and they arrive carrying inline colours chosen for THAT
 * editor's canvas. Battle of Boca's notes ship
 * `<span style="color: rgb(201,218,248)">` — a pale blue picked against a dark
 * background, which renders as near-invisible text on the light theme and is
 * equally wrong when the viewer flips themes. Dropping these lets the prose
 * inherit --chc-* tokens, which are correct in both.
 */
const STRIPPED_PROPERTIES = ['color', 'background', 'background-color', 'background-image'];

/** Elements DOMPurify would otherwise keep that provider notes must not carry. */
const FORBIDDEN_TAGS = ['style', 'form', 'input', 'button', 'textarea', 'select'];

/**
 * Remove colour declarations from an inline `style` attribute value, leaving
 * every other declaration (spacing, weight, alignment) intact.
 *
 * Pure string→string so it is unit-testable in this repo's no-DOM vitest
 * environment; the surrounding DOM walk is covered by the Playwright suite.
 */
export function stripColorDeclarations(styleText?: string): string {
  if (!styleText) return '';
  return styleText
    .split(';')
    .filter((declaration) => {
      const property = declaration.split(':')[0]?.trim().toLowerCase();
      return property ? !STRIPPED_PROPERTIES.includes(property) : false;
    })
    .map((declaration) => declaration.trim())
    .join('; ');
}

/**
 * Make provider-authored HTML safe to show and legible in both themes.
 *
 * DOMPurify does the security work: scripts, event handlers, `javascript:` URLs in any namespace
 * (an SVG `<a>` included), and the parsing tricks behind mutation XSS. It returns a DOM fragment
 * that callers append as-is; re-serialising to a string and parsing it again is what mutation XSS
 * exploits. The readability rules below then run on its output: no inline colour, no legacy
 * colour attributes, links open in a new tab.
 */
export function sanitizeProviderNotes(html?: string): DocumentFragment {
  const fragment = DOMPurify.sanitize(html ?? '', {
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: FORBIDDEN_TAGS,
  });

  fragment.querySelectorAll('*').forEach((element) => {
    const style = stripColorDeclarations(element.getAttribute('style') ?? undefined);
    if (style) element.setAttribute('style', style);
    else element.removeAttribute('style');

    // Presentational attributes from legacy editors, same problem as inline colour.
    element.removeAttribute('color');
    element.removeAttribute('bgcolor');

    if (element.localName === 'a' && element.hasAttribute('href')) {
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    }
  });

  return fragment;
}

export function renderNotes(notes?: string): HTMLElement | null {
  const sanitized = sanitizeProviderNotes(notes);
  if (!sanitized.textContent?.trim() && !sanitized.querySelector('img, table, hr')) return null;

  const section = document.createElement('section');
  section.className = 'tournament-notes';
  section.append(sanitized);
  return section;
}
