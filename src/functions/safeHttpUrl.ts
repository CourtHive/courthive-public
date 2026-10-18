const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Returns the URL as an href only when it resolves to http or https. Structured registration links
 * (entry URL, logistics documents, sponsor websites) come from a provider-written record, and DOM
 * assignment to `href` keeps the markup intact but not the scheme: a `javascript:` or `data:` URL
 * would survive. A rejected URL is shown as text instead of a link.
 */
export function safeHttpUrl(url: unknown, base = globalThis.location?.href): string | undefined {
  if (typeof url !== 'string' || !url.trim()) return undefined;
  try {
    const parsed = base ? new URL(url.trim(), base) : new URL(url.trim());
    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}
