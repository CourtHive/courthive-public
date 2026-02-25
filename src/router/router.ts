import { createTournamentsTable } from 'src/pages/tournaments/createTournamentsTable';
import { renderTournament } from 'src/pages/tournament/renderTournament';
import { getTournamentInfo } from 'src/services/api/tournamentsApi';
import { renderDefaultPage } from 'src/pages/courthive/default';
import { setDisplay } from 'src/services/transistions';
import Navigo from 'navigo';

import { SPLASH, TOURNAMENT, TOURNAMENTS } from 'src/common/constants/routerConstants';
import { context } from 'src/common/context';

export function router() {
  const useHash = true;
  const router = new Navigo('/', { hash: useHash });

  // make accessible
  context.router = router;

  const back = document.getElementById('back');

  router.on('/', () => {
    back.style.display = 'none';
    setDisplay(SPLASH);
    renderDefaultPage();
  });
  router.on('/tournaments/:providerAbbr', (match) => {
    back.style.display = 'none';
    const providerAbbr = match?.data?.providerAbbr?.toUpperCase();
    setDisplay(TOURNAMENTS);
    createTournamentsTable({ providerAbbr });
  });

  router.on('/tournament/:tournamentId', (match) => {
    back.style.display = 'block';
    const tournamentId = match?.data?.tournamentId;
    context.tournamentId = tournamentId;
    setDisplay(TOURNAMENT);
    getTournamentInfo({ tournamentId }).then(renderTournament);
  });

  router.notFound(() => {
    router.navigate('/');
  });
  router.resolve();

  return router;
}
