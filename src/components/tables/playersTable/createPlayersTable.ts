import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { eventConstants, fixtures } from 'tods-competition-factory';
import { participantSorter } from 'src/common/sorters/participantSorter';
import { destroyTable } from 'src/components/destroyTable';

const { ratingsParameters } = fixtures;
const { SINGLES } = eventConstants;

const ANCHOR_ID = 'playersTable';

export function createPlayersTable({ participants = [] }) {
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

  const ratingColumns: any[] = [];
  for (const key of presentRatings) {
    const upperKey = key.toUpperCase();
    const params = ratingsParameters[upperKey];
    if (!params) continue;
    const accessor = params.accessor || `${key}Rating`;
    ratingColumns.push({
      title: upperKey,
      field: `ratings.${key}.${accessor}`,
      sorter: 'number',
      sorterParams: { alignEmptyValues: 'bottom' },
      headerSort: true,
      width: 80,
    });
  }
  ratingColumns.sort((a, b) => a.title.localeCompare(b.title));

  const columns: any[] = [
    { title: 'Name', field: 'name', sorter: 'string', headerSort: true },
    { title: 'Country', field: 'country', sorter: 'string', headerSort: true, width: 100 },
  ];

  const additionalColumns = [];

  if (hasRanking) {
    additionalColumns.push({
      title: 'Rank',
      field: 'ranking',
      sorter: 'number',
      sorterParams: { alignEmptyValues: 'bottom' },
      headerSort: true,
      width: 80,
    });
  }

  additionalColumns.push(...ratingColumns);
  additionalColumns.push({ title: 'Events', field: 'events', sorter: 'string', headerSort: true });

  columns.push(...additionalColumns);

  new Tabulator(element, {
    height: window.innerHeight * 0.84,
    placeholder: 'No participants',
    data: rows,
    columns,
  });
}
