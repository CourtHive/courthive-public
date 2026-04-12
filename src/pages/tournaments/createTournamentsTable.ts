import TournamentList from 'src/svelte/components/TournamentList.svelte';
import { getProviderCalendar } from 'src/services/api/tournamentsApi';
import { mountSvelte } from 'src/svelte/mount';

import { TOURNAMENTS_TABLE } from 'src/common/constants/elementConstants';

export function createTournamentsTable({ providerAbbr }) {
  const target = document.getElementById(TOURNAMENTS_TABLE);
  const handleError = (error) => console.log('Network error', { error });

  if (providerAbbr) {
    getProviderCalendar({ providerAbbr }).then((result) => {
      const tournaments = result?.data?.calendar?.tournaments ?? [];
      mountSvelte(target, TournamentList, { tournaments });
    }, handleError);
  }
}
