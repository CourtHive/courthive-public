import { competitiveProfileSorter } from 'src/common/sorters/competitiveProfileSorter';
import { formatParticipant } from 'src/components/formatters/participantFormatter';
import { profileFormatter } from 'src/components/formatters/profileFormatter';
import { scoreFormatter } from 'src/components/formatters/scoreFormatter';
import { participantSorter } from 'src/common/sorters/participantSorter';
import { scoreSorter } from 'src/common/sorters/scoreSorter';

// constants
import { CENTER, LEFT } from 'src/common/constants/baseConstants';

export function getRoundsColumns({ data }) {
  const showCourts = data.some((m) => m.courtName);

  const matchUpParticipantFormatter = (cell) => {
    const placholder = document.createElement('div');
    placholder.className = 'has-text-warning-dark';
    placholder.innerHTML = 'Select participant';
    const onClick = () => console.log('boo');

    const value = cell.getValue();
    return value.participantName && formatParticipant(onClick)(cell, placholder);
  };

  return [
    {
      formatter: 'responsiveCollapse',
      headerSort: false,
      resizable: false,
      hozAlign: CENTER,
      minWidth: 50,
      width: 50
    },
    {
      formatter: 'rownum',
      headerSort: false,
      hozAlign: LEFT,
      width: 55
    },
    {
      title: 'Flight',
      visible: false,
      minWidth: 150,
      field: 'flight',
      widthGrow: 1
    },
    {
      field: 'scheduledDate',
      title: 'Date',
      width: 110
    },
    {
      visible: !!showCourts,
      field: 'courtName',
      title: 'Court',
      width: 100
    },
    {
      field: 'scheduleTime',
      headerSort: false,
      visible: false,
      title: 'Time',
      width: 70
    },
    {
      formatter: matchUpParticipantFormatter,
      sorter: participantSorter,
      responsive: false,
      title: 'Side 1',
      minWidth: 180,
      field: 'side1',
      widthGrow: 1
    },
    {
      formatter: matchUpParticipantFormatter,
      sorter: participantSorter,
      responsive: false,
      title: 'Side 2',
      minWidth: 180,
      field: 'side2',
      widthGrow: 1
    },
    {
      formatter: scoreFormatter,
      sorter: scoreSorter,
      field: 'scoreDetail',
      responsive: false,
      title: 'Score',
      width: 140
    },
    {
      sorter: competitiveProfileSorter,
      formatter: profileFormatter,
      field: 'competitiveProfile',
      responsive: false,
      title: 'Profile',
      visible: false,
      width: 140
    },
    {
      title: `<div class='fa-solid fa-check' style='color: green' />`,
      formatter: 'tickCross',
      field: 'complete',
      hozAlign: LEFT,
      tooltip: false,
      width: 40
    },
    {
      field: 'matchUp.matchUpStatus',
      title: 'Status',
      width: 150
    },
    {
      title: `<div class='fa-solid fa-clock' style='color: blue' />`,
      headerSort: false,
      field: 'duration',
      visible: false,
      width: 70
    }
  ];
}
