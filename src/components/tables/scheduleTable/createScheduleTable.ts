import { buildActiveStripPanel, buildScheduleGridCell, mapMatchUpToCellData, DEFAULT_SCHEDULE_CELL_CONFIG } from 'courthive-components';
import { scheduleGovernor, factoryConstants } from 'tods-competition-factory';
import { dropDownButton } from 'src/components/buttons/dropDownButton';
import { removeAllChildNodes } from 'src/services/dom/transformers';
import dayjs from 'dayjs';

// constants and types
import { MINIMUM_SCHEDULE_COLUMNS } from 'src/common/constants/baseConstants';

const { SCHEDULE_STATE } = factoryConstants.scheduleConstants;

const COURT_PREFIX = 'C|';
const MIN_ROWS_COUNT = 10;
const TIME_COL_WIDTH_PX = 50;
const MIN_COURT_WIDTH_PX = 110;
const STRIP_CELL_HEIGHT_PX = 80;

interface ScheduleData {
  dateMatchUps?: any[];
  completedMatchUps?: any[];
  courtsData?: any[];
  mappedParticipants?: Record<string, any>;
}

/**
 * Read-only public schedule. Renders a schedule2-style CSS court grid (one
 * column per court, time-ordered rows) using the courthive-components
 * `buildScheduleGridCell`, with a live "Now" strip (`buildActiveStripPanel`)
 * pinned above it. Courts with no scheduled matchUps on the selected date are
 * hidden — only courts in active use appear.
 */
export function createScheduleTable(params?: { data?: ScheduleData }) {
  const data = params?.data ?? {};
  const matchUps = (data.dateMatchUps ?? []).concat(...(data.completedMatchUps ?? []));
  const scheduleDates = collectScheduleDates(matchUps);

  const headerEl = document.getElementById('scheduleHeader');
  const gridEl = document.getElementById('tournamentSchedule');
  if (gridEl) removeAllChildNodes(gridEl);
  if (headerEl) removeAllChildNodes(headerEl);

  if (!scheduleDates.length || !gridEl) {
    if (gridEl) renderEmptyState(gridEl);
    return { courtsCount: 0 };
  }

  const renderForDate = (scheduledDate: string) => {
    const courtsData = courtsForDate(data, scheduledDate);
    const rows = scheduleGovernor.courtGridRows({ courtsData, courtPrefix: COURT_PREFIX, minRowsCount: MIN_ROWS_COUNT, scheduledDate }).rows ?? [];
    renderScheduleGrid({ gridEl, courtsData, rows });
  };

  if (headerEl) headerEl.appendChild(buildDateSelector(scheduleDates, renderForDate));
  renderForDate(scheduleDates[0]);

  return { courtsCount: courtsForDate(data, scheduleDates[0]).length };
}

function collectScheduleDates(matchUps: any[]): string[] {
  const dates: string[] = [];
  for (const matchUp of matchUps) {
    const scheduledDate = matchUp?.schedule?.scheduledDate;
    if (scheduledDate && !dates.includes(scheduledDate)) dates.push(scheduledDate);
  }
  return dates.sort((a, b) => a.localeCompare(b));
}

function buildDateSelector(scheduleDates: string[], renderForDate: (date: string) => void): HTMLElement {
  const formatDate = (dateString: string) => dayjs(dateString).format('dddd MMM D');
  const options = scheduleDates.map((dateString) => ({
    onClick: () => renderForDate(dateString),
    label: formatDate(dateString),
    value: dateString,
    close: true,
  }));
  return dropDownButton({
    button: {
      label: formatDate(scheduleDates[0]),
      id: 'dateSelector',
      modifyLabel: true,
      selection: true,
      options,
    },
  });
}

/** Hydrate side participants and keep only courts with matchUps on the date (auto-hide empty courts). */
function courtsForDate(data: ScheduleData, scheduledDate: string): any[] {
  const mappedParticipants = data.mappedParticipants ?? {};
  const onDate = (matchUp: any) => matchUp.schedule?.scheduledDate === scheduledDate;

  return (data.courtsData ?? [])
    .map((court) => {
      const { matchUps = [], ...details } = court;
      const dayMatchUps = matchUps.filter(onDate);
      for (const matchUp of dayMatchUps) hydrateSideParticipants(matchUp, mappedParticipants);
      return { ...details, matchUps: dayMatchUps };
    })
    .filter((court) => court.matchUps.length > 0);
}

function hydrateSideParticipants(matchUp: any, mappedParticipants: Record<string, any>): void {
  for (const side of matchUp.sides ?? []) {
    if (!side.participantId) continue;
    side.participant = mappedParticipants[side.participantId];
    const individualIds = side.participant?.individualParticipantIds;
    if (individualIds) {
      side.participant.individualParticipants = individualIds.map((id: string) => mappedParticipants[id]);
    }
  }
}

function gridTemplate(courtCount: number): { totalColumns: number; gridTemplateColumns: string; minWidth: string } {
  const emptyCalc = MINIMUM_SCHEDULE_COLUMNS - courtCount;
  const emptyCount = emptyCalc <= 0 ? 1 : emptyCalc;
  const totalColumns = courtCount + emptyCount;
  const gridTemplateColumns = `${TIME_COL_WIDTH_PX}px repeat(${totalColumns}, minmax(${MIN_COURT_WIDTH_PX}px, 1fr))`;
  const minWidth = `${TIME_COL_WIDTH_PX + totalColumns * MIN_COURT_WIDTH_PX}px`;
  return { totalColumns, gridTemplateColumns, minWidth };
}

