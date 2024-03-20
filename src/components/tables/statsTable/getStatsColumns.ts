import { formatParticipant } from 'src/components/formatters/participantFormatter';
import { percentFormatter } from 'src/components/formatters/percentFormatter';
import { participantSorter } from 'src/common/sorters/participantSorter';
import { percentSorter } from 'src/common/sorters/percentSorter';
import { orderSorter } from 'src/common/sorters/orderSorter';

import { CENTER } from 'src/common/constants/baseConstants';

export function getStatsColumns({ isAdHoc }) {
  return [
    {
      formatter: formatParticipant(({ event, cell, ...params }) =>
        console.log('cell clicked', { event, cell, undefined, params })
      ),
      sorter: participantSorter,
      field: 'participantName',
      responsive: false,
      resizable: false,
      maxWidth: 400,
      minWidth: 200,
      title: 'Name',
      widthGrow: 2,
      frozen: true
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: 'Match W/L',
      hozAlign: CENTER,
      maxWidth: 80,
      field: 'result'
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'matchUpsPct',
      title: 'Match Win%',
      hozAlign: CENTER,
      maxWidth: 80
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'setsResult',
      title: 'Sets W/L',
      hozAlign: CENTER,
      maxWidth: 80
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: 'Set Win%',
      hozAlign: CENTER,
      field: 'setsPct',
      maxWidth: 80
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'gamesResult',
      title: 'Games W/L',
      hozAlign: CENTER,
      maxWidth: 80
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: 'Game Win%',
      hozAlign: CENTER,
      field: 'gamesPct',
      maxWidth: 80
    },
    {
      headerHozAlign: CENTER,
      headerWordWrap: true,
      field: 'pointsResult',
      title: 'Points W/L',
      hozAlign: CENTER,
      maxWidth: 80
    },
    {
      formatter: percentFormatter,
      headerHozAlign: CENTER,
      headerWordWrap: true,
      title: 'Points Win%',
      field: 'pointsPct',
      hozAlign: CENTER,
      maxWidth: 80
    },
    {
      formatter: percentFormatter,
      field: 'averagePressure',
      headerHozAlign: CENTER,
      sorter: percentSorter,
      hozAlign: CENTER,
      maxWidth: 70,
      title: 'PS'
    },
    {
      formatter: percentFormatter,
      field: 'averageVariation',
      headerHozAlign: CENTER,
      sorter: percentSorter,
      hozAlign: CENTER,
      maxWidth: 70,
      title: 'RV'
    },
    {
      headerHozAlign: CENTER,
      field: 'pressureOrder',
      sorter: orderSorter,
      hozAlign: CENTER,
      visible: isAdHoc,
      title: 'Order',
      maxWidth: 80
    },
    {
      headerHozAlign: CENTER,
      sorter: orderSorter,
      visible: !isAdHoc,
      hozAlign: CENTER,
      title: 'Order',
      field: 'order',
      maxWidth: 80
    },
    {
      field: 'groupName',
      visible: false,
      title: 'Group'
    }
  ];
}
