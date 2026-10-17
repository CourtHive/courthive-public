const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes a value for interpolation into HTML text or a quoted attribute. Every name this viewer
 * shows comes from a tournament record a provider, integrator or imported file wrote, so it must
 * never be parsed as markup — and the dropdown/menu labels it feeds are written with innerHTML.
 * Prefer `textContent` where an element holds only the value.
 */
export function escapeHtml(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[&<>"']/g, (char) => ENTITIES[char]);
}
