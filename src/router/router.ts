import { createTournamentsTable } from 'src/pages/tournaments/createTournamentsTable';
import { renderTournament } from 'src/pages/tournament/renderTournament';
import { getTournamentInfo } from 'src/services/api/tournamentsApi';
import { renderDefaultPage } from 'src/pages/courthive/default';
import { setDisplay } from 'src/services/transistions';
import Navigo from 'navigo';

import { SPLASH, TOURNAMENT, TOURNAMENTS } from 'src/common/constants/routerConstants';
import { context } from 'src/common/context';

function navigateToTournament({
  tournamentId,
  eventId,
  drawId,
  structureId,
}: {
  tournamentId: string;
  eventId?: string;
  drawId?: string;
  structureId?: string;
}) {
  const back = document.getElementById('back');
  back.style.display = 'block';

  context.tournamentId = tournamentId;
  delete context.tab;

  setDisplay(TOURNAMENT);
  getTournamentInfo({ tournamentId }).then((result) =>
    renderTournament(result, { eventId, drawId, structureId }),
  );
}

export function updateRouteUrl({
  tournamentId,
  eventId,
  drawId,
  structureId,
}: {
  tournamentId: string;
  eventId?: string;
  drawId?: string;
  structureId?: string;
}) {
  let path = `/tournament/${tournamentId}`;
  if (eventId) path += `/event/${eventId}`;
  if (drawId) path += `/draw/${drawId}`;
  if (structureId) path += `/structure/${structureId}`;
  context.router?.navigate(path, { callHandler: false });
}

export function router() {
  const useHash = true;
  const router = new Navigo('/', { hash: useHash });

  // make accessible
  context.router = router;

  const back = document.getElementById('back');

  router.on('/', () => {
    console.log('[router] matched: / (splash)');
    back.style.display = 'none';
    setDisplay(SPLASH);
    renderDefaultPage();
  });
  router.on('/tournaments/:providerAbbr', (match) => {
    console.log('[router] matched: /tournaments/:providerAbbr', match?.data);
    back.style.display = 'none';
    const providerAbbr = match?.data?.providerAbbr?.toUpperCase();
    setDisplay(TOURNAMENTS);
    createTournamentsTable({ providerAbbr });
  });

  router.on('/tournament/:tournamentId/event/:eventId/draw/:drawId/structure/:structureId', (match) => {
    console.log('[router] matched: /tournament/.../structure/:structureId', match?.data);
    navigateToTournament({
      tournamentId: match?.data?.tournamentId,
      eventId: match?.data?.eventId,
      drawId: match?.data?.drawId,
      structureId: match?.data?.structureId,
    });
  });
  router.on('/tournament/:tournamentId/event/:eventId/draw/:drawId', (match) => {
    console.log('[router] matched: /tournament/.../draw/:drawId', match?.data);
    navigateToTournament({
      tournamentId: match?.data?.tournamentId,
      eventId: match?.data?.eventId,
      drawId: match?.data?.drawId,
    });
  });
  router.on('/tournament/:tournamentId/event/:eventId', (match) => {
    console.log('[router] matched: /tournament/.../event/:eventId', match?.data);
    navigateToTournament({
      tournamentId: match?.data?.tournamentId,
      eventId: match?.data?.eventId,
    });
  });

  router.on('/tournament/:tournamentId', (match) => {
    console.log('[router] matched: /tournament/:tournamentId', match?.data);
    navigateToTournament({
      tournamentId: match?.data?.tournamentId,
    });
  });

  router.notFound((match) => {
    console.log('[router] notFound — url:', match?.url, 'hashString:', match?.hashString, 'data:', match?.data);
    router.navigate('/');
  });
  router.resolve();

  // Navigo listens for popstate (back/forward) but not hashchange;
  // re-resolve when the user edits the URL hash directly in the address bar
  window.addEventListener('hashchange', () => router.resolve());

  return router;
}
