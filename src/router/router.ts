import { createTournamentsTable } from 'src/pages/tournaments/createTournamentsTable';
import { getTournamentInfo } from 'src/services/api/tournamentsApi';
import { renderDefaultPage } from 'src/pages/courthive/default';
import Navigo from 'navigo';

export function router() {
  const routerRoot = window.location.host.startsWith('localhost') ? '/' : process.env.PUBLIC_URL ?? '/';

  const useHash = true;
  const router = new Navigo(useHash ? '/' : `/${routerRoot}`, { hash: useHash });
  router.on(`/default`, () => renderDefaultPage());
  router.on(`/calendar/:providerAbbr`, ({ data }) => {
    const providerAbbr = data.providerAbbr.toUpperCase();
    createTournamentsTable({ providerAbbr });
  });
  router.on(`/tournament/:tournamentId`, ({ data }) => {
    const tournamentId = data.tournamentId;
    getTournamentInfo({ tournamentId }).then((x) => console.log(x.data.tournamentInfo));
  });

  router.notFound(() => {
    router.navigate('/default');
  });
  router.resolve();

  return router;
}
