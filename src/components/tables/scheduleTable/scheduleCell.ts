import { buildScheduleGridCell, mapMatchUpToCellData, DEFAULT_SCHEDULE_CELL_CONFIG } from 'courthive-components';
import { factoryConstants } from 'tods-competition-factory';

const { SCHEDULE_STATE } = factoryConstants.scheduleConstants;

const STATUS_CLASS_FOR_OUTER: Record<string, string> = {
  spl_complete: 'spl-cell--complete',
  spl_inprogress: 'spl-cell--inprogress',
  spl_error: 'spl-cell--error',
  spl_conflict: 'spl-cell--conflict',
  spl_warning: 'spl-cell--warning',
  spl_issue: 'spl-cell--issue',
  spl_abandoned: 'spl-cell--abandoned',
  spl_cancelled: 'spl-cell--cancelled',
  spl_double_walkover: 'spl-cell--double-walkover',
  spl_double_booking: 'spl-cell--double-booking'
};

export function scheduleCell(cell) {
  const inactive = !cell.getColumn().getDefinition().field;
  if (inactive) {
    const empty = document.createElement('div');
    empty.className = 'spl-grid-cell spl-cell--empty';
    return empty;
  }

  const value = cell.getValue();
  const matchUp = value ? { ...value, scheduleState: value.schedule?.[SCHEDULE_STATE] } : value;
  const data = mapMatchUpToCellData(matchUp);
  const element = buildScheduleGridCell(data, DEFAULT_SCHEDULE_CELL_CONFIG);

  const outer = cell.getElement();
  if (outer) {
    for (const cls of Object.values(STATUS_CLASS_FOR_OUTER)) outer.classList.remove(cls);
    for (const cls of Object.values(STATUS_CLASS_FOR_OUTER)) {
      if (element.classList.contains(cls)) outer.classList.add(cls);
    }
  }

  return element;
}
