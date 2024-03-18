import { headerSortElement } from 'src/common/sorters/headerSortElement';
import { mapParticipantResults } from './mapParticipantResults';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { orderSorter } from 'src/common/sorters/orderSorter';
import { destroyTable } from 'src/components/destroyTable';
import { drawsGovernor } from 'tods-competition-factory';
import { getStatsColumns } from './getStatsColumns';

export async function createStatsTable({ drawId, structureId, eventData, participants = [] }) {
  let table, participantFilter, participantMap;
  const drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
  let structure = drawData?.structures?.find((s) => s.structureId === structureId);
  const isAdHoc = drawsGovernor.isAdHoc({ structure });

  const getParticipantMap = (participants) =>
    (participants ?? []).reduce((map, participant) => {
      map[participant.participantId] = participant;
      return map;
    }, {});

  const groupNames = {};

  const getParticipantResults = () => {
    const drawData = eventData?.drawsData?.find((data) => data.drawId === drawId);
    structure = drawData?.structures?.find((s) => s.structureId === structureId);

    if (!participantMap) participantMap = getParticipantMap(participants);
    const matchUps: any = structure?.roundMatchUps ? Object.values(structure.roundMatchUps).flat() : [];
    matchUps.forEach(({ sides, structureName, structureId }) => {
      groupNames[structureId] = structureName;
      sides.forEach((side) => {
        if (side.participantId) {
          participantMap[side.participantId].groupName = structureName;
        }
      });
    });

    return (structure?.participantResults ?? []).filter((pResults) => {
      const participant = participantMap[pResults.participantId];
      return (
        !participantFilter || participant?.participantName?.toLowerCase().includes(participantFilter?.toLowerCase())
      );
    });
  };

  const participantResults = getParticipantResults();
  const getTableData = () => {
    return participantResults
      ?.map((participantInfo) => mapParticipantResults({ ...participantInfo, participantMap }))
      .sort((a, b) => (isAdHoc ? orderSorter(a.pressureOrder, b.pressureOrder) : orderSorter(a.order, b.order)));
  };

  const updateTableData = () =>
    getParticipantResults()?.map((participantInfo) => mapParticipantResults({ ...participantInfo, participantMap }));
  const replaceTableData = (params) => {
    if (params?.participantFilter !== undefined) participantFilter = params.participantFilter;
    table.replaceData(updateTableData());
  };

  const data = getTableData();
  const columns = getStatsColumns({ isAdHoc });

  const render = (data) => {
    destroyTable({ anchorId: 'flightDisplay' });
    const element = document.getElementById('flightDisplay');

    const groupBy = Object.values(groupNames).length > 1 ? ['groupName'] : undefined;
    table = new Tabulator(element, {
      headerSortElement: headerSortElement([
        'averageVariation',
        'averagePressure',
        'participantName',
        'gamesResult',
        'matchUpsPct',
        'setsResult',
        'gamesPct',
        'setsPct',
        'result',
        'order'
      ]),
      // responsiveLayoutCollapseStartOpen: false,
      height: window.innerHeight * 0.85,
      groupHeader: [(value) => value],
      placeholder: 'No participants',
      renderHorizontal: 'virtual',
      // responsiveLayout: 'collapse',
      // layout: 'fitColumns',
      // layout: 'fitData',
      // reactiveData: true,
      index: 'matchUpId',
      groupBy,
      columns,
      data
    });
  };

  render(data);

  return { table, replaceTableData };
}
