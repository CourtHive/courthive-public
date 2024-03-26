import { tools } from 'tods-competition-factory';
import { scheduleCell } from './scheduleCell';

// constants
import { CENTER } from 'src/common/constants/baseConstants';

export function generateEmptyColumns({ courtsData, count }) {
  const emptyColumnHeader = (index) => {
    if (index) return undefined;

    return courtsData?.length || 0
      ? `<p style='font-weight: normal; color: lightblue'>Add venue</p>`
      : `<button class='button is-danger'>Add venue</button>`;
  };
  return count > 0
    ? tools.generateRange(0, count).map((index) => ({
        title: emptyColumnHeader(index),
        headerHozAlign: CENTER,
        formatter: scheduleCell,
        headerSort: false,
        resizable: false,
        minWidth: 150
      }))
    : [];
}
