import { describe, expect, it, vi } from 'vitest';

// Stylesheet import — vite resolves it, the no-DOM vitest runner does not.
// `sanitizeProviderNotes` and `renderNotes` are DOM-bound and are covered by
// the Playwright suite; the colour-stripping core is pure and lives here.
vi.mock('./renderNotes.css', () => ({}));

import { stripColorDeclarations } from './renderNotes';

describe('stripColorDeclarations', () => {
  it('drops the inline colour that made live notes unreadable', () => {
    // Verbatim from the Battle of Boca tournament record — a pale blue chosen
    // against a dark editor canvas, invisible on the light theme.
    expect(stripColorDeclarations('color: rgb(201, 218, 248)')).toBe('');
  });

  it('keeps non-colour declarations', () => {
    expect(stripColorDeclarations('color: red; font-weight: bold; text-align: center')).toBe(
      'font-weight: bold; text-align: center',
    );
  });

  it('drops every background form as well as the foreground', () => {
    expect(
      stripColorDeclarations('background: #000; background-color: #111; background-image: url(x); margin: 4px'),
    ).toBe('margin: 4px');
  });

  it('matches properties case- and whitespace-insensitively', () => {
    expect(stripColorDeclarations('  COLOR : red ;  Background-Color:#fff; padding: 2px')).toBe('padding: 2px');
  });

  it('does not strip properties that merely contain "color"', () => {
    expect(stripColorDeclarations('border-color: red; caret-color: blue')).toBe('border-color: red; caret-color: blue');
  });

  it('returns an empty string for empty or missing input', () => {
    expect(stripColorDeclarations(undefined)).toBe('');
    expect(stripColorDeclarations('')).toBe('');
    expect(stripColorDeclarations(';;;')).toBe('');
  });

  it('tolerates a trailing semicolon without emitting an empty declaration', () => {
    expect(stripColorDeclarations('font-weight: bold;')).toBe('font-weight: bold');
  });
});
