import { createTournamentsTable } from 'src/pages/tournaments/createTournamentsTable';
import { renderTournament } from 'src/pages/tournament/renderTournament';
import { getTournamentInfo } from 'src/services/api/tournamentsApi';
import { renderDefaultPage } from 'src/pages/courthive/default';
import { setDisplay } from 'src/services/transistions';
import Navigo from 'navigo';

import { SPLASH, TOURNAMENT, TOURNAMENTS } from 'src/common/constants/routerConstants';

export function router() {
  const routerRoot = window.location.host.startsWith('localhost') ? '/' : process.env.PUBLIC_URL ?? '/';

  const useHash = true;
  const router = new Navigo(useHash ? '/' : `/${routerRoot}`, { hash: useHash });
  router.on(`/`, () => {
    setDisplay(SPLASH);
    renderDefaultPage();
  });
  router.on(`/tournaments/:providerAbbr`, ({ data }) => {
    const providerAbbr = data.providerAbbr.toUpperCase();
    setDisplay(TOURNAMENTS);
    createTournamentsTable({ providerAbbr });
  });
  router.on(`/tournament/:tournamentId`, ({ data }) => {
    const tournamentId = data.tournamentId;
    setDisplay(TOURNAMENT);
    getTournamentInfo({ tournamentId }).then(renderTournament);
  });

  router.notFound(() => {
    router.navigate('/');
  });
  router.resolve();

  return router;
}
