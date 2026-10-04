import TournamentList from 'src/svelte/components/TournamentList.svelte';
import { fetchProviderCalendar } from 'src/services/api/tournamentsApi';
import { mountSvelte } from 'src/svelte/mount';

import { TOURNAMENTS_TABLE } from 'src/common/constants/elementConstants';

export function createTournamentsTable({ providerAbbr }) {
  const target = document.getElementById(TOURNAMENTS_TABLE);
  const handleError = (error) => console.log('Network error', { error });

  if (providerAbbr) {
    // Paged: the endpoint caps a response at 500, so a single request silently dropped
    // tournaments from providers larger than that.
    fetchProviderCalendar({ providerAbbr }).then((result) => {
      if (result.truncated) console.warn('[tournaments] page cap reached — list may be incomplete');
      // `providerId` is the provider's organisationId, which the calendar response carries — NOT
      // the abbreviation in the URL. It scopes the search box to this organisation's calendar;
      // without it the component keeps filtering only the rows loaded here.
      // `truncated` reaches the user now instead of only the console: a list quietly missing rows
      // is worse than a short one the reader knows is short.
      mountSvelte(target, TournamentList, {
        tournaments: result.tournaments,
        providerId: result.provider?.organisationId,
        truncated: result.truncated,
      });
    }, handleError);
  }
}