function renderScheduleGrid({ gridEl, courtsData, rows }: { gridEl: HTMLElement; courtsData: any[]; rows: any[] }): void {
  removeAllChildNodes(gridEl);

  const courtCount = courtsData.length;
  const { totalColumns, gridTemplateColumns, minWidth } = gridTemplate(courtCount);

  const wrapper = document.createElement('div');
  wrapper.className = 'chp-schedule';
  wrapper.style.setProperty('--chp-strip-offset', `${STRIP_CELL_HEIGHT_PX + 2}px`);

  const strip = buildActiveStripPanel(
    {},
    {
      cellHeight: `${STRIP_CELL_HEIGHT_PX}px`,
      spacerLabel: 'Now',
      renderCell: (matchUp) => buildGridCell(matchUp.payload),
    },
  );
  strip.setData({ ...buildStripData(courtsData, rows), gridTemplateColumns, minWidth });
  wrapper.appendChild(strip.element);

  const grid = document.createElement('div');
  grid.className = 'chp-schedule-grid';
  grid.style.gridTemplateColumns = gridTemplateColumns;
  grid.style.minWidth = minWidth;

  appendHeaderRow(grid, courtsData, totalColumns - courtCount);
  appendDataRows(grid, courtsData, rows, totalColumns - courtCount);

  wrapper.appendChild(grid);
  gridEl.appendChild(wrapper);
}

function appendHeaderRow(grid: HTMLElement, courtsData: any[], emptyCount: number): void {
  const corner = document.createElement('div');
  corner.className = 'chp-schedule-corner';
  grid.appendChild(corner);

  for (const court of courtsData) {
    const header = document.createElement('div');
    header.className = 'chp-schedule-court-header';
    header.textContent = court.courtName ?? court.courtId;
    grid.appendChild(header);
  }

  for (let i = 0; i < emptyCount; i++) {
    grid.appendChild(emptyHeaderCell());
  }
}

function emptyHeaderCell(): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'chp-schedule-court-header chp-schedule-court-header--empty';
  return cell;
}

function appendDataRows(grid: HTMLElement, courtsData: any[], rows: any[], emptyCount: number): void {
  rows.forEach((row, rowIndex) => {
    const rowNumber = document.createElement('div');
    rowNumber.className = 'chp-schedule-rownum';
    rowNumber.textContent = String(rowIndex + 1);
    grid.appendChild(rowNumber);

    courtsData.forEach((_court, courtIndex) => {
      grid.appendChild(courtCellElement(row?.[`${COURT_PREFIX}${courtIndex}`]));
    });

    for (let i = 0; i < emptyCount; i++) {
      const empty = document.createElement('div');
      empty.className = 'chp-schedule-cell chp-schedule-cell--empty';
      grid.appendChild(empty);
    }
  });
}

function courtCellElement(matchUp: any): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'chp-schedule-cell';
  if (matchUp?.matchUpId) {
    cell.appendChild(buildGridCell(matchUp));
  } else {
    cell.classList.add('chp-schedule-cell--empty');
  }
  return cell;
}

/** Build the courthive-components `.spl-grid-cell`, surfacing the factory schedule state for status styling. */
function buildGridCell(matchUp: any): HTMLElement {
  const withState = { ...matchUp, scheduleState: matchUp.schedule?.[SCHEDULE_STATE] };
  return buildScheduleGridCell(mapMatchUpToCellData(withState), DEFAULT_SCHEDULE_CELL_CONFIG);
}

function buildStripData(courtsData: any[], rows: any[]) {
  const columns = courtsData.map((court, courtIndex) => ({
    courtId: court.courtId,
    cells: rows.map((row) => stripCell(row?.[`${COURT_PREFIX}${courtIndex}`])),
  }));
  const courts = courtsData.map((court) => ({ courtId: court.courtId, label: court.courtName ?? court.courtId }));
  return { grid: { columns }, courts };
}

function stripCell(matchUp: any) {
  if (!matchUp?.matchUpId) return null;
  return {
    matchUpId: matchUp.matchUpId,
    drawId: matchUp.drawId,
    roundNumber: matchUp.roundNumber,
    matchUpStatus: matchUp.matchUpStatus,
    winningSide: matchUp.winningSide,
    hasScore: !!(matchUp.score?.scoreStringSide1 || matchUp.score?.scoreStringSide2),
    participantIds: extractParticipantIds(matchUp),
    payload: matchUp,
  };
}

function extractParticipantIds(matchUp: any): string[] {
  const ids: string[] = [];
  for (const side of matchUp?.sides ?? []) {
    const participant = side.participant;
    if (participant?.individualParticipantIds?.length) {
      ids.push(...participant.individualParticipantIds);
    } else if (participant?.participantId) {
      ids.push(participant.participantId);
    } else if (side.participantId) {
      ids.push(side.participantId);
    }
  }
  return ids;
}

function renderEmptyState(gridEl: HTMLElement): void {
  const empty = document.createElement('div');
  empty.className = 'chp-schedule-placeholder';
  empty.textContent = 'No scheduled matches';
  gridEl.appendChild(empty);
}

/**
 * Test seam — pure helpers exposed for vitest only.
 */
export const __test__ = {
  collectScheduleDates,
  courtsForDate,
  gridTemplate,
  extractParticipantIds,
  buildStripData,
};
