import { tournamentFormatter } from './tournamentsFormatter';
import { context } from 'src/common/context';

import { TOURNAMENT } from 'src/common/constants/routerConstants';
import { CENTER } from 'src/common/constants/tableConstants';

export function getTournamentColumns() {
  const openTournament = (_, cell) => {
    const tournamentId = cell.getRow().getData().tournamentId;

    if (tournamentId) {
      const tournamentUrl = `/${TOURNAMENT}/${tournamentId}`;
      context.router.navigate(tournamentUrl);
    }
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
      formatter: tournamentFormatter,
      cellClick: openTournament,
      field: 'tournament',
      headerSort: false,
      resizable: true,
      minWidth: 250,
      widthGrow: 3
    },
    {
      formatter: () => `<div class="button font-medium">Open</div>`,
      cellClick: openTournament,
      vertAlign: 'middle',
      title: 'Open',
      width: 90
    }
  ];
}
