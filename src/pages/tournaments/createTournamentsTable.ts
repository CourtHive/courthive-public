import { getProviderCalendar } from 'src/services/api/tournamentsApi';
import { tournamentsControls } from './tournamentsControlBar';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { getTournamentColumns } from './getTournamentColumns';
import { destroyTable } from 'src/components/destroyTable';

import { TOURNAMENTS_TABLE } from 'src/common/constants/elementConstants';

export function createTournamentsTable({ providerAbbr }) {
  const handleError = (error) => console.log('Network error', { error });
  let table, ready;

  const replaceTableData = ({ providerAbbr }) => {
    const refresh = () => {
      const refreshData = (result) => result?.data?.calendar && table.replaceData(result.data.calendar);
      getProviderCalendar({ providerAbbr }).then(refreshData, handleError);
    };

    setTimeout(refresh, ready ? 0 : 1000);
  };

  const columns = getTournamentColumns();

  const renderTable = (tableData) => {
    destroyTable({ anchorId: TOURNAMENTS_TABLE });
    const calendarAnchor = document.getElementById(TOURNAMENTS_TABLE);

    table = new Tabulator(calendarAnchor, {
      height: window.innerHeight * 0.9,
      placeholder: 'No tournaments',
      index: 'tournament.tournamentId',
      headerVisible: false,
      layout: 'fitColumns',
      reactiveData: true,
      data: tableData,
      columns,
    });

    table.on('tableBuilt', () => {
      tournamentsControls(table);
    });
  };

  const renderCalendarTable = (calendar) => {
    calendar.tournaments.sort(
      (a, b) => new Date(b.tournament.startDate).getTime() - new Date(a.tournament.startDate).getTime(),
    );
    renderTable(calendar.tournaments);
  };
  if (providerAbbr) {
    const showResults = (result) => {
      if (result?.data?.calendar) {
        renderCalendarTable(result.data.calendar);
      }
    };
    getProviderCalendar({ providerAbbr }).then(showResults, handleError);
  }

  return { table, replaceTableData };
}
