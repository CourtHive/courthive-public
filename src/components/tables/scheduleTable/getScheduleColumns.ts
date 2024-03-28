import { generateEmptyColumns } from './generateEmptyColumns';
import { getControlColumn } from './getControlColumn';
import { scheduleCell } from './scheduleCell';

import { CENTER, MINIMUM_SCHEDULE_COLUMNS } from 'src/common/constants/baseConstants';

export function getScheduleColumns({ courtsData, courtPrefix }) {
  const columnsCalc = MINIMUM_SCHEDULE_COLUMNS - courtsData?.length || 0;
  const emptyColumnsCount = columnsCalc <= 0 ? 1 : columnsCalc;

  const emptyColumns = generateEmptyColumns({ count: emptyColumnsCount });
  const controlColumn = getControlColumn();

  const generateColumn = (courtInfo, index) => ({
    field: `${courtPrefix}${index}`,
    title: courtInfo.courtName,
    headerHozAlign: CENTER,
    formatter: scheduleCell,
    headerSort: false,
    resizable: false,
    hozAlign: CENTER,
    minWidth: 150
  });

  return [controlColumn].concat(courtsData?.map(generateColumn), emptyColumns);
}
