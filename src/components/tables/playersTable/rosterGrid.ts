import './rosterGrid.css';

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export interface RosterEntry {
  name: string;
  sex?: string;
}

export interface RosterSection {
  /** `ALL` when the roster is not worth splitting; otherwise a gender key. */
  key: string;
  entries: RosterEntry[];
}

/**
 * Section order. `UNSPECIFIED` collects participants whose person record
 * carries no `sex`, and always sorts last so a handful of unknowns never
 * pushes the main groups down the page.
 */
export const GENDER_ORDER = ['FEMALE', 'MALE', 'UNSPECIFIED'] as const;

const UNSPECIFIED = 'UNSPECIFIED';

function normalizeSex(sex?: string): string {
  const value = String(sex ?? '')
    .trim()
    .toUpperCase();
  return value === 'MALE' || value === 'FEMALE' ? value : UNSPECIFIED;
}

/**
 * Split a roster into gender sections.
 *
 * Grouping is what conveys gender here — it replaced pink/blue name colouring,
 * which encoded the same thing by hue alone and was invisible to colourblind
 * viewers and in high-contrast modes.
 *
 * Returns a single unlabelled `ALL` section when splitting would not actually
 * separate anything — an all-one-gender field, or one where nobody published a
 * `sex` — so those rosters render as a plain list rather than under a lone
 * heading that tells the reader nothing.
 */
export function groupByGender(entries: RosterEntry[]): RosterSection[] {
  const buckets = new Map<string, RosterEntry[]>();
  for (const entry of entries) {
    const key = normalizeSex(entry.sex);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  const populated = GENDER_ORDER.filter((key) => buckets.get(key)?.length).map((key) => ({
    key,
    entries: buckets.get(key) as RosterEntry[],
  }));

  if (populated.length < 2) return entries.length ? [{ key: 'ALL', entries }] : [];
  return populated;
}

/**
 * A roster grid rather than a data grid.
 *
 * When a tournament publishes only participant names, a table renders one
 * narrow column of text and gives every cell a bottom border that stops at the
 * column edge — which reads as an underline under each name, beside a wide
 * band of empty space. Names alone want a multi-column list.
 */
export function buildRosterGrid({ entries, t }: { entries: RosterEntry[]; t: TFunction }): HTMLElement {
  const roster = document.createElement('div');
  roster.className = 'chp-roster';

  for (const section of groupByGender(entries)) {
    const group = document.createElement('section');
    group.className = 'chp-roster__section';

    if (section.key !== 'ALL') {
      const heading = document.createElement('h3');
      heading.className = 'chp-roster__heading';

      const label = document.createElement('span');
      label.textContent = t(`players.gender.${section.key.toLowerCase()}`);
      heading.appendChild(label);

      const count = document.createElement('span');
      count.className = 'chp-roster__count';
      count.textContent = String(section.entries.length);
      heading.appendChild(count);

      group.appendChild(heading);
    }

    const list = document.createElement('ul');
    list.className = 'chp-roster__list';
    for (const entry of section.entries) {
      const item = document.createElement('li');
      item.className = 'chp-roster__name';
      item.textContent = entry.name;
      list.appendChild(item);
    }
    group.appendChild(list);
    roster.appendChild(group);
  }

  return roster;
}
