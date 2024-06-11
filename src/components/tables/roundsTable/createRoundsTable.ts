import { headerSortElement } from 'src/common/sorters/headerSortElement';
import { drawDefinitionConstants } from 'tods-competition-factory';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { roundGroupingHeader } from './roundGroupingHeader';
import { destroyTable } from 'src/components/destroyTable';
import { getRoundsColumns } from './getRoundsColumns';
import { mapRound } from './mapRound';

// constants
const { CONTAINER } = drawDefinitionConstants;

export async function createRoundsTable(params) {
  const { drawId, structureId, eventData } = params;
  let table, structure, participantFilter, isRoundRobin;
  let matchUps = params.matchUps;

  const getMatchUps = () => {
    const drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
    structure = drawData?.structures?.find((s) => s.structureId === structureId);
    isRoundRobin = structure?.structureType === CONTAINER;

    const matchUps: any = structure?.roundMatchUps ? Object.values(structure?.roundMatchUps || {}).flat() : [];
    const tieMatchUps = matchUps.flatMap((matchUp) => matchUp.tieMatchUps || []);
    if (tieMatchUps.length) matchUps.push(...tieMatchUps);

    return matchUps
      .filter(({ matchUpStatus }) => matchUpStatus !== 'BYE')
      .filter(
        ({ sides }) =>
          !participantFilter ||
          sides.find((side) =>
            side.participant?.participantName?.toLowerCase().includes(participantFilter?.toLowerCase())
          )
      );
  };

  // eventName necessary for team scorecard
  if (!matchUps) matchUps = await getMatchUps();
  if (eventData) {
    matchUps.forEach((matchUp) => (matchUp.eventName = eventData.eventInfo.eventName));
  }

  const getTableData = () => matchUps.map(mapRound);

  const updateTableData = () => {
    const matchUps = getMatchUps();
    return matchUps.map(mapRound);
  };
  const replaceTableData = (params) => {
    if (params.participantFilter) participantFilter = params.participantFilter;
    table.replaceData(updateTableData());
  };

  const data = getTableData();
  const columns = getRoundsColumns({ data });
  const groupBy = isRoundRobin ? ['roundName', 'structureName'] : ['roundName'];

  const render = (data) => {
    destroyTable({ anchorId: 'flightDisplay' });
    const element = document.getElementById('flightDisplay');

    table = new Tabulator(element, {
      groupHeader: [roundGroupingHeader, (value) => value],
      headerSortElement: headerSortElement(['complete', 'duration', 'score']),
      responsiveLayoutCollapseStartOpen: false,
      height: window.innerHeight * 0.85,
      /*
      groupStartOpen: [
        true, // use function to determine if all matchUps are completed, and if so, start closed
        (a, count, rows, group) => {
          console.log({ count, rows }, group.getField(), group.getKey());
          return a;
        },
      ],
      */
      responsiveLayout: 'collapse',
      // groupUpdateOnCellEdit: true,
      placeholder: 'No matches',
      layout: 'fitColumns',
      reactiveData: true,
      index: 'matchUpId',
      groupBy,
      columns,
      data
    });
  };

  render(data);

  /**
  const callback = (params) => {
    cleanupDrawPanel();
    if (params?.view) {
      console.log(params);
      // navigateToEvent({ eventId, drawId, structureId, renderDraw: true, view }); 
    } else {
      // renderDrawView({ eventId, drawId, structureId, redraw: refresh, roundsView: view }); 
    }
  };

  drawControlBar({ structure, drawId, existingView: ROUNDS_TABLE, callback });
  eventControlBar({ eventId, drawId, structureId, updateDisplay: replaceTableData });
  */

  return { table, replaceTableData };
}
