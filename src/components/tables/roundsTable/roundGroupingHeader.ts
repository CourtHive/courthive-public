import { escapeHtml } from 'src/functions/escapeHtml';

/**
 * Tabulator writes a group header's returned string with innerHTML, so the shared value (a round or
 * structure name from the tournament record) is escaped; only the count decoration is markup.
 */
export function roundGroupingHeader(value, count) {
  const itemDisplay = count > 1 ? 'items' : 'item';

  return escapeHtml(value) + `<span style='color:blue; margin-left:10px;'>(${count} ${itemDisplay})</span>`;
}

/** A group header that is only the shared value, escaped for Tabulator's innerHTML write. */
export function textGroupingHeader(value) {
  return escapeHtml(value);
}
