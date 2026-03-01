import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { eventConstants, fixtures } from 'tods-competition-factory';
import { participantSorter } from 'src/common/sorters/participantSorter';
import { destroyTable } from 'src/components/destroyTable';
import { t } from 'src/i18n/i18n';

const { ratingsParameters } = fixtures;
const { SINGLES } = eventConstants;

const ANCHOR_ID = 'playersTable';

interface ColumnConfig {
  country?: boolean;
  events?: boolean;
  ratings?: string[];
  rankings?: string[];
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

  const rows = individuals.map((p) => {
    const person = p.person || {};
    const country = person.nationalityCode || '';
    const events = (p.events || []).map((e) => e.eventName).join(', ');

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
      name: p.participantName || '',
      country,
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

  // Name column is always shown
  const columns: any[] = [
    { title: t('players.name'), field: 'name', sorter: 'string', headerSort: true },
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

  // Events column (filtered by columnConfig)
  const showEvents = !columnConfig || columnConfig.events !== false;
  if (showEvents) {
    columns.push({ title: t('players.events'), field: 'events', sorter: 'string', headerSort: true });
  }

  new Tabulator(element, {
    height: window.innerHeight * 0.84,
    placeholder: t('players.noParticipants'),
    data: rows,
    columns,
  });
}
