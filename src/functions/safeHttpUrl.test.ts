import { describe, expect, it } from 'vitest';
import { safeHttpUrl } from './safeHttpUrl';

const BASE = 'https://courthive.net/public/';

describe('safeHttpUrl', () => {
  it('keeps http and https links', () => {
    expect(safeHttpUrl('https://example.com/entry?x=1', BASE)).toBe('https://example.com/entry?x=1');
    expect(safeHttpUrl('http://example.com', BASE)).toBe('http://example.com/');
  });

  it('resolves a relative link against the page', () => {
    expect(safeHttpUrl('docs/rules.pdf', BASE)).toBe('https://courthive.net/public/docs/rules.pdf');
  });

  it('rejects script, data and other schemes, whatever their case or padding', () => {
    for (const url of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      expect(safeHttpUrl(url, BASE)).toBeUndefined();
    }
  });

  it('rejects empty and non-string values', () => {
    for (const url of [undefined, null, '', '   ', 42, {}]) expect(safeHttpUrl(url, BASE)).toBeUndefined();
  });
});
