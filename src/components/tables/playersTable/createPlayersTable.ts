import { participantSorter } from 'src/common/sorters/participantSorter';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { eventConstants, fixtures } from 'tods-competition-factory';
import { buildRosterGrid, groupByGender } from './rosterGrid';
import { destroyTable } from 'src/components/destroyTable';
import { renderParticipant } from 'courthive-components';
import { t } from 'src/i18n/i18n';

const { ratingsParameters } = fixtures;
const { SINGLES } = eventConstants;

const ANCHOR_ID = 'playersTable';

// `genderColor` is deliberately off. It tinted names pink/blue, encoding sex by
// hue alone — unreadable to colourblind viewers and in high-contrast modes.
// Gender is conveyed by grouping instead, in both the roster and the table.
const PARTICIPANTS_COMPOSITION = { configuration: { genderColor: false }, theme: 'chc-theme-basiccard' };

/**
 * With a single published column there is nothing to tabulate — a data grid
 * would render one narrow column of names, each with a bottom border stopping
 * at the column edge. Hand those rosters to `buildRosterGrid` instead.
 */
export function shouldUseRosterGrid(columnCount: number): boolean {
  return columnCount <= 1;
}

interface ColumnConfig {
  country?: boolean;
  events?: boolean;
  ratings?: string[];
  rankings?: string[];
}

interface RowData {
  participant: any;
  name: string;
  sex?: string;
  country: string;
  cityState: string;
  ratings: Record<string, any>;
  ranking?: number | string;
  events: { eventId: string; eventName: string; eventType?: string }[];
}

function resolveCityState(person: any): string {
  const addr = person?.addresses?.[0];
  return [addr?.city, addr?.state].filter(Boolean).join(', ') || '';
}

