import { tools } from 'tods-competition-factory';
import { scheduleCell } from './scheduleCell';

// constants
import { CENTER } from 'src/common/constants/baseConstants';

export function generateEmptyColumns({ count }) {
  return count > 0
    ? tools.generateRange(0, count).map(() => ({
        headerHozAlign: CENTER,
        formatter: scheduleCell,
        headerSort: false,
        resizable: false,
        minWidth: 150,
      }))
    : [];
}
