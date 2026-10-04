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

/** Elements that must never survive provider-authored markup. */
const STRIPPED_ELEMENTS = 'script, style, iframe, object, embed, link, meta, base, form';

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
 * Make provider-authored HTML safe to inject and legible in both themes.
 *
 * Parsing happens inside a `<template>`, whose content belongs to an inert
 * document — scripts do not execute and images do not load while we clean it.
 */
export function sanitizeProviderNotes(html?: string): string {
  if (!html) return '';

  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll(STRIPPED_ELEMENTS).forEach((element) => element.remove());

  template.content.querySelectorAll('*').forEach((element) => {
    for (const { name } of [...element.attributes]) {
      // Inline event handlers, and `javascript:` in anything that navigates.
      if (name.toLowerCase().startsWith('on')) element.removeAttribute(name);
    }

    const style = stripColorDeclarations(element.getAttribute('style'));
    if (style) element.setAttribute('style', style);
    else element.removeAttribute('style');

    // Presentational attributes from legacy editors, same problem as inline colour.
    element.removeAttribute('color');
    element.removeAttribute('bgcolor');

    if (element.tagName === 'A') {
      const href = element.getAttribute('href') ?? '';
      if (/^\s*javascript:/i.test(href)) element.removeAttribute('href');
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    }
  });

  return template.innerHTML;
}

export function renderNotes(notes?: string): HTMLElement | null {
  const sanitized = sanitizeProviderNotes(notes);
  if (!sanitized.trim()) return null;

  const section = document.createElement('section');
  section.className = 'tournament-notes';
  section.innerHTML = sanitized;
  return section;
}
