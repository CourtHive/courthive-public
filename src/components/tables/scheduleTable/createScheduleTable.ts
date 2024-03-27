import { competitionEngine, tools } from 'tods-competition-factory';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { destroyTable } from 'src/components/destroyTable';
import { getScheduleColumns } from './getScheduleColumns';

// constants
import { TOURNAMENT_SCHEDULE } from 'src/common/constants/baseConstants';

export function createScheduleTable(params) {
  const { scheduledDate } = params ?? {};
  let existingCourtIds = [];
  let table: any = undefined;
  let ready;

  const getTableData = ({ scheduledDate }) => {
    const matchUpFilters = { localPerspective: true, scheduledDate };
    const result = competitionEngine.competitionScheduleMatchUps({
      courtCompletedMatchUps: true,
      withCourtGridRows: true,
      minCourtGridRows: 10,
      nextMatchUps: true,
      matchUpFilters
    });
    const { dateMatchUps = [], completedMatchUps = [], courtsData, courtPrefix = 'C|', rows, groupInfo } = result;
    const matchUps = dateMatchUps.concat(...completedMatchUps);

    const columns: any = getScheduleColumns({ courtsData, courtPrefix });

    rows?.forEach((row, i) => {
      row.rowId = `rowId-${i + 1}`;
      row.rowNumber = i + 1;
    });
    return { rows, columns, matchUps, courtsCount: courtsData?.length ?? 0, courtsData, groupInfo };
  };

  const replaceTableData = ({ scheduledDate }) => {
    const refresh = () => {
      const { rows, matchUps, columns, courtsData } = getTableData({ scheduledDate });
      const courtIds = courtsData?.map((court) => court.courtId);

      const equivalentCourts = tools.intersection(existingCourtIds, courtIds).length === courtIds?.length;

      if (!equivalentCourts) {
        table.setColumns(columns);
        existingCourtIds = courtIds;
      }
      table?.replaceData(rows);
      table.matchUps = matchUps;
    };

    setTimeout(refresh, ready ? 0 : 1000);
  };

  destroyTable({ anchorId: TOURNAMENT_SCHEDULE });
  const element = document.getElementById(TOURNAMENT_SCHEDULE);

  const { rows = [], columns = [], courtsCount } = getTableData({ scheduledDate });
  existingCourtIds = columns.map((col) => col?.courtId).filter(Boolean);

  table = new Tabulator(element, {
    height: window.innerHeight * 0.84,
    renderHorizontal: 'virtual',
    placeholder: 'No courts',
    index: 'rowId',
    data: rows,
    columns
  });

  return { table, replaceTableData, courtsCount };
}