export function createPlayersTable({
  participants = [],
  columnConfig,
}: {
  participants?: any[];
  columnConfig?: ColumnConfig;
}) {
  destroyTable({ anchorId: ANCHOR_ID });

  const element = document.getElementById(ANCHOR_ID);
  if (!element) return;

  const individuals = participants.filter((p) => p.participantType === 'INDIVIDUAL');
  individuals.sort(participantSorter);

  const rows: RowData[] = individuals.map((p) => {
    const person = p.person || {};
    const country = person.nationalityCode || '';
    const cityState = resolveCityState(person);
    const events = (p.events || []).map((e) => ({
      eventId: e.eventId,
      eventName: e.eventName,
      eventType: e.eventType,
    }));

    const ratings: Record<string, any> = {};
    for (const item of p.ratings?.[SINGLES] || []) {
      const key = item.scaleName.toLowerCase();
      const params = ratingsParameters[item.scaleName.toUpperCase()];
      const accessor = params?.accessor || `${key}Rating`;
      ratings[key] =
        typeof item.scaleValue === 'object' && item.scaleValue !== null
          ? item.scaleValue
          : { [accessor]: item.scaleValue };
    }

    const rankingEntry = p.rankings?.[SINGLES]?.[0];
    const ranking = rankingEntry?.scaleValue ?? undefined;

    return {
      participant: p,
      name: p.participantName || '',
      sex: person.sex,
      country,
      cityState,
      ratings,
      ranking,
      events,
    };
  });

  const presentRatings = new Set<string>();
  let hasRanking = false;
  for (const row of rows) {
    for (const key of Object.keys(row.ratings || {})) presentRatings.add(key);
    if (row.ranking !== null && row.ranking !== undefined) hasRanking = true;
  }

  // Filter ratings by columnConfig
  let filteredRatingColumns: any[] = [];
  for (const key of presentRatings) {
    const upperKey = key.toUpperCase();
    const params = ratingsParameters[upperKey];
    if (!params) continue;

    // If columnConfig.ratings is specified, only include those
    if (columnConfig && Array.isArray(columnConfig.ratings)) {
      const allowedRatings = new Set(columnConfig.ratings.map((r) => r.toUpperCase()));
      if (!allowedRatings.has(upperKey)) continue;
    }

    const accessor = params.accessor || `${key}Rating`;
    filteredRatingColumns.push({
      title: upperKey,
      field: `ratings.${key}.${accessor}`,
      sorter: 'number',
      sorterParams: { alignEmptyValues: 'bottom' },
      headerSort: true,
      width: 80,
    });
  }
  filteredRatingColumns.sort((a, b) => a.title.localeCompare(b.title));

  // Filter ranking by columnConfig
  if (columnConfig && Array.isArray(columnConfig.rankings) && columnConfig.rankings.length === 0) {
    hasRanking = false;
  }

  const hasCityState = rows.some((row) => row.cityState);

  // Name column is always shown — rendered via renderParticipant so the
  // bracket's participant styling carries over to the list view (its gender
  // colouring does not; see PARTICIPANTS_COMPOSITION).
  // Returning outerHTML (instead of the live HTMLElement) sidesteps a
  // Tabulator caching wrinkle where the same DOM node can briefly appear
  // and then vanish across sort / virtual-scroll redraws.
  const columns: any[] = [
    {
      title: t('players.name'),
      field: 'name',
      sorter: 'string',
      headerSort: true,
      formatter: (cell: any) => {
        const row = cell.getRow().getData() as RowData;
        if (!row.participant) return row.name || '';
        try {
          return renderParticipant({ participant: row.participant, composition: PARTICIPANTS_COMPOSITION }).outerHTML;
        } catch (err) {
          console.warn('[participants] renderParticipant failed', err);
          return row.name || '';
        }
      },
    },
  ];

  // Country column (filtered by columnConfig)
  const showCountry = !columnConfig || columnConfig.country !== false;
  if (showCountry) {
    columns.push({
      title: t('players.country'),
      field: 'country',
      sorter: 'string',
      headerSort: true,
      width: 100,
    });
  }

  if (hasCityState) {
    columns.push({
      title: t('players.cityState'),
      field: 'cityState',
      sorter: 'string',
      headerSort: true,
      width: 180,
    });
  }

  if (hasRanking) {
    columns.push({
      title: t('players.rank'),
      field: 'ranking',
      sorter: 'number',
      sorterParams: { alignEmptyValues: 'bottom' },
      headerSort: true,
      width: 80,
    });
  }

  columns.push(...filteredRatingColumns);

  // Events column — render each event as a chip rather than a comma-
  // separated text string. Sorting is by the joined event-name text so
  // tabulator's default string sorter still works against `events`.
  const showEvents = !columnConfig || columnConfig.events !== false;
  if (showEvents) {
    columns.push({
      title: t('players.events'),
      field: 'events',
      sorter: (_a: unknown, _b: unknown, aRow: any, bRow: any) => {
        const at = (aRow.getData().events as RowData['events']).map((e) => e.eventName).join(', ');
        const bt = (bRow.getData().events as RowData['events']).map((e) => e.eventName).join(', ');
        return at.localeCompare(bt, undefined, { numeric: true });
      },
      headerSort: true,
      formatter: (cell: any) => {
        const events = (cell.getRow().getData() as RowData).events || [];
        const wrapper = document.createElement('div');
        wrapper.className = 'chp-event-chips';
        for (const ev of events) {
          const chip = document.createElement('span');
          chip.className = 'chp-event-chip';
          if (ev.eventType) chip.dataset.eventType = ev.eventType;
          chip.textContent = ev.eventName;
          wrapper.appendChild(chip);
        }
        return wrapper;
      },
    });
  }

  if (shouldUseRosterGrid(columns.length)) {
    element.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'chp-roster__empty';
      empty.textContent = t('players.noParticipants');
      element.appendChild(empty);
      return;
    }
    element.appendChild(buildRosterGrid({ entries: rows.map(({ name, sex }) => ({ name, sex })), t }));
    return;
  }

  // Gender reads as a group header rather than a name colour, matching the
  // roster. `groupByGender` returns a lone `ALL` section when splitting would
  // not separate anything — in that case leave the table ungrouped rather than
  // stacking every row under one meaningless header.
  const sections = groupByGender(rows.map(({ name, sex }) => ({ name, sex })));
  const groupByGenderInTable = sections.length > 1;

  new Tabulator(element, {
    height: window.innerHeight * 0.84,
    placeholder: t('players.noParticipants'),
    // Let the Name column absorb the leftover width instead of sitting at its
    // intrinsic size beside a band of empty space.
    layout: 'fitColumns',
    data: rows,
    columns,
    ...(groupByGenderInTable
      ? {
          groupBy: (data: RowData) => {
            const sex = String(data.sex ?? '').toUpperCase();
            return sex === 'MALE' || sex === 'FEMALE' ? sex : 'UNSPECIFIED';
          },
          groupHeader: (value: string, count: number) => {
            const label = t(`players.gender.${String(value).toLowerCase()}`);
            return `${label} <span class="chp-group-count">${count}</span>`;
          },
        }
      : {}),
  });
}
