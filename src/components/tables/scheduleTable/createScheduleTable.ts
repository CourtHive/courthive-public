import { dropDownButton } from 'src/components/buttons/dropDownButton';
import { removeAllChildNodes } from 'src/services/dom/transformers';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { scheduleGovernor } from 'tods-competition-factory';
import { destroyTable } from 'src/components/destroyTable';
import { getScheduleColumns } from './getScheduleColumns';
import dayjs from 'dayjs';

export function createScheduleTable(params) {
  const { dateMatchUps = [], completedMatchUps = [], groupInfo } = params?.data ?? {};
  const matchUps = dateMatchUps.concat(...completedMatchUps);
  const scheduleDates = matchUps.reduce((dates, matchUp) => {
    const scheduledDate = matchUp?.schedule?.scheduledDate;
    if (scheduledDate && !dates.includes(scheduledDate)) dates.push(scheduledDate);
    return dates;
  }, []);

  const scheduledDate = scheduleDates[0];
  let table: any = undefined;

  const getTableData = ({ scheduledDate }) => {
    const courtsData = params?.data?.courtsData.map((court) => {
      const { matchUps, ...details } = court;
      return { ...details, matchUps: matchUps.filter((matchUp) => matchUp.schedule?.scheduledDate === scheduledDate) };
    });

    const courtPrefix = 'C|';
    const rows = scheduleGovernor.courtGridRows({ courtsData, courtPrefix, minRowsCount: 10 }).rows;
    const columns: any = getScheduleColumns({ courtsData, courtPrefix });

    rows?.forEach((row, i) => {
      row.rowId = `rowId-${i + 1}`;
      row.rowNumber = i + 1;
    });
    return { rows, columns, courtsCount: courtsData?.length ?? 0, courtsData, groupInfo };
  };

  const replaceTableData = ({ scheduledDate }) => {
    const { rows } = getTableData({ scheduledDate });

    table?.replaceData(rows);
    table.matchUps = matchUps;
  };

  const formatDate = (dateString) => dayjs(dateString).format('dddd MMM D');
  const dateOptions = scheduleDates.map((dateString) => ({
    onClick: () => replaceTableData({ scheduledDate: dateString }),
    label: formatDate(dateString),
    value: dateString,
    close: true
  }));
  const dateSelector = {
    label: formatDate(scheduledDate),
    options: dateOptions,
    id: 'dateSelector',
    modifyLabel: true,
    selection: true
  };
  const scheduleHeader = document.getElementById('scheduleHeader');
  removeAllChildNodes(scheduleHeader);
  const elem = dropDownButton({ button: dateSelector });
  scheduleHeader.appendChild(elem);

  destroyTable({ anchorId: 'tournamentSchedule' });
  const element = document.getElementById('tournamentSchedule');

  const { rows = [], columns = [], courtsCount } = getTableData({ scheduledDate });

  table = new Tabulator(element, {
    height: window.innerHeight * 0.84,
    renderHorizontal: 'virtual',
    placeholder: 'No courts',
    index: 'rowId',
    data: rows,
    columns
  });

  return { table, courtsCount };
}
